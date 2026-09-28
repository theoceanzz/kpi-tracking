package com.kpitracking.service.feedback360;

import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.dto.request.feedback360.F360ApprovalRequest;
import com.kpitracking.dto.response.feedback360.F360NominationResponse;
import com.kpitracking.entity.*;
import com.kpitracking.enums.*;
import com.kpitracking.event.F360Events;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.Terms;
import com.kpitracking.repository.*;
import com.kpitracking.security.PermissionChecker;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/**
 * Giai đoạn đề cử (§4.1, §5.3): người được đánh giá xem danh sách người chấm ĐỀ XUẤT và đề cử thêm,
 * người duyệt thêm/gỡ/thay rồi duyệt.
 *
 * <p>Ngoại lệ ẩn danh có chủ đích (§6.2): chỉ trong NOMINATING, subject thấy danh sách đề xuất — nó
 * chưa phải danh sách cuối và cho biết ai CÓ THỂ chấm, không cho biết ai ĐÃ chấm gì. Từ lúc
 * {@code start}, mọi endpoint ở đây trả 403 cho subject.
 *
 * <p>Người duyệt (§5.2): cấp trên trực tiếp → một người MANAGE khác subject (ưu tiên người tạo chiến
 * dịch) → không có ai thì tự duyệt lúc {@code start}. Không bao giờ là chính subject.
 */
@Service
@RequiredArgsConstructor
public class F360NominationService {

    private final F360SubjectRepository subjectRepository;
    private final F360AssignmentRepository assignmentRepository;
    private final F360EventRepository eventRepository;
    private final UserRepository userRepository;
    private final F360RaterSuggestionService raterSuggestion;
    private final F360AccessPolicy access;
    private final PermissionChecker permissionChecker;
    private final ApplicationEventPublisher events;

    // ============================================================
    // PHÍA NGƯỜI ĐƯỢC ĐÁNH GIÁ
    // ============================================================

    @Transactional(readOnly = true)
    public List<F360NominationResponse> myNominations() {
        User me = access.currentUser();
        return subjectRepository.findNominatingOf(me.getId()).stream()
                .filter(s -> Boolean.TRUE.equals(s.getCampaign().getOrganization().getEnableFeedback360()))
                .map(this::toResponse)
                .toList();
    }

    /** Đề cử: danh sách gửi lên THAY THẾ các đề cử trước (chỉ phiếu NOMINATED của chính mình). */
    @Transactional
    public F360NominationResponse nominate(UUID subjectId, List<UUID> raterIds) {
        User me = access.currentUser();
        F360Subject s = requireSubject(subjectId);
        if (!access.isSelf(me, s)) throw new ForbiddenException(ErrorCode.CAN_ONLY_NOMINATE_YOURSELF);
        F360Campaign c = s.getCampaign();
        access.requireEnabled(c.getOrganization());
        requireNominating(c);
        if (s.getStatus() == F360SubjectStatus.APPROVED) {
            throw new BusinessException(ErrorCode.RATER_LIST_APPROVED);
        }

        F360Settings.RaterRules rules = F360Settings.raterRules(c);
        List<UUID> wanted = raterIds == null ? List.of() : raterIds.stream().distinct().filter(id -> !id.equals(me.getId())).toList();
        if (wanted.size() > rules.maxNominees()) {
            throw new BusinessException(ErrorCode.CAN_NOMINATE_MOST_PEOPLE, String.valueOf(rules.maxNominees()));
        }

        List<F360Assignment> current = assignmentRepository.findBySubjectId(s.getId());
        Set<UUID> existingOthers = new HashSet<>();
        for (F360Assignment a : current) {
            if (a.getSource() == F360RaterSource.NOMINATED && !wanted.contains(a.getRater().getId())) {
                assignmentRepository.delete(a); // chưa ai chấm (đang đề cử), xoá hẳn
            } else if (a.getStatus() != F360AssignmentStatus.REMOVED) {
                existingOthers.add(a.getRater().getId());
            }
        }

        F360RaterSuggestionService.OrgSnapshot org = raterSuggestion.snapshot(c.getOrganization().getId());
        for (UUID rid : wanted) {
            if (existingOthers.contains(rid)) continue;
            User rater = org.user(rid);
            if (rater == null) throw new BusinessException(ErrorCode.NOMINEE_OUTSIDE_ORGANIZATION_LEFT);
            F360Assignment a = assignmentRepository.findBySubjectIdAndRaterId(s.getId(), rid)
                    .orElseGet(() -> F360Assignment.builder().subject(s).rater(rater).build());
            a.setRelationship(raterSuggestion.inferNominee(org, me.getId(), rid));
            a.setSource(F360RaterSource.NOMINATED);
            a.setStatus(F360AssignmentStatus.PENDING);
            assignmentRepository.save(a);
        }

        s.setStatus(F360SubjectStatus.NOMINATION_SUBMITTED);
        s.setNominationSubmittedAt(Instant.now());
        subjectRepository.save(s);
        log(c, s, me, "NOMINATE", Map.of("count", wanted.size()));
        events.publishEvent(new F360Events.NominationSubmittedEvent(s.getId()));
        return toResponse(s);
    }

    // ============================================================
    // PHÍA NGƯỜI DUYỆT
    // ============================================================

    @Transactional(readOnly = true)
    public List<F360NominationResponse> pendingApprovals() {
        User me = access.currentUser();
        return subjectRepository.findPendingApprovals(me.getId()).stream()
                .filter(s -> Boolean.TRUE.equals(s.getCampaign().getOrganization().getEnableFeedback360()))
                .map(this::toResponse)
                .toList();
    }

    /** Người duyệt (hoặc HR có MANAGE) thêm/gỡ người chấm rồi duyệt. Subject là chính mình → 403. */
    @Transactional
    public F360NominationResponse approve(UUID subjectId, F360ApprovalRequest request) {
        User me = access.currentUser();
        F360Subject s = requireSubject(subjectId);
        F360Campaign c = s.getCampaign();
        access.requireEnabled(c.getOrganization());
        access.assertNotSelfTarget(me, s);
        requireNominating(c);
        boolean isApprover = s.getApprover() != null && s.getApprover().getId().equals(me.getId());
        if (!isApprover && !access.canManage(me, c.getOrganization().getId())) {
            throw new ForbiddenException(ErrorCode.NOT_NOMINATION_APPROVER_PERSON);
        }

        if (request.getRemove() != null) {
            for (UUID aid : request.getRemove()) {
                F360Assignment a = assignmentRepository.findById(aid)
                        .filter(x -> x.getSubject().getId().equals(s.getId()))
                        .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.form"), "id", aid));
                if (a.getRelationship() == F360Relationship.SELF) throw new BusinessException(ErrorCode.SELF_ASSESSMENT_CANNOT_REMOVED);
                assignmentRepository.delete(a);
            }
            assignmentRepository.flush();
        }
        if (request.getAdd() != null) {
            for (F360ApprovalRequest.Addition add : request.getAdd()) {
                if (add.getRaterId() == null || add.getRelationship() == null
                        || add.getRelationship() == F360Relationship.SELF || add.getRaterId().equals(s.getUser().getId())) {
                    throw new BusinessException(ErrorCode.ADDED_RATER_INVALID);
                }
                User rater = userRepository.findById(add.getRaterId())
                        .filter(u -> u.getDeletedAt() == null && !u.isPausedAccount())
                        .filter(u -> access.organizationsOf(u).contains(c.getOrganization().getId()))
                        .orElseThrow(() -> new BusinessException(ErrorCode.RATER_OUTSIDE_ORGANIZATION_LEFT));
                F360Assignment a = assignmentRepository.findBySubjectIdAndRaterId(s.getId(), rater.getId())
                        .orElseGet(() -> F360Assignment.builder().subject(s).rater(rater).build());
                a.setRelationship(add.getRelationship());
                a.setSource(F360RaterSource.ADDED);
                a.setStatus(F360AssignmentStatus.PENDING);
                assignmentRepository.save(a);
            }
        }
        if (Boolean.TRUE.equals(request.getApprove())) {
            s.setStatus(F360SubjectStatus.APPROVED);
            s.setApprovedAt(Instant.now());
            subjectRepository.save(s);
            log(c, s, me, "APPROVE_NOMINATION", null);
        }
        return toResponse(s);
    }

    // ============================================================
    // DÙNG CHUNG VỚI VÒNG ĐỜI CHIẾN DỊCH
    // ============================================================

    /**
     * Chọn người duyệt cho mọi subject lúc chiến dịch vào NOMINATING. Người duyệt không bao giờ là
     * chính subject; không tìm được ai thì để null ⇒ tự duyệt lúc {@code start}.
     */
    public void assignApprovers(F360Campaign c, List<F360Subject> subjects) {
        F360RaterSuggestionService.OrgSnapshot org = raterSuggestion.snapshot(c.getOrganization().getId());
        List<User> managers = null; // nạp lười — chỉ cần khi có người không có cấp trên
        for (F360Subject s : subjects) {
            UUID sid = s.getUser().getId();
            User approver = raterSuggestion.managerOf(org, sid);
            if (approver == null || approver.getId().equals(sid)) {
                if (managers == null) managers = manageUsers(c, org);
                approver = managers.stream().filter(u -> !u.getId().equals(sid)).findFirst().orElse(null);
            }
            s.setApprover(approver);
            s.setStatus(F360SubjectStatus.NOMINATING);
        }
        subjectRepository.saveAll(subjects);
    }

    /**
     * Lúc {@code start}: ai chưa được duyệt thì tự duyệt, ghi {@code AUTO_APPROVE}. Không subject nào
     * còn kẹt ở NOMINATING/NOMINATION_SUBMITTED sau bước này.
     */
    public void autoApproveRemaining(F360Campaign c, List<F360Subject> subjects, User actor) {
        for (F360Subject s : subjects) {
            if (s.getStatus() == F360SubjectStatus.APPROVED) continue;
            s.setStatus(F360SubjectStatus.APPROVED);
            s.setApprovedAt(Instant.now());
            log(c, s, actor, "AUTO_APPROVE", Map.of("reason", s.getApprover() == null
                    ? ErrorMessages.text("f360.nomination.noApprover", "") : ErrorMessages.text("f360.nomination.notApprovedBeforeStart", "")));
        }
        subjectRepository.saveAll(subjects);
    }

    /** Người có quyền MANAGE trong tổ chức, người tạo chiến dịch đứng đầu, rồi theo hạng lãnh đạo. */
    private List<User> manageUsers(F360Campaign c, F360RaterSuggestionService.OrgSnapshot org) {
        List<User> out = new ArrayList<>();
        User creator = c.getCreatedBy();
        if (creator != null && permissionChecker.hasPermission(creator.getId(), F360AccessPolicy.MANAGE)) out.add(creator);
        org.users.values().stream()
                .sorted(Comparator.comparingInt(u -> org.primaryRankOf.getOrDefault(u.getId(), 9)))
                .filter(u -> creator == null || !u.getId().equals(creator.getId()))
                .filter(u -> permissionChecker.hasPermission(u.getId(), F360AccessPolicy.MANAGE))
                .limit(3)
                .forEach(out::add);
        return out;
    }

    // ============================================================
    // NỘI BỘ
    // ============================================================

    private void requireNominating(F360Campaign c) {
        if (c.getStatus() != F360CampaignStatus.NOMINATING) {
            throw new ForbiddenException(ErrorCode.CAMPAIGN_NO_LONGER_NOMINATION_PHASE);
        }
    }

    private F360Subject requireSubject(UUID subjectId) {
        return subjectRepository.findById(subjectId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.reviewee"), "id", subjectId));
    }

    private F360NominationResponse toResponse(F360Subject s) {
        F360Campaign c = s.getCampaign();
        List<F360NominationResponse.Rater> raters = assignmentRepository.findBySubjectId(s.getId()).stream()
                .filter(a -> a.getStatus() != F360AssignmentStatus.REMOVED && a.getRelationship() != F360Relationship.SELF)
                .sorted(Comparator.comparingInt((F360Assignment a) -> a.getRelationship().priority()))
                .map(a -> F360NominationResponse.Rater.builder()
                        .assignmentId(a.getId())
                        .raterId(a.getRater().getId())
                        .name(a.getRater().getFullName())
                        .avatarUrl(a.getRater().getAvatarUrl())
                        .relationship(a.getRelationship())
                        .source(a.getSource())
                        .build())
                .toList();
        return F360NominationResponse.builder()
                .subjectId(s.getId())
                .campaignId(c.getId())
                .campaignName(c.getName())
                .nominationDeadline(c.getNominationDeadline())
                .status(s.getStatus())
                .maxNominees(F360Settings.raterRules(c).maxNominees())
                .submittedAt(s.getNominationSubmittedAt())
                .approverName(s.getApprover() != null ? s.getApprover().getFullName() : null)
                .subjectUserId(s.getUser().getId())
                .subjectName(s.getUser().getFullName())
                .subjectAvatarUrl(s.getUser().getAvatarUrl())
                .orgUnitName(s.getOrgUnit() != null ? s.getOrgUnit().getName() : null)
                .raters(raters)
                .build();
    }

    private void log(F360Campaign c, F360Subject s, User actor, String action, Map<String, ?> detail) {
        eventRepository.save(F360Event.builder()
                .campaign(c).subject(s).actor(actor).action(action)
                .detail(detail == null ? null : F360Settings.write(detail))
                .build());
    }
}
