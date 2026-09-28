package com.kpitracking.service.feedback360;

import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.dto.request.feedback360.*;
import com.kpitracking.dto.response.feedback360.*;
import com.kpitracking.entity.*;
import com.kpitracking.enums.*;
import com.kpitracking.event.F360Events;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.Terms;
import com.kpitracking.mapper.F360Mapper;
import com.kpitracking.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Vòng đời chiến dịch 360 (§4.1): DRAFT → (NOMINATING →) OPEN → CLOSED → RELEASED, kèm quản lý
 * người được đánh giá và phiếu. Chiến dịch có ảnh hưởng điểm (§7.2) đi qua {@link F360CycleGuard}
 * ở mọi bước có thể đụng tới kỳ đã chốt.
 *
 * <p>Mọi thao tác ghi nhắm vào một người được đánh giá đều qua
 * {@link F360AccessPolicy#assertNotSelfTarget}: HR không tự sửa đánh giá 360 của chính mình.
 */
@Service
@RequiredArgsConstructor
public class F360CampaignService {

    /** Không nhắc lại cùng một phiếu trong khoảng này (chống bấm "Nhắc" liên tục). */
    private static final Duration REMIND_COOLDOWN = Duration.ofHours(6);

    private final F360CampaignRepository campaignRepository;
    private final F360TemplateRepository templateRepository;
    private final F360CampaignQuestionRepository campaignQuestionRepository;
    private final F360SubjectRepository subjectRepository;
    private final F360AssignmentRepository assignmentRepository;
    private final F360AnswerRepository answerRepository;
    private final F360EventRepository eventRepository;
    private final OrganizationRepository organizationRepository;
    private final KpiCycleRepository kpiCycleRepository;
    private final UserRepository userRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final F360TemplateService templateService;
    private final F360RaterSuggestionService raterSuggestion;
    private final F360ReportService reportService;
    private final F360NominationService nominationService;
    private final F360UnlinkJob unlinkJob;
    private final F360CycleGuard cycleGuard;
    private final F360AccessPolicy access;
    private final F360Mapper mapper;
    private final ApplicationEventPublisher events;

    // ============================================================
    // ĐỌC
    // ============================================================

    @Transactional(readOnly = true)
    public List<F360CampaignResponse> list(UUID organizationId) {
        User me = access.currentUser();
        Organization org = requireOrg(organizationId);
        access.requireEnabled(org);
        if (!access.canViewCampaigns(me, organizationId)) {
            throw new ForbiddenException(ErrorCode.NO_PERMISSION_VIEW_F360_CAMPAIGNS_2);
        }
        boolean manage = access.canManage(me, organizationId);
        return campaignRepository.findByOrganizationId(organizationId).stream()
                // Quản lý đơn vị không thấy bản nháp — nó chưa là gì với họ.
                .filter(c -> manage || c.getStatus() != F360CampaignStatus.DRAFT)
                .map(c -> toResponse(c, manage))
                .toList();
    }

    @Transactional(readOnly = true)
    public F360CampaignResponse get(UUID campaignId) {
        User me = access.currentUser();
        F360Campaign c = requireCampaign(campaignId);
        requireView(me, c);
        return toResponse(c, access.canManage(me, c.getOrganization().getId()));
    }

    /**
     * Câu hỏi của chiến dịch, cùng dạng với bộ câu hỏi. Nháp → bộ đang soạn (còn sửa được); đã khởi
     * động → bản chụp lúc khởi động, tức đúng thứ người chấm đang/đã trả lời.
     */
    @Transactional(readOnly = true)
    public F360TemplateResponse questions(UUID campaignId) {
        User me = access.currentUser();
        F360Campaign c = requireCampaign(campaignId);
        requireView(me, c);
        return buildQuestions(c);
    }

    private F360TemplateResponse buildQuestions(F360Campaign c) {
        UUID campaignId = c.getId();
        if (c.getStatus() == F360CampaignStatus.DRAFT) {
            if (c.getTemplate() == null) {
                return F360TemplateResponse.builder().scaleMax(c.getScaleMax()).totalWeight(0.0)
                        .competencies(List.of()).openQuestions(List.of()).build();
            }
            return templateService.toResponse(templateService.requireTemplate(c.getOrganization().getId(), c.getTemplate().getId()));
        }
        List<F360CampaignQuestion> snap = campaignQuestionRepository.findByCampaignId(campaignId).stream()
                .sorted(Comparator.comparing(F360CampaignQuestion::getPosition)).toList();
        Map<UUID, F360TemplateResponse.Competency> comps = new LinkedHashMap<>();
        List<F360TemplateResponse.Question> open = new ArrayList<>();
        snap.stream()
                .sorted(Comparator.comparing((F360CampaignQuestion q) -> q.getCompetencyPosition() == null ? Integer.MAX_VALUE : q.getCompetencyPosition())
                        .thenComparing(F360CampaignQuestion::getPosition))
                .forEach(q -> {
                    F360TemplateResponse.Question dto = F360TemplateResponse.Question.builder()
                            .id(q.getId()).questionType(q.getQuestionType()).text(q.getText())
                            .relationships(com.kpitracking.util.F360Relationships.parse(q.getRelationships()))
                            .required(q.getRequired()).allowNa(q.getAllowNa()).position(q.getPosition()).build();
                    if (q.getCompetencyKey() == null) {
                        open.add(dto);
                        return;
                    }
                    comps.computeIfAbsent(q.getCompetencyKey(), k -> F360TemplateResponse.Competency.builder()
                            .id(k).name(q.getCompetencyName()).weight(q.getCompetencyWeight())
                            .position(q.getCompetencyPosition()).questions(new ArrayList<>()).build())
                            .getQuestions().add(dto);
                });
        return F360TemplateResponse.builder()
                .name(c.getName())
                .scaleMax(c.getScaleMax())
                .totalWeight(comps.values().stream().mapToDouble(x -> x.getWeight() == null ? 0 : x.getWeight()).sum())
                .competencies(new ArrayList<>(comps.values()))
                .openQuestions(open)
                .build();
    }

    /**
     * Danh sách người được đánh giá kèm tiến độ DẠNG SỐ ĐẾM. HR thấy tất cả; quản lý chỉ thấy người
     * trong phạm vi đơn vị mình. Dòng của chính người xem luôn bị lọc (§6.2).
     */
    @Transactional(readOnly = true)
    public List<F360SubjectRowResponse> listSubjects(UUID campaignId) {
        User me = access.currentUser();
        F360Campaign c = requireCampaign(campaignId);
        requireView(me, c);
        Map<UUID, List<F360Assignment>> bySubject = assignmentRepository.findByCampaignId(campaignId).stream()
                .collect(Collectors.groupingBy(a -> a.getSubject().getId()));
        return subjectRepository.findByCampaignIdWithUser(campaignId).stream()
                .filter(s -> access.inManagerScope(me, s))
                .sorted(Comparator.comparing(s -> s.getUser().getFullName() == null ? "" : s.getUser().getFullName()))
                .map(s -> toRow(c, s, bySubject.getOrDefault(s.getId(), List.of())))
                .toList();
    }

    /** Ai chấm ai, ai đã/chưa nộp — CHỈ HR, và không bao giờ cho subject là chính mình. */
    @Transactional(readOnly = true)
    public List<F360AssignmentRowResponse> listAssignments(UUID campaignId, UUID subjectId) {
        User me = access.currentUser();
        F360Campaign c = requireCampaign(campaignId);
        access.requireManage(me, c.getOrganization());
        F360Subject subject = requireSubject(c, subjectId);
        access.assertNotSelfTarget(me, subject);
        return assignmentRepository.findBySubjectId(subjectId).stream()
                .filter(a -> a.getStatus() != F360AssignmentStatus.REMOVED)
                .sorted(Comparator.comparingInt((F360Assignment a) -> a.getRelationship().priority())
                        .thenComparing(a -> a.getRater().getFullName() == null ? "" : a.getRater().getFullName()))
                .map(mapper::toAssignmentRow)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<F360EventResponse> events(UUID campaignId) {
        User me = access.currentUser();
        F360Campaign c = requireCampaign(campaignId);
        access.requireManage(me, c.getOrganization());
        return eventRepository.findByCampaignId(campaignId).stream().map(mapper::toEventResponse).toList();
    }

    // ============================================================
    // TẠO / SỬA / XOÁ
    // ============================================================

    @Transactional
    public F360CampaignResponse create(UUID organizationId, F360CampaignRequest request) {
        User me = access.currentUser();
        Organization org = requireOrg(organizationId);
        access.requireManage(me, org);

        F360Template template = request.getTemplateId() != null
                ? templateService.requireTemplate(organizationId, request.getTemplateId())
                : templateRepository.findByOrganizationIdAndCampaignIdIsNullOrderByCreatedAtAsc(organizationId).stream()
                        .filter(t -> Boolean.TRUE.equals(t.getIsDefault())).findFirst()
                        .orElse(null);
        if (template == null && request.getQuestions() == null) {
            throw new BusinessException(ErrorCode.CAMPAIGN_NO_QUESTIONS);
        }

        F360Campaign c = F360Campaign.builder()
                .organization(org)
                .name(request.getName().trim())
                .description(request.getDescription())
                .template(template)
                .scaleMax(template != null ? template.getScaleMax() : 5)
                .createdBy(me)
                .relationshipWeights(F360Settings.writeWeights(F360Settings.DEFAULT_WEIGHTS))
                .raterRules(F360Settings.writeRaterRules(F360Settings.RaterRules.defaults()))
                .reportSettings(F360Settings.writeReportSettings(new F360Settings.ReportSettings(
                        F360Settings.DEFAULT_BLIND_SPOT_GAP, F360Settings.DEFAULT_DISPERSION_FLAG, false)))
                .build();
        applyDraftFields(c, request);
        c = campaignRepository.save(c);
        applyQuestions(c, request, me);
        log(c, null, me, "CREATE", null);
        return toResponse(c, true);
    }

    @Transactional
    public F360CampaignResponse update(UUID campaignId, F360CampaignRequest request) {
        User me = access.currentUser();
        F360Campaign c = requireCampaign(campaignId);
        access.requireManage(me, c.getOrganization());

        switch (c.getStatus()) {
            case DRAFT -> {
                if (request.getName() != null && !request.getName().isBlank()) c.setName(request.getName().trim());
                c.setDescription(request.getDescription());
                if (request.getTemplateId() != null) {
                    F360Template t = templateService.requireTemplate(c.getOrganization().getId(), request.getTemplateId());
                    c.setTemplate(t);
                    c.setScaleMax(t.getScaleMax());
                }
                applyDraftFields(c, request);
                applyQuestions(c, request, me);
            }
            case NOMINATING, OPEN -> {
                // Đang chạy thì luật chơi đã quyết định phiếu người ta đang điền — chỉ đổi mô tả và hạn.
                if (request.getName() != null && !request.getName().isBlank()) c.setName(request.getName().trim());
                c.setDescription(request.getDescription());
                if (request.getDueAt() != null) setDue(c, request.getDueAt());
                if (c.getStatus() == F360CampaignStatus.NOMINATING && request.getNominationDeadline() != null) {
                    c.setNominationDeadline(request.getNominationDeadline());
                }
            }
            default -> throw new BusinessException(ErrorCode.CAMPAIGN_CLOSED_CONFIGURATION_CANNOT_EDITED);
        }
        return toResponse(campaignRepository.save(c), true);
    }

    @Transactional
    public void delete(UUID campaignId) {
        User me = access.currentUser();
        F360Campaign c = requireCampaign(campaignId);
        access.requireManage(me, c.getOrganization());
        if (c.getStatus() != F360CampaignStatus.DRAFT) {
            throw new BusinessException(ErrorCode.ONLY_DRAFT_CAMPAIGNS_CAN_DELETED);
        }
        c.setDeletedAt(Instant.now());
        campaignRepository.save(c);
    }

    private void applyDraftFields(F360Campaign c, F360CampaignRequest r) {
        if (r.getKpiCycleId() != null) {
            KpiCycle cycle = kpiCycleRepository.findById(r.getKpiCycleId())
                    .filter(k -> k.getOrganization().getId().equals(c.getOrganization().getId()))
                    .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.kpiCycle"), "id", r.getKpiCycleId()));
            c.setKpiCycle(cycle);
        } else if (c.getId() != null) {
            c.setKpiCycle(null);
        }
        if (r.getDueAt() != null) setDue(c, r.getDueAt());
        if (r.getStartAt() != null) c.setStartAt(r.getStartAt());
        if (r.getAnonymityThreshold() != null) c.setAnonymityThreshold(r.getAnonymityThreshold());
        if (r.getIncludeSelf() != null) c.setIncludeSelf(r.getIncludeSelf());
        if (r.getManagerAnonymous() != null) c.setManagerAnonymous(r.getManagerAnonymous());
        if (r.getReleaseToSubject() != null) c.setReleaseToSubject(r.getReleaseToSubject());
        if (r.getAutoClose() != null) c.setAutoClose(r.getAutoClose());
        if (r.getStrictAnonymity() != null) c.setStrictAnonymity(r.getStrictAnonymity());
        if (r.getAllowNomination() != null) c.setAllowNomination(r.getAllowNomination());
        if (r.getNominationDeadline() != null) c.setNominationDeadline(r.getNominationDeadline());
        if (r.getScoringMode() != null) {
            if (r.getScoringMode() != F360ScoringMode.DEVELOPMENT_ONLY
                    && !Boolean.TRUE.equals(c.getOrganization().getFeedback360AffectsRating())) {
                throw new BusinessException(ErrorCode.ORGANIZATION_NOT_ALLOWED_F360_COUNT_TOWARD_CYCLE);
            }
            c.setScoringMode(r.getScoringMode());
        }
        if (r.getBlendConductPercent() != null) c.setBlendConductPercent(r.getBlendConductPercent());
        if (r.getAiSummary() != null) {
            F360Settings.ReportSettings rs = F360Settings.reportSettings(c);
            c.setReportSettings(F360Settings.writeReportSettings(
                    new F360Settings.ReportSettings(rs.blindSpotGap(), rs.dispersionFlag(), r.getAiSummary())));
        }

        if (r.getRelationshipWeights() != null) {
            Map<F360Relationship, Double> w = F360Settings.weights(c);
            r.getRelationshipWeights().forEach((k, v) -> {
                try {
                    if (v != null && v >= 0) w.put(F360Relationship.valueOf(k), v);
                } catch (IllegalArgumentException ignored) {
                    // khoá lạ từ client — bỏ qua
                }
            });
            double others = w.entrySet().stream().filter(e -> e.getKey() != F360Relationship.SELF)
                    .mapToDouble(Map.Entry::getValue).sum();
            if (others <= 0) throw new BusinessException(ErrorCode.TOTAL_WEIGHT_GROUPS);
            c.setRelationshipWeights(F360Settings.writeWeights(w));
        }
        if (r.getMaxPeers() != null || r.getMaxDirectReports() != null || r.getMaxAssignmentsPerRater() != null
                || r.getMaxNominees() != null) {
            F360Settings.RaterRules cur = F360Settings.raterRules(c);
            c.setRaterRules(F360Settings.writeRaterRules(new F360Settings.RaterRules(
                    r.getMaxPeers() != null ? r.getMaxPeers() : cur.maxPeers(),
                    r.getMaxDirectReports() != null ? r.getMaxDirectReports() : cur.maxDirectReports(),
                    r.getMaxAssignmentsPerRater() != null ? r.getMaxAssignmentsPerRater() : cur.maxAssignmentsPerRater(),
                    cur.managerWarnThreshold(),
                    r.getMaxNominees() != null ? r.getMaxNominees() : cur.maxNominees())));
        }
        validateSchedule(c);
    }

    /** Khung mở/hạn bám kỳ, kiểm tra trên trạng thái CUỐI (đổi chế độ hay đổi kỳ đều qua đây). */
    private void validateSchedule(F360Campaign c) {
        KpiCycle k = c.getKpiCycle();
        F360Schedule.validate(c.getScoringMode() != F360ScoringMode.DEVELOPMENT_ONLY,
                k == null ? null : k.getStartDate(), k == null ? null : k.getEndDate(),
                c.getStartAt(), c.getDueAt());
    }

    /** Câu hỏi soạn trong form ⇒ bộ câu hỏi riêng của chiến dịch (chỉ khi còn nháp). */
    private void applyQuestions(F360Campaign c, F360CampaignRequest r, User me) {
        if (r.getQuestions() == null) return;
        F360Template owned = templateService.upsertOwned(c, r.getQuestions(), me);
        c.setTemplate(owned);
        c.setScaleMax(owned.getScaleMax());
        campaignRepository.save(c);
    }

    private void setDue(F360Campaign c, Instant dueAt) {
        if (!dueAt.isAfter(Instant.now())) throw new BusinessException(ErrorCode.EVALUATION_DEADLINE_MUST_FUTURE);
        c.setDueAt(dueAt);
    }

    // ============================================================
    // NGƯỜI ĐƯỢC ĐÁNH GIÁ
    // ============================================================

    @Transactional
    public List<F360SubjectRowResponse> addSubjects(UUID campaignId, F360AddSubjectsRequest request) {
        User me = access.currentUser();
        F360Campaign c = requireCampaign(campaignId);
        access.requireManage(me, c.getOrganization());
        requireStatus(c, "addReviewees", F360CampaignStatus.DRAFT, F360CampaignStatus.NOMINATING,
                F360CampaignStatus.OPEN);

        UUID orgId = c.getOrganization().getId();
        F360RaterSuggestionService.OrgSnapshot org = raterSuggestion.snapshot(orgId);

        Set<UUID> userIds = new LinkedHashSet<>();
        if (request.getUserIds() != null) userIds.addAll(request.getUserIds());
        if (request.getOrgUnitId() != null) {
            OrgUnit unit = orgUnitRepository.findByIdAndOrgHierarchyLevel_Organization_Id(request.getOrgUnitId(), orgId)
                    .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.unit"), "id", request.getOrgUnitId()));
            Set<UUID> unitIds = Boolean.TRUE.equals(request.getIncludeChildren())
                    ? orgUnitRepository.findSubtree(unit.getPath(), orgId).stream().map(OrgUnit::getId).collect(Collectors.toSet())
                    : Set.of(unit.getId());
            // Chỉ lấy người có ĐƠN VỊ CHÍNH trong phạm vi — người kiêm nhiệm ở đơn vị khác được
            // đánh giá ở đơn vị chính của họ, không bị kéo vào hai lần.
            org.primaryUnitOf.forEach((uid, unitId) -> {
                if (unitIds.contains(unitId)) userIds.add(uid);
            });
        }
        if (userIds.isEmpty()) throw new BusinessException(ErrorCode.NO_ONE_SELECTED);

        Set<UUID> existing = subjectRepository.findByCampaignIdWithUser(campaignId).stream()
                .map(s -> s.getUser().getId()).collect(Collectors.toSet());
        List<F360Subject> added = new ArrayList<>();
        for (UUID uid : userIds) {
            if (existing.contains(uid)) continue;
            User u = org.user(uid);
            if (u == null) continue; // không thuộc tổ chức này, hoặc đã nghỉ/tạm khoá
            added.add(subjectRepository.save(F360Subject.builder()
                    .campaign(c)
                    .user(u)
                    .orgUnit(org.primaryUnit(uid))
                    .status(c.getStatus() == F360CampaignStatus.OPEN ? F360SubjectStatus.COLLECTING : F360SubjectStatus.NOMINATING)
                    .build()));
        }
        if (added.isEmpty()) throw new BusinessException(ErrorCode.EVERYONE_SELECTED_CAMPAIGN_INVALID);
        if (c.getStatus() != F360CampaignStatus.DRAFT) cycleGuard.assertInputsOpen(c, added);
        log(c, null, me, "ADD_SUBJECTS", Map.of("count", added.size()));

        // Đã khởi động thì người mới phải có người chấm ngay; đang mở thì người chấm được báo luôn,
        // đang đề cử thì người mới có người duyệt và được mời đề cử như mọi người khác.
        if (c.getStatus() != F360CampaignStatus.DRAFT) {
            List<F360Assignment> created = generateFor(c, added, org, new ArrayList<>());
            if (c.getStatus() == F360CampaignStatus.OPEN) publishInvite(c, created);
            else nominationService.assignApprovers(c, added);
        }
        return listSubjects(campaignId);
    }

    @Transactional
    public void removeSubject(UUID campaignId, UUID subjectId) {
        User me = access.currentUser();
        F360Campaign c = requireCampaign(campaignId);
        access.requireManage(me, c.getOrganization());
        requireStatus(c, "removeReviewees", F360CampaignStatus.DRAFT, F360CampaignStatus.NOMINATING,
                F360CampaignStatus.OPEN);
        F360Subject s = requireSubject(c, subjectId);
        access.assertNotSelfTarget(me, s);

        List<F360Assignment> assignments = assignmentRepository.findBySubjectId(subjectId);
        if (c.getStatus() == F360CampaignStatus.DRAFT) {
            assignmentRepository.deleteAll(assignments);
        } else {
            for (F360Assignment a : assignments) {
                if (a.getStatus().open() || a.getStatus() == F360AssignmentStatus.DECLINED) {
                    answerRepository.deleteByAssignmentId(a.getId());
                    a.setStatus(F360AssignmentStatus.REMOVED);
                }
            }
            assignmentRepository.saveAll(assignments);
        }
        s.setDeletedAt(Instant.now());
        subjectRepository.save(s);
        log(c, s, me, "REMOVE_SUBJECT", null);
    }

    // ============================================================
    // NGƯỜI CHẤM
    // ============================================================

    /**
     * Sinh người chấm tự động. {@code reset} = xoá các phiếu AUTO rồi sinh lại cho mọi người;
     * ngược lại chỉ sinh cho người chưa có phiếu nào. Chỉ ở bản nháp — chưa ai nhận lời mời.
     */
    @Transactional
    public F360GenerateResultResponse generateRaters(UUID campaignId, boolean reset) {
        User me = access.currentUser();
        F360Campaign c = requireCampaign(campaignId);
        access.requireManage(me, c.getOrganization());
        requireStatus(c, "generateRaters", F360CampaignStatus.DRAFT);

        List<F360Subject> subjects = subjectRepository.findByCampaignIdWithUser(campaignId);
        if (subjects.isEmpty()) throw new BusinessException(ErrorCode.CAMPAIGN_NO_REVIEWEES);

        List<F360Assignment> current = assignmentRepository.findByCampaignId(campaignId);
        if (reset) {
            List<F360Assignment> auto = current.stream().filter(a -> a.getSource() == F360RaterSource.AUTO).toList();
            assignmentRepository.deleteAll(auto);
            assignmentRepository.flush();
            current = current.stream().filter(a -> a.getSource() != F360RaterSource.AUTO).toList();
        }
        Set<UUID> hasAssignments = current.stream().map(a -> a.getSubject().getId()).collect(Collectors.toSet());
        List<F360Subject> targets = subjects.stream().filter(s -> !hasAssignments.contains(s.getId())).toList();

        List<String> warnings = new ArrayList<>();
        List<F360Assignment> created = generateFor(c, targets, raterSuggestion.snapshot(c.getOrganization().getId()), warnings);
        log(c, null, me, "GENERATE_RATERS", Map.of("subjects", targets.size(), "assignments", created.size(), "reset", reset));

        // Cảnh báo khối lượng của cấp trên: không ai thay được, nhưng HR/sếp cần thấy (§5.3).
        F360Settings.RaterRules rules = F360Settings.raterRules(c);
        Map<UUID, Long> managerLoad = assignmentRepository.findByCampaignId(campaignId).stream()
                .filter(a -> a.getRelationship() == F360Relationship.MANAGER && a.getStatus() != F360AssignmentStatus.REMOVED)
                .collect(Collectors.groupingBy(a -> a.getRater().getId(), Collectors.counting()));
        managerLoad.forEach((raterId, n) -> {
            if (n > rules.managerWarnThreshold()) {
                String name = userRepository.findById(raterId).map(User::getFullName).orElse(ErrorMessages.text("f360.warning.aManager", ""));
                warnings.add(ErrorMessages.text("f360.warning.heavyManager", "", name, n));
            }
        });

        return F360GenerateResultResponse.builder()
                .subjectsProcessed(targets.size())
                .assignmentsCreated(created.size())
                .warnings(warnings)
                .build();
    }

    private List<F360Assignment> generateFor(F360Campaign c, List<F360Subject> subjects,
                                             F360RaterSuggestionService.OrgSnapshot org, List<String> warnings) {
        F360Settings.RaterRules rules = F360Settings.raterRules(c);
        Map<UUID, Integer> load = raterSuggestion.currentLoad(c.getId());
        Random random = new Random(c.getId().getMostSignificantBits());
        List<F360Assignment> created = new ArrayList<>();
        for (F360Subject s : subjects) {
            F360RaterSuggestionService.Suggestion sug = raterSuggestion.suggest(org, s.getUser(),
                    Boolean.TRUE.equals(c.getIncludeSelf()), c.getAnonymityThreshold(), rules, load, random);
            sug.warnings().forEach(w -> warnings.add(s.getUser().getFullName() + ": " + w));
            created.addAll(assignmentRepository.saveAll(raterSuggestion.toAssignments(s, sug)));
        }
        return created;
    }

    @Transactional
    public F360AssignmentRowResponse addAssignment(UUID campaignId, F360AddAssignmentRequest request) {
        User me = access.currentUser();
        F360Campaign c = requireCampaign(campaignId);
        access.requireManage(me, c.getOrganization());
        requireStatus(c, "addRaters", F360CampaignStatus.DRAFT, F360CampaignStatus.NOMINATING, F360CampaignStatus.OPEN);
        F360Subject s = requireSubject(c, request.getSubjectId());
        access.assertNotSelfTarget(me, s);

        User rater = userRepository.findById(request.getRaterId())
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "id", request.getRaterId()));
        if (rater.getDeletedAt() != null || rater.isPausedAccount()
                || !access.organizationsOf(rater).contains(c.getOrganization().getId())) {
            throw new BusinessException(ErrorCode.RATER_OUTSIDE_ORGANIZATION_ACCOUNT_LOCKED);
        }
        boolean isSubject = rater.getId().equals(s.getUser().getId());
        if (isSubject != (request.getRelationship() == F360Relationship.SELF)) {
            throw new BusinessException(ErrorCode.SELF_ASSESSMENT_RELATIONSHIP_ONLY_REVIEWEE_THEMSELVES);
        }

        // Thêm lại đúng người đã bị gỡ: dùng lại dòng cũ, không tạo dòng mới (§5.3).
        F360Assignment a = assignmentRepository.findBySubjectIdAndRaterId(s.getId(), rater.getId()).orElse(null);
        if (a != null && a.getStatus() != F360AssignmentStatus.REMOVED) {
            throw new BusinessException(ErrorCode.RATER_PERSON, rater.getFullName());
        }
        if (a == null) {
            a = F360Assignment.builder().subject(s).rater(rater).build();
        }
        a.setRelationship(request.getRelationship());
        a.setSource(F360RaterSource.ADDED);
        a.setStatus(F360AssignmentStatus.PENDING);
        a.setDeclineReason(null);
        a.setStartedAt(null);
        a.setSubmittedAt(null);
        a = assignmentRepository.save(a);
        log(c, s, me, "ADD_RATER", Map.of("relationship", request.getRelationship().name()));

        if (c.getStatus() == F360CampaignStatus.OPEN) publishInvite(c, List.of(a));
        return mapper.toAssignmentRow(a);
    }

    /** Gỡ người chấm — CHỈ phiếu chưa nộp. Phiếu đã nộp không gỡ được: đó là đường "đổi phiếu". */
    @Transactional
    public void removeAssignment(UUID campaignId, UUID assignmentId) {
        User me = access.currentUser();
        F360Campaign c = requireCampaign(campaignId);
        access.requireManage(me, c.getOrganization());
        requireStatus(c, "removeRaters", F360CampaignStatus.DRAFT, F360CampaignStatus.NOMINATING, F360CampaignStatus.OPEN);
        F360Assignment a = requireAssignment(c, assignmentId);
        access.assertNotSelfTarget(me, a.getSubject());

        if (a.getStatus() == F360AssignmentStatus.SUBMITTED) {
            throw new BusinessException(ErrorCode.SUBMITTED_FORM_CANNOT_REMOVED);
        }
        if (a.getStatus() == F360AssignmentStatus.REMOVED) return;
        answerRepository.deleteByAssignmentId(a.getId());
        if (c.getStatus() == F360CampaignStatus.DRAFT || c.getStatus() == F360CampaignStatus.NOMINATING) {
            assignmentRepository.delete(a);
        } else {
            a.setStatus(F360AssignmentStatus.REMOVED);
            assignmentRepository.save(a);
        }
        log(c, a.getSubject(), me, "REMOVE_RATER", Map.of("relationship", a.getRelationship().name()));
    }

    /**
     * Mở lại một phiếu đã nộp để CHÍNH người chấm sửa (vd chấm nhầm người). Bắt buộc lý do, ghi
     * nhật ký và báo cho người chấm. HR không bao giờ sửa câu trả lời.
     */
    @Transactional
    public void reopenAssignment(UUID campaignId, UUID assignmentId, String reason) {
        User me = access.currentUser();
        F360Campaign c = requireCampaign(campaignId);
        access.requireManage(me, c.getOrganization());
        requireStatus(c, "reopenForm", F360CampaignStatus.OPEN);
        F360Assignment a = requireAssignment(c, assignmentId);
        access.assertNotSelfTarget(me, a.getSubject());

        if (a.getStatus() != F360AssignmentStatus.SUBMITTED) {
            throw new BusinessException(ErrorCode.ONLY_SUBMITTED_FORMS_CAN_REOPENED);
        }
        // Phiếu đã tách liên kết (ẩn danh nghiêm ngặt) không còn câu trả lời gắn với nó — khoá vĩnh viễn.
        if (!answerRepository.existsByAssignmentId(a.getId())) {
            throw new BusinessException(ErrorCode.FORM_ANONYMIZED_CANNOT_REOPENED);
        }
        a.setStatus(F360AssignmentStatus.IN_PROGRESS);
        a.setSubmittedAt(null);
        a.setReopenReason(reason);
        assignmentRepository.save(a);
        log(c, a.getSubject(), me, "REOPEN_ASSIGNMENT", Map.of("reason", reason));
        events.publishEvent(new F360Events.AssignmentReopenedEvent(a.getId(), reason));
    }

    /** Nhắc thủ công mọi phiếu còn dở. Bỏ qua phiếu mà người được đánh giá là chính người bấm. */
    @Transactional
    public int remind(UUID campaignId) {
        User me = access.currentUser();
        F360Campaign c = requireCampaign(campaignId);
        access.requireManage(me, c.getOrganization());
        requireStatus(c, "remindRaters", F360CampaignStatus.OPEN);
        Instant cutoff = Instant.now().minus(REMIND_COOLDOWN);
        List<UUID> ids = assignmentRepository.findByCampaignId(campaignId).stream()
                .filter(a -> a.getStatus().open())
                .filter(a -> !access.isSelf(me, a.getSubject()))
                .filter(a -> a.getLastRemindedAt() == null || a.getLastRemindedAt().isBefore(cutoff))
                .map(F360Assignment::getId)
                .toList();
        if (!ids.isEmpty()) {
            events.publishEvent(new F360Events.RatersRemindedEvent(c.getId(), ids));
            log(c, null, me, "REMIND", Map.of("count", ids.size()));
        }
        return ids.size();
    }

    // ============================================================
    // VÒNG ĐỜI
    // ============================================================

    /** DRAFT → OPEN: chụp câu hỏi, mở phiếu, mời người chấm. */
    @Transactional
    public F360CampaignResponse launch(UUID campaignId) {
        User me = access.currentUser();
        F360Campaign c = requireCampaign(campaignId);
        access.requireManage(me, c.getOrganization());
        launchInternal(c, me);
        return toResponse(c, true);
    }

    /**
     * Khởi động không qua kiểm tra quyền — dùng cho lượt tự mở lúc {@code startAt} (actor null) và cho
     * {@link #launch}. Trong transaction của bên gọi; ném BusinessException nếu chưa đủ điều kiện.
     */
    @Transactional
    public void launchInternal(F360Campaign c, User me) {
        UUID campaignId = c.getId();
        requireStatus(c, "start", F360CampaignStatus.DRAFT);

        if (c.getDueAt() == null || !c.getDueAt().isAfter(Instant.now())) {
            throw new BusinessException(ErrorCode.SET_EVALUATION_DEADLINE_FUTURE_BEFORE_STARTING);
        }
        UUID templateId = c.getTemplate() != null ? c.getTemplate().getId() : null;
        F360Template template = templateId == null ? null
                : templateRepository.findByIdAndOrganizationId(templateId, c.getOrganization().getId()).orElse(null);
        if (template == null) {
            throw new BusinessException(ErrorCode.CAMPAIGN_QUESTION_SET_DELETED);
        }
        List<F360Subject> subjects = subjectRepository.findByCampaignIdWithUser(campaignId);
        if (subjects.isEmpty()) throw new BusinessException(ErrorCode.CAMPAIGN_NO_REVIEWEES);
        List<F360Assignment> assignments = assignmentRepository.findByCampaignId(campaignId).stream()
                .filter(a -> a.getStatus() != F360AssignmentStatus.REMOVED).toList();
        if (assignments.stream().noneMatch(a -> a.getRelationship() != F360Relationship.SELF)) {
            throw new BusinessException(ErrorCode.NO_RATERS_BESIDES_SELF_ASSESSMENT);
        }

        if (c.getScoringMode() != F360ScoringMode.DEVELOPMENT_ONLY) assertScoringLaunchable(c, template);
        cycleGuard.assertInputsOpen(c, subjects);
        if (Boolean.TRUE.equals(c.getAllowNomination()) && c.getNominationDeadline() != null
                && !c.getNominationDeadline().isBefore(c.getDueAt())) {
            throw new BusinessException(ErrorCode.NOMINATION_DEADLINE_MUST_BEFORE_EVALUATION_DEADLINE);
        }

        snapshotQuestions(c, template);
        c.setScaleMax(template.getScaleMax());
        c.setLaunchedAt(Instant.now());
        if (Boolean.TRUE.equals(c.getAllowNomination())) {
            // Giai đoạn đề cử: CHƯA mời người chấm — danh sách còn đổi.
            c.setStatus(F360CampaignStatus.NOMINATING);
            campaignRepository.save(c);
            nominationService.assignApprovers(c, subjects);
            log(c, null, me, "LAUNCH", Map.of("subjects", subjects.size(), "nomination", true));
            events.publishEvent(new F360Events.NominationOpenedEvent(c.getId()));
        } else {
            c.setStatus(F360CampaignStatus.OPEN);
            subjects.forEach(s -> s.setStatus(F360SubjectStatus.COLLECTING));
            subjectRepository.saveAll(subjects);
            campaignRepository.save(c);
            log(c, null, me, "LAUNCH", Map.of("subjects", subjects.size(), "assignments", assignments.size()));
            publishInvite(c, assignments);
        }
    }

    /**
     * Kết thúc đề cử (NOMINATING → OPEN): ai chưa được duyệt thì tự duyệt (ghi AUTO_APPROVE), rồi mới
     * mời người chấm. Không subject nào còn kẹt ở trạng thái đề cử sau bước này (§5.2).
     */
    @Transactional
    public F360CampaignResponse start(UUID campaignId) {
        User me = access.currentUser();
        F360Campaign c = requireCampaign(campaignId);
        access.requireManage(me, c.getOrganization());
        requireStatus(c, "startRating", F360CampaignStatus.NOMINATING);
        if (c.getDueAt() == null || !c.getDueAt().isAfter(Instant.now())) {
            throw new BusinessException(ErrorCode.EVALUATION_DEADLINE_PASSED);
        }
        List<F360Subject> subjects = subjectRepository.findByCampaignIdWithUser(campaignId);
        cycleGuard.assertInputsOpen(c, subjects);
        nominationService.autoApproveRemaining(c, subjects, me);
        subjects.forEach(s -> s.setStatus(F360SubjectStatus.COLLECTING));
        subjectRepository.saveAll(subjects);
        c.setStatus(F360CampaignStatus.OPEN);
        campaignRepository.save(c);
        log(c, null, me, "START", Map.of("subjects", subjects.size()));
        publishInvite(c, assignmentRepository.findByCampaignId(campaignId));
        return toResponse(c, true);
    }

    /**
     * Chiến dịch có ảnh hưởng điểm (§7.2): phải gắn kỳ, thang 5 (trục hành vi của ma trận là 1..5),
     * và mỗi kỳ chỉ một chiến dịch như vậy — hai chiến dịch cùng đổ điểm vào một trục thì không có
     * luật nào nói số nào thắng.
     */
    private void assertScoringLaunchable(F360Campaign c, F360Template template) {
        if (!Boolean.TRUE.equals(c.getOrganization().getFeedback360AffectsRating())) {
            throw new BusinessException(ErrorCode.ORGANIZATION_NOT_ALLOWED_F360_COUNT_TOWARD_CYCLE_2);
        }
        if (c.getKpiCycle() == null) {
            throw new BusinessException(ErrorCode.CAMPAIGN_COUNTS_TOWARD_RATING_MUST_LINKED_KPI);
        }
        if (template.getScaleMax() == null || template.getScaleMax() != 5) {
            throw new BusinessException(ErrorCode.CAMPAIGN_COUNTS_TOWARD_RATING_MUST_USE_1);
        }
        boolean clash = campaignRepository.findScoringByCycle(c.getKpiCycle().getId(), List.of(
                        F360CampaignStatus.NOMINATING, F360CampaignStatus.OPEN, F360CampaignStatus.CLOSED,
                        F360CampaignStatus.RELEASED))
                .stream().anyMatch(o -> !o.getId().equals(c.getId()));
        if (clash) {
            throw new BusinessException(ErrorCode.CYCLE_F360_CAMPAIGN_COUNTS_TOWARD_RATING, c.getKpiCycle().getName());
        }
    }

    /** Chụp câu hỏi của bộ vào chiến dịch — từ đây sửa bộ gốc không còn ảnh hưởng phiếu đã phát. */
    private void snapshotQuestions(F360Campaign c, F360Template template) {
        List<F360Question> questions = templateService.loadQuestions(template.getId());
        if (questions.stream().noneMatch(q -> q.getQuestionType() == F360QuestionType.RATING)) {
            throw new BusinessException(ErrorCode.QUESTION_SET_NO_SCORED_QUESTIONS);
        }
        List<F360CampaignQuestion> snap = questions.stream().map(q -> F360CampaignQuestion.builder()
                .campaign(c)
                .sourceQuestionId(q.getId())
                .competencyKey(q.getCompetency() != null ? q.getCompetency().getId() : null)
                .competencyName(q.getCompetency() != null ? q.getCompetency().getName() : null)
                .competencyWeight(q.getCompetency() != null ? q.getCompetency().getWeight() : null)
                .competencyPosition(q.getCompetency() != null ? q.getCompetency().getPosition() : null)
                .questionType(q.getQuestionType())
                .text(q.getText())
                .relationships(q.getRelationships())
                .required(q.getRequired())
                .allowNa(q.getAllowNa())
                .position(q.getPosition())
                .build()).toList();
        campaignQuestionRepository.saveAll(snap);
    }

    @Transactional
    public F360CampaignResponse extend(UUID campaignId, Instant dueAt) {
        User me = access.currentUser();
        F360Campaign c = requireCampaign(campaignId);
        access.requireManage(me, c.getOrganization());
        requireStatus(c, "extend", F360CampaignStatus.OPEN);
        Instant old = c.getDueAt();
        setDue(c, dueAt);
        campaignRepository.save(c);
        log(c, null, me, "EXTEND", Map.of("from", String.valueOf(old), "to", dueAt.toString()));
        return toResponse(c, true);
    }

    @Transactional
    public F360CampaignResponse close(UUID campaignId) {
        User me = access.currentUser();
        F360Campaign c = requireCampaign(campaignId);
        access.requireManage(me, c.getOrganization());
        closeInternal(c, me);
        // Bước tách liên kết chạy bulk update và clear persistence context — nạp lại trước khi map.
        return toResponse(requireCampaign(campaignId), true);
    }

    /**
     * OPEN → CLOSED: phiếu còn dở thành EXPIRED, tính và chụp kết quả. Dùng chung cho HR bấm tay
     * và lượt tự đóng khi quá hạn ({@code actor} null = hệ thống).
     */
    @Transactional
    public void closeInternal(F360Campaign c, User actor) {
        requireStatus(c, "close", F360CampaignStatus.OPEN);
        List<F360Assignment> assignments = assignmentRepository.findByCampaignId(c.getId());
        for (F360Assignment a : assignments) {
            if (a.getStatus().open()) a.setStatus(F360AssignmentStatus.EXPIRED);
        }
        assignmentRepository.saveAll(assignments);
        c.setStatus(F360CampaignStatus.CLOSED);
        c.setClosedAt(Instant.now());
        campaignRepository.save(c);
        reportService.computeAndSnapshot(c);
        // Tách liên kết SAU khi đã tính và chụp kết quả, trong cùng transaction (§6.3).
        int unlinked = unlinkJob.run(c);
        log(c, null, actor, "CLOSE", unlinked > 0 ? Map.of("unlinkedAnswers", unlinked) : null);
        events.publishEvent(new F360Events.SummaryRequestedEvent(c.getId(), null, actor != null ? actor.getEmail() : null));
    }

    /** HR bấm "Tạo lại tóm tắt" cho một người — không áp cho báo cáo của chính mình. */
    @Transactional
    public void regenerateSummary(UUID campaignId, UUID subjectId) {
        User me = access.currentUser();
        F360Campaign c = requireCampaign(campaignId);
        access.requireManage(me, c.getOrganization());
        F360Subject s = requireSubject(c, subjectId);
        access.assertNotSelfTarget(me, s);
        if (!F360AiSummaryService.enabled(c)) {
            throw new BusinessException(ErrorCode.CAMPAIGN_NOT_CLOSED_AI_SUMMARY_NOT_ENABLED);
        }
        events.publishEvent(new F360Events.SummaryRequestedEvent(c.getId(), s.getId(), me.getEmail()));
    }

    /**
     * CLOSED → OPEN, bắt buộc lý do và hạn mới. Phiếu hết hạn vì chưa nộp được làm tiếp (trừ khi
     * người chấm đã nghỉ); phiếu đã nộp giữ nguyên.
     */
    @Transactional
    public F360CampaignResponse reopen(UUID campaignId, String reason, Instant dueAt) {
        User me = access.currentUser();
        F360Campaign c = requireCampaign(campaignId);
        access.requireManage(me, c.getOrganization());
        requireStatus(c, "reopen", F360CampaignStatus.CLOSED);
        if (dueAt == null) throw new BusinessException(ErrorCode.CHOOSE_NEW_DEADLINE_WHEN_REOPENING_CAMPAIGN);
        setDue(c, dueAt);

        List<F360Assignment> revived = new ArrayList<>();
        for (F360Assignment a : assignmentRepository.findByCampaignId(c.getId())) {
            if (a.getStatus() != F360AssignmentStatus.EXPIRED) continue;
            User rater = a.getRater();
            if (rater.getDeletedAt() != null || rater.isPausedAccount()) continue;
            a.setStatus(answerRepository.existsByAssignmentId(a.getId())
                    ? F360AssignmentStatus.IN_PROGRESS : F360AssignmentStatus.PENDING);
            revived.add(a);
        }
        assignmentRepository.saveAll(revived);
        List<F360Subject> subjects = subjectRepository.findByCampaignIdWithUser(c.getId());
        cycleGuard.assertInputsOpen(c, subjects);
        subjects.forEach(s -> s.setStatus(F360SubjectStatus.COLLECTING));
        subjectRepository.saveAll(subjects);

        c.setStatus(F360CampaignStatus.OPEN);
        c.setClosedAt(null);
        campaignRepository.save(c);
        log(c, null, me, "REOPEN", Map.of("reason", reason));
        publishInvite(c, revived);
        return toResponse(c, true);
    }

    /** CLOSED → RELEASED: người được đánh giá xem được báo cáo của mình. */
    @Transactional
    public F360CampaignResponse release(UUID campaignId) {
        User me = access.currentUser();
        F360Campaign c = requireCampaign(campaignId);
        access.requireManage(me, c.getOrganization());
        requireStatus(c, "release", F360CampaignStatus.CLOSED);
        c.setStatus(F360CampaignStatus.RELEASED);
        c.setReleasedAt(Instant.now());
        campaignRepository.save(c);
        log(c, null, me, "RELEASE", null);
        events.publishEvent(new F360Events.ReportReleasedEvent(c.getId()));
        return toResponse(c, true);
    }

    // ============================================================
    // NỘI BỘ
    // ============================================================

    private void publishInvite(F360Campaign c, List<F360Assignment> assignments) {
        List<UUID> ids = assignments.stream().filter(a -> a.getStatus().open()).map(F360Assignment::getId).toList();
        if (!ids.isEmpty()) events.publishEvent(new F360Events.RatersInvitedEvent(c.getId(), ids));
    }

    private void requireView(User me, F360Campaign c) {
        access.requireEnabled(c.getOrganization());
        UUID orgId = c.getOrganization().getId();
        if (!access.canViewCampaigns(me, orgId)) {
            throw new ForbiddenException(ErrorCode.NO_PERMISSION_VIEW_F360_CAMPAIGNS_2);
        }
        if (c.getStatus() == F360CampaignStatus.DRAFT && !access.canManage(me, orgId)) {
            throw new ForbiddenException(ErrorCode.CAMPAIGN_NOT_STARTED);
        }
    }

    private void requireStatus(F360Campaign c, String action, F360CampaignStatus... allowed) {
        if (!Arrays.asList(allowed).contains(c.getStatus())) {
            throw new BusinessException(ErrorCode.CANNOT_WHILE_CAMPAIGN_STATUS, Terms.of("f360.action." + action), statusLabel(c.getStatus()));
        }
    }

    static String statusLabel(F360CampaignStatus s) {
        return switch (s) {
            case DRAFT -> ErrorMessages.text("f360.status.DRAFT", "");
            case NOMINATING -> ErrorMessages.text("f360.status.NOMINATING", "");
            case OPEN -> ErrorMessages.text("f360.status.OPEN", "");
            case CLOSED -> ErrorMessages.text("f360.status.CLOSED", "");
            case RELEASED -> ErrorMessages.text("f360.status.RELEASED", "");
        };
    }

    private F360CampaignResponse toResponse(F360Campaign c, boolean canManage) {
        F360CampaignResponse res = mapper.toCampaignResponse(c);
        Map<String, Double> weights = new LinkedHashMap<>();
        F360Settings.weights(c).forEach((k, v) -> weights.put(k.name(), v));
        res.setRelationshipWeights(weights);
        F360Settings.RaterRules rules = F360Settings.raterRules(c);
        res.setMaxPeers(rules.maxPeers());
        res.setMaxDirectReports(rules.maxDirectReports());
        res.setMaxAssignmentsPerRater(rules.maxAssignmentsPerRater());
        res.setMaxNominees(rules.maxNominees());
        res.setAiSummary(F360Settings.reportSettings(c).aiSummary());
        res.setOrgAllowsRating(Boolean.TRUE.equals(c.getOrganization().getFeedback360AffectsRating()));

        List<F360Assignment> assignments = assignmentRepository.findByCampaignId(c.getId()).stream()
                .filter(a -> a.getStatus() != F360AssignmentStatus.REMOVED).toList();
        res.setSubjectCount(subjectRepository.findByCampaignIdWithUser(c.getId()).size());
        res.setAssignmentCount(assignments.size());
        res.setSubmittedCount((int) assignments.stream().filter(a -> a.getStatus() == F360AssignmentStatus.SUBMITTED).count());
        res.setCanManage(canManage);
        // Tóm tắt câu hỏi cho thẻ chiến dịch; xem đầy đủ qua GET /campaigns/{id}/questions.
        F360TemplateResponse q = buildQuestions(c);
        res.setCompetencyNames(q.getCompetencies().stream().map(F360TemplateResponse.Competency::getName).toList());
        res.setQuestionCount(q.getCompetencies().stream().mapToInt(x -> x.getQuestions().size()).sum() + q.getOpenQuestions().size());
        return res;
    }

    private F360SubjectRowResponse toRow(F360Campaign c, F360Subject s, List<F360Assignment> assignments) {
        Map<F360Relationship, int[]> counts = new EnumMap<>(F360Relationship.class);
        for (F360Assignment a : assignments) {
            if (a.getStatus() == F360AssignmentStatus.REMOVED) continue;
            int[] cell = counts.computeIfAbsent(a.getRelationship(), x -> new int[2]);
            cell[1]++;
            if (a.getStatus() == F360AssignmentStatus.SUBMITTED) cell[0]++;
        }
        List<F360SubjectRowResponse.Progress> progress = new ArrayList<>();
        counts.forEach((rel, cell) -> progress.add(F360SubjectRowResponse.Progress.builder()
                .relationship(rel).submitted(cell[0]).total(cell[1]).build()));

        // Cảnh báo chỉ có nghĩa khi còn sửa được danh sách người chấm.
        List<String> warnings = new ArrayList<>();
        if (c.getStatus() == F360CampaignStatus.DRAFT || c.getStatus() == F360CampaignStatus.OPEN) {
            int k = c.getAnonymityThreshold();
            if (!counts.containsKey(F360Relationship.MANAGER)) warnings.add(ErrorMessages.text("f360.warning.noManager", ""));
            for (F360Relationship r : List.of(F360Relationship.PEER, F360Relationship.DIRECT_REPORT)) {
                int total = counts.getOrDefault(r, new int[2])[1];
                if (total > 0 && total < k) {
                    warnings.add(ErrorMessages.text("f360.warning.groupTooSmall", "", r.label(), total, k));
                }
            }
            if (counts.keySet().stream().allMatch(r -> r == F360Relationship.SELF)) warnings.add(ErrorMessages.text("f360.warning.noRaters", ""));
        }

        int total = counts.values().stream().mapToInt(x -> x[1]).sum();
        int submitted = counts.values().stream().mapToInt(x -> x[0]).sum();
        return F360SubjectRowResponse.builder()
                .id(s.getId())
                .userId(s.getUser().getId())
                .fullName(s.getUser().getFullName())
                .email(s.getUser().getEmail())
                .avatarUrl(s.getUser().getAvatarUrl())
                .orgUnitId(s.getOrgUnit() != null ? s.getOrgUnit().getId() : null)
                .orgUnitName(s.getOrgUnit() != null ? s.getOrgUnit().getName() : null)
                .status(s.getStatus())
                .overallScore(c.getStatus().hasResults() ? s.getOverallScore() : null)
                .submittedCount(submitted)
                .assignmentCount(total)
                .progress(progress)
                .warnings(warnings)
                .build();
    }

    private void log(F360Campaign c, F360Subject s, User actor, String action, Map<String, ?> detail) {
        eventRepository.save(F360Event.builder()
                .campaign(c).subject(s).actor(actor).action(action)
                .detail(detail == null ? null : F360Settings.write(detail))
                .build());
    }

    private Organization requireOrg(UUID organizationId) {
        return organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.organization"), "id", organizationId));
    }

    F360Campaign requireCampaign(UUID campaignId) {
        return campaignRepository.findById(campaignId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.f360Campaign"), "id", campaignId));
    }

    private F360Subject requireSubject(F360Campaign c, UUID subjectId) {
        return subjectRepository.findById(subjectId)
                .filter(s -> s.getCampaign().getId().equals(c.getId()))
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.reviewee"), "id", subjectId));
    }

    private F360Assignment requireAssignment(F360Campaign c, UUID assignmentId) {
        return assignmentRepository.findById(assignmentId)
                .filter(a -> a.getSubject().getCampaign().getId().equals(c.getId()))
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.evaluationForm"), "id", assignmentId));
    }
}
