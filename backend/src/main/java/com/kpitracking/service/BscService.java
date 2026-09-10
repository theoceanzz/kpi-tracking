package com.kpitracking.service;

import com.kpitracking.dto.request.bsc.PerspectiveRequest;
import com.kpitracking.dto.request.bsc.ScorecardPerspectiveWeightRequest;
import com.kpitracking.dto.request.bsc.ScorecardRequest;
import com.kpitracking.dto.response.bsc.ImportBscResponse;
import com.kpitracking.dto.response.bsc.PerspectiveResponse;
import com.kpitracking.dto.response.bsc.ScorecardOrgUnitResponse;
import com.kpitracking.dto.response.bsc.ScorecardPeriodResponse;
import com.kpitracking.dto.response.bsc.ScorecardPerspectiveResponse;
import com.kpitracking.dto.response.bsc.ScorecardResponse;
import com.kpitracking.entity.BscPerspective;
import com.kpitracking.entity.BscScorecard;
import com.kpitracking.entity.BscScorecardPerspective;
import com.kpitracking.entity.BscWeightHistory;
import com.kpitracking.entity.KpiCycle;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.enums.BscFixedPerspective;
import com.kpitracking.enums.BscPerspectiveStatus;
import com.kpitracking.enums.BscScorecardApplyScope;
import com.kpitracking.enums.BscScorecardLevel;
import com.kpitracking.enums.BscScorecardStatus;
import com.kpitracking.enums.BscScoringMode;
import com.kpitracking.enums.CodeType;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.DuplicateResourceException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.BscPerspectiveRepository;
import com.kpitracking.repository.BscScorecardPerspectiveRepository;
import com.kpitracking.repository.BscScorecardRepository;
import com.kpitracking.repository.BscWeightHistoryRepository;
import com.kpitracking.repository.KpiCycleRepository;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BscService {

    private final BscPerspectiveRepository perspectiveRepository;
    private final OrganizationRepository organizationRepository;
    private final BscScorecardRepository scorecardRepository;
    private final BscScorecardPerspectiveRepository scorecardPerspectiveRepository;
    private final BscWeightHistoryRepository weightHistoryRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final KpiCycleRepository kpiCycleRepository;
    private final UserRepository userRepository;
    private final com.kpitracking.repository.OrgUnitRepository orgUnitRepository;
    private final com.kpitracking.repository.BscFixedPerspectiveRepository fixedPerspectiveRepository;
    private final OrgCodeRuleService orgCodeRuleService;
    private final BscAccessGuard accessGuard;

    // ============================================================
    // Perspectives (lĩnh vực) — danh mục cấu hình theo org
    // ============================================================

    @Transactional(readOnly = true)
    public List<PerspectiveResponse> getPerspectives(UUID organizationId) {
        return perspectiveRepository.findByOrganizationIdOrderByDisplayOrderAsc(organizationId).stream()
                .map(this::mapToPerspectiveResponse)
                .collect(Collectors.toList());
    }

    /** 4 lĩnh vực BSC cố định của MỘT tổ chức (tự động khởi tạo từ mặc định nếu org chưa có). */
    @Transactional
    public List<com.kpitracking.dto.response.bsc.FixedPerspectiveResponse> getFixedPerspectives(UUID organizationId) {
        List<com.kpitracking.entity.BscFixedPerspectiveEntity> rows =
                fixedPerspectiveRepository.findByOrganizationIdOrderByDisplayOrderAsc(organizationId);
        if (rows.isEmpty()) {
            rows = seedDefaultFixedPerspectives(organizationId);
        }
        return rows.stream()
                .map(fp -> com.kpitracking.dto.response.bsc.FixedPerspectiveResponse.builder()
                        .code(fp.getCode())
                        .name(fp.getName())
                        .color(fp.getColor())
                        .displayOrder(fp.getDisplayOrder() != null ? fp.getDisplayOrder() : 0)
                        .build())
                .collect(Collectors.toList());
    }

    /** Sửa hiển thị (tên/màu/thứ tự) 1 lĩnh vực cố định theo org. Mã (code) cố định. */
    @Transactional
    public com.kpitracking.dto.response.bsc.FixedPerspectiveResponse updateFixedPerspective(
            UUID organizationId, String code,
            com.kpitracking.dto.request.bsc.FixedPerspectiveUpdateRequest request) {
        // Kiểm tra code hợp lệ (đúng 1 trong 4 enum) để không tạo dữ liệu rác.
        try {
            BscFixedPerspective.valueOf(code);
        } catch (IllegalArgumentException e) {
            throw new ResourceNotFoundException("Lĩnh vực cố định", "mã", code);
        }
        com.kpitracking.entity.BscFixedPerspectiveEntity fp = fixedPerspectiveRepository
                .findByOrganizationIdAndCode(organizationId, code)
                .orElseGet(() -> {
                    seedDefaultFixedPerspectives(organizationId);
                    return fixedPerspectiveRepository.findByOrganizationIdAndCode(organizationId, code)
                            .orElseThrow(() -> new ResourceNotFoundException("Lĩnh vực cố định", "mã", code));
                });

        fp.setName(request.getName().trim());
        if (request.getColor() != null && !request.getColor().isBlank()) {
            fp.setColor(request.getColor());
        }
        if (request.getDisplayOrder() != null) {
            fp.setDisplayOrder(request.getDisplayOrder());
        }
        com.kpitracking.entity.BscFixedPerspectiveEntity saved = fixedPerspectiveRepository.save(fp);
        return com.kpitracking.dto.response.bsc.FixedPerspectiveResponse.builder()
                .code(saved.getCode())
                .name(saved.getName())
                .color(saved.getColor())
                .displayOrder(saved.getDisplayOrder() != null ? saved.getDisplayOrder() : 0)
                .build();
    }

    /** Tạo 4 lĩnh vực cố định mặc định (từ enum) cho org chưa có bản ghi nào. */
    private List<com.kpitracking.entity.BscFixedPerspectiveEntity> seedDefaultFixedPerspectives(UUID organizationId) {
        List<com.kpitracking.entity.BscFixedPerspectiveEntity> defaults = new ArrayList<>();
        for (BscFixedPerspective def : BscFixedPerspective.values()) {
            defaults.add(com.kpitracking.entity.BscFixedPerspectiveEntity.builder()
                    .organizationId(organizationId)
                    .code(def.name())
                    .name(def.getDisplayName())
                    .color(def.getColor())
                    .displayOrder(def.getDisplayOrder())
                    .build());
        }
        return fixedPerspectiveRepository.saveAll(defaults);
    }

    @Transactional
    public PerspectiveResponse createPerspective(UUID organizationId, PerspectiveRequest request) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization not found"));

        String code = orgCodeRuleService.resolveOnCreate(organization, CodeType.BSC_PERSPECTIVE,
                request.getCode(), null, null);

        validateNotReservedCode(code);
        if (perspectiveRepository.existsByOrganizationIdAndCode(organizationId, code)) {
            throw new DuplicateResourceException("Hạng mục", "mã", code);
        }

        int displayOrder = request.getDisplayOrder() != null ? request.getDisplayOrder() : 0;
        if (perspectiveRepository.existsByOrganizationIdAndFixedPerspectiveAndDisplayOrder(
                organizationId, request.getFixedPerspective(), displayOrder)) {
            throw new DuplicateResourceException("Hạng mục", "thứ tự hiển thị (trong lĩnh vực)", displayOrder);
        }

        requirePerspectiveMeasurement(request);
        validatePerspectiveTargets(request.getTargetValue(), request.getMinimumValue(), request.getName());

        BscPerspective perspective = BscPerspective.builder()
                .organization(organization)
                .code(code)
                .name(request.getName())
                .description(request.getDescription())
                .targetValue(request.getTargetValue())
                .minimumValue(request.getMinimumValue())
                .unit(trimToNull(request.getUnit()))
                .color(request.getColor())
                .icon(request.getIcon())
                .displayOrder(displayOrder)
                .status(request.getStatus() != null ? request.getStatus() : BscPerspectiveStatus.ACTIVE)
                .fixedPerspective(request.getFixedPerspective())
                .build();

        return mapToPerspectiveResponse(perspectiveRepository.save(perspective));
    }

    @Transactional
    public PerspectiveResponse updatePerspective(UUID perspectiveId, PerspectiveRequest request) {
        BscPerspective perspective = perspectiveRepository.findById(perspectiveId)
                .orElseThrow(() -> new ResourceNotFoundException("Perspective not found"));

        // Mã sinh tự động và tổ chức không cho ghi đè ⇒ giữ nguyên mã cũ, bỏ qua giá trị gửi lên.
        String code = orgCodeRuleService.resolveOnUpdate(perspective.getOrganization().getId(),
                CodeType.BSC_PERSPECTIVE, request.getCode(), perspective.getCode());

        validateNotReservedCode(code);
        if (perspectiveRepository.existsByOrganizationIdAndCodeAndIdNot(
                perspective.getOrganization().getId(), code, perspectiveId)) {
            throw new DuplicateResourceException("Hạng mục", "mã", code);
        }

        // Lĩnh vực hiệu lực khi kiểm trùng: ưu tiên giá trị gửi lên, nếu không thì giữ giá trị hiện tại.
        BscFixedPerspective effectiveFixed = request.getFixedPerspective() != null
                ? request.getFixedPerspective() : perspective.getFixedPerspective();
        if (request.getDisplayOrder() != null
                && perspectiveRepository.existsByOrganizationIdAndFixedPerspectiveAndDisplayOrderAndIdNot(
                        perspective.getOrganization().getId(), effectiveFixed, request.getDisplayOrder(), perspectiveId)) {
            throw new DuplicateResourceException("Hạng mục", "thứ tự hiển thị (trong lĩnh vực)", request.getDisplayOrder());
        }

        requirePerspectiveMeasurement(request);
        validatePerspectiveTargets(request.getTargetValue(), request.getMinimumValue(), request.getName());

        perspective.setCode(code);
        perspective.setName(request.getName());
        perspective.setDescription(request.getDescription());
        perspective.setTargetValue(request.getTargetValue());
        perspective.setMinimumValue(request.getMinimumValue());
        perspective.setUnit(trimToNull(request.getUnit()));
        perspective.setColor(request.getColor());
        perspective.setIcon(request.getIcon());
        if (request.getFixedPerspective() != null) {
            perspective.setFixedPerspective(request.getFixedPerspective());
        }
        if (request.getDisplayOrder() != null) {
            perspective.setDisplayOrder(request.getDisplayOrder());
        }
        if (request.getStatus() != null) {
            perspective.setStatus(request.getStatus());
        }

        return mapToPerspectiveResponse(perspectiveRepository.save(perspective));
    }

    @Transactional
    public void deletePerspective(UUID perspectiveId) {
        BscPerspective perspective = perspectiveRepository.findById(perspectiveId)
                .orElseThrow(() -> new ResourceNotFoundException("Perspective not found"));
        // Soft-delete: KPI đã gán lĩnh vực này sẽ được DB set NULL (ON DELETE SET NULL không chạy khi soft-delete),
        // nên chỉ đánh dấu xoá mềm để giữ lịch sử điểm.
        perspective.setDeletedAt(Instant.now());
        perspectiveRepository.save(perspective);
    }

    // ============================================================
    // Scorecards (bộ tiêu chí) — mỗi org + kỳ một bản, kèm trọng số lĩnh vực
    // ============================================================

    @Transactional(readOnly = true)
    public List<ScorecardResponse> getScorecards(UUID organizationId) {
        return scorecardRepository.findByOrganizationIdOrderByCreatedAtDesc(organizationId).stream()
                .map(this::mapToScorecardResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ScorecardResponse getScorecardById(UUID scorecardId) {
        return mapToScorecardResponse(scorecardRepository.findById(scorecardId)
                .orElseThrow(() -> new ResourceNotFoundException("Scorecard not found")));
    }

    @Transactional
    public ScorecardResponse createScorecard(UUID organizationId, ScorecardRequest request) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization not found"));
        ScopeSelection scope = resolveScopeSelection(organizationId, request);
        List<OrgUnit> orgUnits = resolveRequestOrgUnits(organizationId, request.getOrgUnitIds());
        accessGuard.assertCanEdit(orgUnits);
        validateNoScopeClash(organizationId, orgUnits, scope, null);
        validateWeights(request.getPerspectives());

        BscScorecard scorecard = BscScorecard.builder()
                .organization(organization)
                .orgUnits(orgUnits)
                .level(resolveLevel(orgUnits))
                .parentScorecard(resolveParent(organizationId, request.getParentScorecardId(), resolveLevel(orgUnits), null))
                .applyScope(scope.applyScope())
                .kpiPeriods(new ArrayList<>(scope.periods()))
                .kpiCycle(scope.cycle())
                .name(request.getName())
                .vision(request.getVision())
                // Trạng thái KHÔNG nhận từ client trừ khi người tạo có quyền duyệt: bộ tiêu chí mới
                // phải bắt đầu ở NHÁP rồi đi qua trình – duyệt, không thì luồng duyệt vô nghĩa.
                .status(accessGuard.canApprove() && request.getStatus() != null
                        ? request.getStatus() : BscScorecardStatus.DRAFT)
                .scoringMode(request.getScoringMode() != null ? request.getScoringMode() : BscScoringMode.SHADOW)
                .emptyPerspectivePolicy(request.getEmptyPerspectivePolicy() != null
                        ? request.getEmptyPerspectivePolicy()
                        : com.kpitracking.enums.BscEmptyPerspectivePolicy.RENORMALIZE)
                .build();
        scorecard = scorecardRepository.save(scorecard);

        User currentUser = getCurrentUserOrNull();
        if (request.getPerspectives() != null) {
            for (ScorecardPerspectiveWeightRequest item : request.getPerspectives()) {
                BscPerspective perspective = perspectiveRepository.findById(item.getPerspectiveId())
                        .orElseThrow(() -> new ResourceNotFoundException("Hạng mục", "id", item.getPerspectiveId()));
                BscScorecardPerspective sp = BscScorecardPerspective.builder()
                        .scorecard(scorecard)
                        .perspective(perspective)
                        .weightPercentage(item.getWeightPercentage() != null ? item.getWeightPercentage() : 0.0)
                        .displayOrder(item.getDisplayOrder() != null ? item.getDisplayOrder() : perspective.getDisplayOrder())
                        .build();
                applyRowTargets(sp, item, perspective, true);
                applyRowConfig(sp, item, false);
                sp.setCreatedBy(currentUser);
                scorecardPerspectiveRepository.save(sp);
                logWeightChange(scorecard, perspective, null, sp.getWeightPercentage(), currentUser, item.getReason());
            }
        }
        return mapToScorecardResponse(scorecardRepository.findById(scorecard.getId()).orElseThrow());
    }

    @Transactional
    public ScorecardResponse updateScorecard(UUID scorecardId, ScorecardRequest request) {
        BscScorecard scorecard = scorecardRepository.findById(scorecardId)
                .orElseThrow(() -> new ResourceNotFoundException("Scorecard not found"));
        accessGuard.assertCanEdit(scorecard);
        validateWeights(request.getPerspectives());

        // Phạm vi thời gian (đợt/kỳ) sửa được; phạm vi phòng ban thì không. Bỏ qua nếu client
        // không gửi gì về thời gian để các client cũ chỉ sửa trọng số vẫn chạy.
        if (request.getApplyScope() != null
                || request.getKpiCycleId() != null
                || (request.getKpiPeriodIds() != null && !request.getKpiPeriodIds().isEmpty())) {
            UUID orgId = scorecard.getOrganization().getId();
            ScopeSelection scope = resolveScopeSelection(orgId, request);
            validateNoScopeClash(orgId, scorecard.getOrgUnits(), scope, scorecardId);
            scorecard.setApplyScope(scope.applyScope());
            scorecard.setKpiCycle(scope.cycle());
            scorecard.getKpiPeriods().clear();
            scorecard.getKpiPeriods().addAll(scope.periods());
        }

        scorecard.setName(request.getName());
        scorecard.setVision(request.getVision());
        // Phòng ban của thẻ không sửa được qua API này, nhưng cấp vẫn tính lại để dữ liệu tạo
        // trước migration (hoặc sửa thẳng DB) tự về đúng luật.
        scorecard.setLevel(resolveLevel(scorecard.getOrgUnits()));
        if (request.getParentScorecardId() != null) {
            scorecard.setParentScorecard(resolveParent(scorecard.getOrganization().getId(),
                    request.getParentScorecardId(), scorecard.getLevel(), scorecardId));
        }
        // Đổi trạng thái là việc của luồng trình – duyệt (submit/approve/lock), không phải của form
        // sửa. Form chỉ còn đặt được khi thẻ CHƯA vào luồng — nháp hoặc đã lưu trữ; thẻ đang áp
        // dụng mà kéo ngược về nháp trong form thì bước duyệt thành hình thức, và người đang chấm
        // điểm theo thẻ đó không hề biết nó vừa bị rút lại.
        boolean statusEditable = scorecard.getStatus() == BscScorecardStatus.DRAFT
                || scorecard.getStatus() == BscScorecardStatus.ARCHIVED;
        if (request.getStatus() != null && statusEditable && accessGuard.canApprove()) {
            scorecard.setStatus(request.getStatus());
        }
        if (request.getScoringMode() != null) scorecard.setScoringMode(request.getScoringMode());
        if (request.getEmptyPerspectivePolicy() != null) scorecard.setEmptyPerspectivePolicy(request.getEmptyPerspectivePolicy());

        User currentUser = getCurrentUserOrNull();
        if (request.getPerspectives() != null) {
            List<BscScorecardPerspective> existing = scorecardPerspectiveRepository.findByScorecardIdOrderByDisplayOrderAsc(scorecardId);
            java.util.Map<UUID, BscScorecardPerspective> byPerspective = new java.util.HashMap<>();
            for (BscScorecardPerspective sp : existing) byPerspective.put(sp.getPerspective().getId(), sp);
            java.util.Set<UUID> keepIds = new java.util.HashSet<>();

            for (ScorecardPerspectiveWeightRequest item : request.getPerspectives()) {
                keepIds.add(item.getPerspectiveId());
                double newWeight = item.getWeightPercentage() != null ? item.getWeightPercentage() : 0.0;
                BscScorecardPerspective sp = byPerspective.get(item.getPerspectiveId());
                if (sp != null) {
                    // Dong cap tren GIAO XUONG bi khoa muc tieu va trong so (QD-3): don vi chi gan
                    // KPI con va cap nhat ket qua. Bo qua thay vi bao loi de client cu gui nguyen
                    // danh sach nhu cu - nguoi dung khong sua duoc thi cung khong co gui len.
                    boolean lockedRow = Boolean.TRUE.equals(sp.getLocked()) && !canManageWholeTree();
                    if (!lockedRow) {
                        double oldWeight = sp.getWeightPercentage() != null ? sp.getWeightPercentage() : 0.0;
                        if (Math.abs(oldWeight - newWeight) > 0.0001) {
                            logWeightChange(scorecard, sp.getPerspective(), oldWeight, newWeight, currentUser, item.getReason());
                        }
                        sp.setWeightPercentage(newWeight);
                        applyRowTargets(sp, item, sp.getPerspective(), false);
                    }
                    if (item.getDisplayOrder() != null) sp.setDisplayOrder(item.getDisplayOrder());
                    applyRowConfig(sp, item, lockedRow);
                    scorecardPerspectiveRepository.save(sp);
                } else {
                    BscPerspective perspective = perspectiveRepository.findById(item.getPerspectiveId())
                            .orElseThrow(() -> new ResourceNotFoundException("Hạng mục", "id", item.getPerspectiveId()));
                    BscScorecardPerspective created = BscScorecardPerspective.builder()
                            .scorecard(scorecard)
                            .perspective(perspective)
                            .weightPercentage(newWeight)
                            .displayOrder(item.getDisplayOrder() != null ? item.getDisplayOrder() : perspective.getDisplayOrder())
                            .build();
                    applyRowTargets(created, item, perspective, true);
                    applyRowConfig(created, item, false);
                    created.setCreatedBy(currentUser);
                    scorecardPerspectiveRepository.save(created);
                    logWeightChange(scorecard, perspective, null, newWeight, currentUser, item.getReason());
                }
            }
            // Xoá các lĩnh vực không còn trong danh sách. Dòng ĐƯỢC GIAO thì không: bỏ một chỉ tiêu
            // cấp trên giao phải đi qua cấp trên, nếu không đơn vị chỉ cần bỏ tick là thoát chỉ tiêu.
            for (BscScorecardPerspective sp : existing) {
                if (keepIds.contains(sp.getPerspective().getId())) continue;
                if (Boolean.TRUE.equals(sp.getLocked()) && !canManageWholeTree()) {
                    throw new BusinessException("Không thể bỏ chỉ tiêu do cấp trên giao: "
                            + sp.getPerspective().getName());
                }
                scorecardPerspectiveRepository.delete(sp);
            }
        }
        scorecardRepository.save(scorecard);
        return mapToScorecardResponse(scorecardRepository.findById(scorecardId).orElseThrow());
    }

    @Transactional
    public void deleteScorecard(UUID scorecardId) {
        BscScorecard scorecard = scorecardRepository.findById(scorecardId)
                .orElseThrow(() -> new ResourceNotFoundException("Scorecard not found"));
        accessGuard.assertCanEdit(scorecard);
        scorecard.setDeletedAt(Instant.now());
        scorecardRepository.save(scorecard);
    }

    /** Chuyển chế độ chấm điểm (SHADOW/OFFICIAL) — gác bằng permission BSC:PUBLISH_SCORE ở controller. */
    @Transactional
    public ScorecardResponse updateScoringMode(UUID scorecardId, BscScoringMode mode) {
        BscScorecard scorecard = scorecardRepository.findById(scorecardId)
                .orElseThrow(() -> new ResourceNotFoundException("Scorecard not found"));
        scorecard.setScoringMode(mode);
        scorecardRepository.save(scorecard);
        return mapToScorecardResponse(scorecard);
    }

    /**
     * Phạm vi thời gian đã nạp & kiểm tra của một bộ tiêu chí.
     *
     * @param periods            danh sách đợt LƯU vào bảng nối (rỗng khi gắn theo kỳ)
     * @param cycle              kỳ gắn kèm (null khi gắn theo đợt)
     * @param effectivePeriodIds các đợt THỰC TẾ đang chịu ảnh hưởng — dùng để kiểm tra chồng lấn
     */
    private record ScopeSelection(BscScorecardApplyScope applyScope,
                                  List<KpiPeriod> periods,
                                  KpiCycle cycle,
                                  List<UUID> effectivePeriodIds) {}

    /** Đọc phạm vi thời gian từ request: 1 kỳ (mọi đợt trong kỳ) hoặc nhiều đợt cụ thể. */
    private ScopeSelection resolveScopeSelection(UUID organizationId, ScorecardRequest request) {
        BscScorecardApplyScope mode = request.getApplyScope() != null
                ? request.getApplyScope() : BscScorecardApplyScope.PERIOD;

        if (mode == BscScorecardApplyScope.CYCLE) {
            if (request.getKpiCycleId() == null) {
                throw new BusinessException("Chọn kỳ đánh giá áp dụng cho bộ tiêu chí");
            }
            KpiCycle cycle = kpiCycleRepository.findById(request.getKpiCycleId())
                    .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá", "id", request.getKpiCycleId()));
            if (cycle.getOrganization() == null || !cycle.getOrganization().getId().equals(organizationId)) {
                throw new BusinessException("Kỳ đánh giá không thuộc tổ chức này");
            }
            // Không lưu danh sách đợt: gắn theo kỳ được suy động nên đợt thêm vào kỳ sau này cũng tự áp dụng.
            List<UUID> periodIds = kpiPeriodRepository.findByKpiCycleIdOrderByStartDateAsc(cycle.getId())
                    .stream().map(KpiPeriod::getId).collect(Collectors.toList());
            return new ScopeSelection(mode, List.of(), cycle, periodIds);
        }

        List<UUID> requested = request.getKpiPeriodIds() == null ? List.of()
                : request.getKpiPeriodIds().stream().filter(java.util.Objects::nonNull).distinct().collect(Collectors.toList());
        if (requested.isEmpty()) {
            throw new BusinessException("Chọn ít nhất một đợt áp dụng cho bộ tiêu chí");
        }
        List<KpiPeriod> periods = new ArrayList<>();
        for (UUID id : requested) {
            KpiPeriod period = kpiPeriodRepository.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("Đợt KPI", "id", id));
            if (period.getOrganization() == null || !period.getOrganization().getId().equals(organizationId)) {
                throw new BusinessException("Đợt KPI không thuộc tổ chức này");
            }
            periods.add(period);
        }
        return new ScopeSelection(mode, periods, null, requested);
    }

    /**
     * Mỗi đợt chỉ được có 1 bộ tiêu chí mặc định và mỗi phòng ban ≤1 bộ tiêu chí — kiểm tra trên
     * TỪNG đợt chịu ảnh hưởng (gắn theo kỳ ⇒ mọi đợt trong kỳ).
     */
    private void validateNoScopeClash(UUID organizationId, List<OrgUnit> orgUnits,
                                      ScopeSelection scope, UUID ignoreScorecardId) {
        List<UUID> unitIds = orgUnits == null ? List.of()
                : orgUnits.stream().map(OrgUnit::getId).collect(Collectors.toList());
        for (UUID periodId : scope.effectivePeriodIds()) {
            if (unitIds.isEmpty()) {
                boolean taken = scorecardRepository.findDefaultByPeriod(organizationId, periodId).stream()
                        .anyMatch(sc -> !sc.getId().equals(ignoreScorecardId));
                if (taken) {
                    throw new DuplicateResourceException(
                            "Đã tồn tại bộ tiêu chí mặc định cho đợt \"" + periodNameOf(periodId) + "\"");
                }
            } else {
                List<BscScorecard> clashing = scorecardRepository
                        .findByOrgUnitsAndPeriod(organizationId, unitIds, periodId).stream()
                        .filter(sc -> !sc.getId().equals(ignoreScorecardId))
                        .collect(Collectors.toList());
                if (!clashing.isEmpty()) {
                    java.util.Set<UUID> taken = clashing.stream()
                            .flatMap(sc -> sc.getOrgUnits().stream()).map(OrgUnit::getId)
                            .collect(Collectors.toSet());
                    String names = orgUnits.stream().filter(u -> taken.contains(u.getId()))
                            .map(OrgUnit::getName).distinct().collect(Collectors.joining(", "));
                    throw new DuplicateResourceException(
                            "Phòng ban đã có bộ tiêu chí trong đợt \"" + periodNameOf(periodId) + "\": " + names);
                }
            }
        }
    }

    private String periodNameOf(UUID periodId) {
        return kpiPeriodRepository.findById(periodId).map(KpiPeriod::getName).orElse("?");
    }

    /** Các đợt bộ tiêu chí đang áp dụng: gắn theo kỳ ⇒ đọc động từ kỳ; gắn theo đợt ⇒ danh sách đã lưu. */
    public List<KpiPeriod> effectivePeriodsOf(BscScorecard s) {
        if (s.getApplyScope() == BscScorecardApplyScope.CYCLE && s.getKpiCycle() != null) {
            return kpiPeriodRepository.findByKpiCycleIdOrderByStartDateAsc(s.getKpiCycle().getId());
        }
        return s.getKpiPeriods() == null ? List.of() : s.getKpiPeriods();
    }

    /** Nạp + kiểm tra danh sách phòng ban thuộc đúng tổ chức. RỖNG/null ⇒ bộ tiêu chí mặc định toàn org. */
    private List<OrgUnit> resolveRequestOrgUnits(UUID organizationId, List<UUID> orgUnitIds) {
        if (orgUnitIds == null || orgUnitIds.isEmpty()) return new ArrayList<>();
        List<OrgUnit> units = new ArrayList<>();
        for (UUID id : orgUnitIds.stream().distinct().collect(Collectors.toList())) {
            OrgUnit unit = orgUnitRepository.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("Phòng ban", "id", id));
            UUID unitOrgId = unit.getOrgHierarchyLevel() != null && unit.getOrgHierarchyLevel().getOrganization() != null
                    ? unit.getOrgHierarchyLevel().getOrganization().getId() : null;
            if (unitOrgId == null || !unitOrgId.equals(organizationId)) {
                throw new BusinessException("Phòng ban không thuộc tổ chức này");
            }
            units.add(unit);
        }
        return units;
    }

    // ============================================================
    // Cây BSC (P1 — docs/bsc-cascade-design.md, QĐ-1)
    // ============================================================

    /**
     * Cấp của một thẻ SUY RA từ phạm vi phòng ban, không nhận từ client — nhờ vậy không tồn tại
     * trạng thái mâu thuẫn kiểu "cấp công ty nhưng lại thuộc một phòng".
     *
     * <p>Hai đường ra COMPANY:
     * <ul>
     *   <li>KHÔNG gắn đơn vị nào — dạng cũ, giữ để dữ liệu tạo trước đây không đổi cấp;
     *   <li>Có gắn ĐƠN VỊ GỐC (đơn vị không có cha) — dạng mới. Giao diện bỏ lựa chọn
     *       "toàn tổ chức" mơ hồ, giám đốc chọn thẳng node gốc; node gốc CHÍNH LÀ công ty.
     * </ul>
     *
     * <p>Bỏ nhánh thứ hai thì BSC công ty rơi xuống cấp UNIT: {@code findCompanyByPeriod} không tìm
     * thấy thẻ công ty nào, hệ số công ty vĩnh viễn = 1, còn kết quả của chính công ty lại bị đem
     * tra làm hệ số phòng ban. Tức cả tầng cascade sai mà không báo lỗi gì.
     */
    private static BscScorecardLevel resolveLevel(List<OrgUnit> orgUnits) {
        if (orgUnits == null || orgUnits.isEmpty()) return BscScorecardLevel.COMPANY;
        boolean coversRoot = orgUnits.stream().anyMatch(u -> u.getParent() == null);
        return coversRoot ? BscScorecardLevel.COMPANY : BscScorecardLevel.UNIT;
    }

    /**
     * Nạp và kiểm tra bộ tiêu chí cha. Trả null khi không gắn cha.
     *
     * @param selfId id của thẻ đang sửa (null khi tạo mới) — dùng để chặn vòng lặp cha-con
     */
    private BscScorecard resolveParent(UUID organizationId, UUID parentId, BscScorecardLevel level, UUID selfId) {
        if (parentId == null) return null;
        if (level == BscScorecardLevel.COMPANY) {
            throw new BusinessException("Bộ tiêu chí cấp công ty là gốc của cây BSC nên không nhận bộ tiêu chí cha");
        }
        if (parentId.equals(selfId)) {
            throw new BusinessException("Bộ tiêu chí không thể là cha của chính nó");
        }
        BscScorecard parent = scorecardRepository.findById(parentId)
                .orElseThrow(() -> new ResourceNotFoundException("Bộ tiêu chí cha", "id", parentId));
        if (!parent.getOrganization().getId().equals(organizationId)) {
            throw new BusinessException("Bộ tiêu chí cha phải thuộc cùng tổ chức");
        }
        // Chặn vòng lặp A→B→A: đi ngược lên từ cha, nếu gặp lại chính mình thì từ chối.
        // Giới hạn 100 bước để dữ liệu cây hỏng sẵn không làm treo request.
        BscScorecard cur = parent;
        int guard = 0;
        while (cur != null && guard++ < 100) {
            if (selfId != null && selfId.equals(cur.getId())) {
                throw new BusinessException("Liên kết cha-con tạo thành vòng lặp trong cây BSC");
            }
            cur = cur.getParentScorecard();
        }
        return parent;
    }

    /**
     * Gán mục tiêu RIÊNG của một dòng bộ tiêu chí (QĐ-2).
     *
     * <p>Danh sách hạng mục trong request là AUTHORITATIVE — nó đã quyết định luôn dòng nào bị xoá
     * và trọng số bao nhiêu — nên ở đây null cũng có nghĩa "xoá mục tiêu riêng", không phải "bỏ qua".
     * Ngoại lệ duy nhất: dòng TẠO MỚI mà client không gửi trường mục tiêu nào thì kế thừa giá trị
     * mặc định của hạng mục, đúng tinh thần "con số trên hạng mục là gợi ý lúc thêm vào bộ tiêu chí".
     */
    private void applyRowTargets(BscScorecardPerspective sp,
                                 ScorecardPerspectiveWeightRequest item,
                                 BscPerspective perspective,
                                 boolean isNewRow) {
        boolean anyProvided = item.getTargetValue() != null
                || item.getMinimumValue() != null
                || trimToNull(item.getUnit()) != null;
        if (isNewRow && !anyProvided) {
            sp.setTargetValue(perspective.getTargetValue());
            sp.setMinimumValue(perspective.getMinimumValue());
            sp.setUnit(perspective.getUnit());
        } else {
            sp.setTargetValue(item.getTargetValue());
            sp.setMinimumValue(item.getMinimumValue());
            sp.setUnit(trimToNull(item.getUnit()));
        }
        validatePerspectiveTargets(sp.getTargetValue(), sp.getMinimumValue(), perspective.getName());
    }

    /**
     * Cấu hình nguồn số liệu và hạng mục chặn của một dòng.
     *
     * <p>Tách khỏi {@link #applyRowTargets} vì đây KHÔNG phải phần bị khoá: đơn vị vẫn được đổi
     * cách lấy số liệu cho chỉ tiêu cấp trên giao (tự cộng từ KPI hay nhập tay là việc nội bộ).
     * Ngược lại, cấu hình CHẶN của dòng được giao thì khoá — cấp trên đã coi là điều kiện bắt buộc.
     */
    private void applyRowConfig(BscScorecardPerspective sp, ScorecardPerspectiveWeightRequest item, boolean lockedRow) {
        if (item.getMeasurementSource() != null) sp.setMeasurementSource(item.getMeasurementSource());
        if (lockedRow) return;
        if (item.getIsGate() != null) sp.setIsGate(item.getIsGate());
        if (item.getGateMinPercent() != null) sp.setGateMinPercent(item.getGateMinPercent());
        if (item.getGateEffect() != null) sp.setGateEffect(item.getGateEffect());
        if (item.getGateCapRating() != null) sp.setGateCapRating(item.getGateCapRating());
        if (item.getGateAppliesTo() != null) sp.setGateAppliesTo(item.getGateAppliesTo());
        // Bật chặn mà thiếu ngưỡng/hệ quả thì dòng đó im lặng không có tác dụng gì, trong khi
        // người cấu hình tưởng đã chặn. Điền mặc định hợp lý thay vì để rơi vào CHECK của DB.
        if (Boolean.TRUE.equals(sp.getIsGate())) {
            if (sp.getGateMinPercent() == null) sp.setGateMinPercent(100.0);
            if (sp.getGateEffect() == null) sp.setGateEffect(com.kpitracking.enums.BscGateEffect.BLOCK_EXCELLENT);
            if (sp.getGateEffect() == com.kpitracking.enums.BscGateEffect.CAP_AT_RATING
                    && sp.getGateCapRating() == null) {
                throw new BusinessException("Hạng mục chặn kiểu giới hạn xếp loại phải chỉ rõ mức trần: "
                        + sp.getPerspective().getName());
            }
        }
    }

    /**
     * Người dùng hiện tại có quyền quản trị toàn cây BSC không (giám đốc / HR trưởng).
     * Người có quyền này sửa được cả dòng đã khoá — họ chính là người đặt ra chỉ tiêu đó.
     */
    private boolean canManageWholeTree() {
        return accessGuard.canManageAll();
    }

    private void validateWeights(List<ScorecardPerspectiveWeightRequest> items) {
        if (items == null || items.isEmpty()) return;
        double total = items.stream().mapToDouble(i -> i.getWeightPercentage() != null ? i.getWeightPercentage() : 0.0).sum();
        if (Math.abs(total - 100.0) > 0.01) {
            throw new BusinessException("Tổng trọng số các hạng mục phải bằng 100% (hiện tại: " + total + "%)");
        }
    }

    private void logWeightChange(BscScorecard scorecard, BscPerspective perspective, Double oldW, Double newW, User user, String reason) {
        weightHistoryRepository.save(BscWeightHistory.builder()
                .scorecard(scorecard)
                .perspective(perspective)
                .oldWeight(oldW)
                .newWeight(newW)
                .changedBy(user)
                .reason(reason)
                .build());
    }

    private User getCurrentUserOrNull() {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            return userRepository.findByEmail(email).orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    private ScorecardResponse mapToScorecardResponse(BscScorecard s) {
        List<ScorecardPeriodResponse> periods = effectivePeriodsOf(s).stream()
                .map(p -> ScorecardPeriodResponse.builder().id(p.getId()).name(p.getName()).build())
                .collect(Collectors.toList());
        List<ScorecardOrgUnitResponse> orgUnits = s.getOrgUnits() == null ? List.of()
                : s.getOrgUnits().stream()
                    .map(u -> ScorecardOrgUnitResponse.builder().id(u.getId()).name(u.getName()).build())
                    .collect(Collectors.toList());
        List<ScorecardPerspectiveResponse> perspectives = s.getScorecardPerspectives() == null ? List.of()
                : s.getScorecardPerspectives().stream()
                    .map(sp -> ScorecardPerspectiveResponse.builder()
                            .id(sp.getId())
                            .perspectiveId(sp.getPerspective().getId())
                            .code(sp.getPerspective().getCode())
                            .name(sp.getPerspective().getName())
                            .color(sp.getPerspective().getColor())
                            // Mục tiêu của DÒNG này; chỉ rơi về mặc định của hạng mục khi dòng bỏ trống.
                            .targetValue(sp.getTargetValue() != null ? sp.getTargetValue() : sp.getPerspective().getTargetValue())
                            .minimumValue(sp.getMinimumValue() != null ? sp.getMinimumValue() : sp.getPerspective().getMinimumValue())
                            .unit(sp.getUnit() != null && !sp.getUnit().isBlank() ? sp.getUnit() : sp.getPerspective().getUnit())
                            .weightPercentage(sp.getWeightPercentage())
                            .displayOrder(sp.getDisplayOrder())
                            .origin(sp.getOrigin())
                            .locked(sp.getLocked())
                            .parentItemId(sp.getParentItem() != null ? sp.getParentItem().getId() : null)
                            .parentItemName(sp.getParentItem() != null
                                    ? sp.getParentItem().getPerspective().getName() : null)
                            .parentScorecardName(sp.getParentItem() != null
                                    ? sp.getParentItem().getScorecard().getName() : null)
                            .linkType(sp.getLinkType())
                            .contributionValue(sp.getContributionValue())
                            .contributionPercent(sp.getContributionPercent())
                            .measurementSource(sp.getMeasurementSource())
                            .isGate(sp.getIsGate())
                            .gateMinPercent(sp.getGateMinPercent())
                            .gateEffect(sp.getGateEffect())
                            .gateCapRating(sp.getGateCapRating())
                            .gateAppliesTo(sp.getGateAppliesTo())
                            .fixedPerspective(sp.getPerspective().getFixedPerspective() != null ? sp.getPerspective().getFixedPerspective().name() : null)
                            .fixedPerspectiveName(sp.getPerspective().getFixedPerspective() != null ? sp.getPerspective().getFixedPerspective().getDisplayName() : null)
                            .fixedPerspectiveColor(sp.getPerspective().getFixedPerspective() != null ? sp.getPerspective().getFixedPerspective().getColor() : null)
                            .build())
                    .collect(Collectors.toList());
        double totalWeight = perspectives.stream().mapToDouble(p -> p.getWeightPercentage() != null ? p.getWeightPercentage() : 0.0).sum();
        return ScorecardResponse.builder()
                .id(s.getId())
                .name(s.getName())
                .vision(s.getVision())
                .applyScope(s.getApplyScope())
                .periods(periods)
                .kpiCycleId(s.getKpiCycle() != null ? s.getKpiCycle().getId() : null)
                .kpiCycleName(s.getKpiCycle() != null ? s.getKpiCycle().getName() : null)
                .periodLabel(s.getApplyScope() == BscScorecardApplyScope.CYCLE && s.getKpiCycle() != null
                        ? s.getKpiCycle().getName()
                        : periods.stream().map(ScorecardPeriodResponse::getName).collect(Collectors.joining(", ")))
                .orgUnits(orgUnits)
                .orgUnitName(orgUnits.isEmpty() ? null
                        : orgUnits.stream().map(ScorecardOrgUnitResponse::getName).collect(Collectors.joining(", ")))
                .level(s.getLevel())
                .parentScorecardId(s.getParentScorecard() != null ? s.getParentScorecard().getId() : null)
                .parentScorecardName(s.getParentScorecard() != null ? s.getParentScorecard().getName() : null)
                .status(s.getStatus())
                .scoringMode(s.getScoringMode())
                .emptyPerspectivePolicy(s.getEmptyPerspectivePolicy())
                .perspectives(perspectives)
                .totalWeight(totalWeight)
                .createdAt(s.getCreatedAt())
                .updatedAt(s.getUpdatedAt())
                .build();
    }

    /**
     * Đọc một ô số không bắt buộc: cột vắng mặt hoặc ô trống ⇒ null.
     * Không dùng {@link #getCellString} vì hàm đó ép ô số về long — mục tiêu 95.5 sẽ bị cắt còn 95.
     */
    private Double readOptionalNumber(Row row, int colIdx, String label) {
        if (colIdx == -1) return null;
        Cell cell = row.getCell(colIdx);
        if (cell == null) return null;
        if (cell.getCellType() == CellType.NUMERIC) return cell.getNumericCellValue();
        String raw = getCellString(cell);
        if (raw.isBlank()) return null;
        try {
            return Double.parseDouble(raw.replace(",", "."));
        } catch (NumberFormatException e) {
            throw new BusinessException(label + " '" + raw + "' phải là số");
        }
    }

    private String getCellString(Cell cell) {
        if (cell == null) return "";
        switch (cell.getCellType()) {
            case STRING: return cell.getStringCellValue().trim();
            case NUMERIC: return String.valueOf((long) cell.getNumericCellValue());
            case BOOLEAN: return String.valueOf(cell.getBooleanCellValue());
            case FORMULA: return cell.getCellFormula();
            default: return "";
        }
    }

    /** Đọc ô dạng số nhưng GIỮ phần thập phân (dùng cho trọng số). */
    private String getCellDecimalString(Cell cell) {
        if (cell == null) return "";
        if (cell.getCellType() == CellType.NUMERIC) {
            double v = cell.getNumericCellValue();
            return v == Math.floor(v) ? String.valueOf((long) v) : String.valueOf(v);
        }
        return getCellString(cell);
    }

    // ============================================================
    // Import Excel bộ tiêu chí (.xlsx) — mỗi dòng = 1 hạng mục kèm trọng số trong 1 kỳ
    //
    // Cột: Period (bắt buộc), ScorecardName (bắt buộc), Vision, OrgUnits, PerspectiveCode (bắt buộc),
    //      Weight (bắt buộc), Status, ScoringMode, EmptyPolicy
    //      + hạng mục: PerspectiveName, FixedPerspective, Unit, TargetValue, MinimumValue, Color.
    //
    // MỘT tệp làm cả hai việc: mã hạng mục chưa có trong tổ chức thì TẠO MỚI ngay từ các cột hạng
    // mục, có rồi thì cập nhật những cột được điền. Trước đây phải import hai lần theo đúng thứ tự
    // (danh mục hạng mục trước, bộ tiêu chí sau) — quên thứ tự là ăn lỗi "Không tìm thấy hạng mục".
    // ============================================================

    @Transactional
    public ImportBscResponse importScorecards(UUID organizationId, MultipartFile file) {
        String filename = file.getOriginalFilename();
        if (filename == null || !filename.endsWith(".xlsx")) {
            throw new BusinessException("Chỉ hỗ trợ tập tin định dạng .xlsx");
        }
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization not found"));

        List<String> errors = new ArrayList<>();
        int totalRows = 0;
        int successfulImports = 0;

        // period key (normalized) -> gom dữ liệu
        java.util.LinkedHashMap<String, ScorecardImportGroup> groups = new java.util.LinkedHashMap<>();
        // mã hạng mục (thường hoá) -> mô tả hạng mục lấy từ chính tệp này
        java.util.LinkedHashMap<String, PerspectiveSpec> perspectiveSpecs = new java.util.LinkedHashMap<>();

        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            Row headerRow = sheet.getRow(0);
            if (headerRow == null) throw new BusinessException("Tập tin Excel trống");

            int periodIdx = -1, nameIdx = -1, visionIdx = -1, pCodeIdx = -1, weightIdx = -1, statusIdx = -1, modeIdx = -1, policyIdx = -1, unitsIdx = -1;
            int pNameIdx = -1, fixedIdx = -1, pUnitIdx = -1, pTargetIdx = -1, pMinimumIdx = -1, pColorIdx = -1;
            for (int i = 0; i < headerRow.getLastCellNum(); i++) {
                String h = getCellString(headerRow.getCell(i));
                if (h.equalsIgnoreCase("Period")) periodIdx = i;
                else if (h.equalsIgnoreCase("ScorecardName")) nameIdx = i;
                else if (h.equalsIgnoreCase("Vision")) visionIdx = i;
                else if (h.equalsIgnoreCase("PerspectiveCode")) pCodeIdx = i;
                else if (h.equalsIgnoreCase("Weight")) weightIdx = i;
                else if (h.equalsIgnoreCase("Status")) statusIdx = i;
                else if (h.equalsIgnoreCase("ScoringMode")) modeIdx = i;
                else if (h.equalsIgnoreCase("EmptyPolicy")) policyIdx = i;
                else if (h.equalsIgnoreCase("OrgUnits") || h.equalsIgnoreCase("OrgUnitCode") || h.equalsIgnoreCase("OrgUnitCodes")) unitsIdx = i;
                // Cột mô tả HẠNG MỤC — có thì tạo/cập nhật hạng mục ngay trong cùng tệp.
                else if (h.equalsIgnoreCase("PerspectiveName")) pNameIdx = i;
                else if (h.equalsIgnoreCase("FixedPerspective") || h.equalsIgnoreCase("Perspective")) fixedIdx = i;
                else if (h.equalsIgnoreCase("Unit")) pUnitIdx = i;
                else if (h.equalsIgnoreCase("TargetValue")) pTargetIdx = i;
                else if (h.equalsIgnoreCase("MinimumValue")) pMinimumIdx = i;
                else if (h.equalsIgnoreCase("Color")) pColorIdx = i;
            }
            if (periodIdx == -1 || nameIdx == -1 || pCodeIdx == -1 || weightIdx == -1) {
                throw new BusinessException("Thiếu các cột bắt buộc: Period, ScorecardName, PerspectiveCode, Weight");
            }

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                String period = getCellString(row.getCell(periodIdx));
                String pCode = getCellString(row.getCell(pCodeIdx));
                if (period.isBlank() && pCode.isBlank()) continue;
                totalRows++;
                try {
                    if (period.isBlank()) throw new BusinessException("Thiếu Period");
                    if (pCode.isBlank()) throw new BusinessException("Thiếu PerspectiveCode");
                    String weightStr = getCellDecimalString(row.getCell(weightIdx));
                    if (weightStr.isBlank()) throw new BusinessException("Thiếu Weight");
                    double weight;
                    try { weight = Double.parseDouble(weightStr); }
                    catch (Exception e) { throw new BusinessException("Weight '" + weightStr + "' phải là số"); }

                    String key = period.trim().replaceAll("\\s+", " ").toLowerCase();
                    ScorecardImportGroup g = groups.computeIfAbsent(key, k -> new ScorecardImportGroup());
                    g.periodName = period.trim();
                    if (g.name == null && nameIdx != -1) { String n = getCellString(row.getCell(nameIdx)); if (!n.isBlank()) g.name = n; }
                    if (g.vision == null && visionIdx != -1) { String v = getCellString(row.getCell(visionIdx)); if (!v.isBlank()) g.vision = v; }
                    if (g.statusStr == null && statusIdx != -1) g.statusStr = getCellString(row.getCell(statusIdx));
                    if (g.modeStr == null && modeIdx != -1) g.modeStr = getCellString(row.getCell(modeIdx));
                    if (g.policyStr == null && policyIdx != -1) g.policyStr = getCellString(row.getCell(policyIdx));
                    if (g.orgUnitCodes == null && unitsIdx != -1) { String u = getCellString(row.getCell(unitsIdx)); if (!u.isBlank()) g.orgUnitCodes = u; }
                    String codeKey = pCode.trim();
                    boolean dup = g.weights.keySet().stream().anyMatch(k -> k.equalsIgnoreCase(codeKey));
                    if (dup) throw new BusinessException("Mã hạng mục '" + codeKey + "' bị trùng trong kỳ '" + period.trim() + "'");
                    g.weights.put(codeKey, weight);

                    // Mô tả hạng mục gom theo MÃ, dùng chung cho mọi kỳ trong tệp: cùng một mã thì
                    // cùng một hạng mục, khai lại tên ở từng kỳ chỉ tổ lệch nhau.
                    PerspectiveSpec spec = perspectiveSpecs.computeIfAbsent(codeKey.toLowerCase(), k -> new PerspectiveSpec());
                    spec.code = codeKey;
                    if (spec.name == null && pNameIdx != -1) spec.name = trimToNull(getCellString(row.getCell(pNameIdx)));
                    if (spec.fixedStr == null && fixedIdx != -1) spec.fixedStr = trimToNull(getCellString(row.getCell(fixedIdx)));
                    if (spec.unit == null && pUnitIdx != -1) spec.unit = trimToNull(getCellString(row.getCell(pUnitIdx)));
                    if (spec.color == null && pColorIdx != -1) spec.color = trimToNull(getCellString(row.getCell(pColorIdx)));
                    if (spec.target == null && pTargetIdx != -1) spec.target = readOptionalNumber(row, pTargetIdx, "Mục tiêu mong muốn");
                    if (spec.minimum == null && pMinimumIdx != -1) spec.minimum = readOptionalNumber(row, pMinimumIdx, "Kết quả tối thiểu");
                } catch (Exception e) {
                    errors.add("Dòng " + (i + 1) + ": " + e.getMessage());
                }
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("Lỗi đọc tập tin Excel: " + e.getMessage());
        }

        User currentUser = getCurrentUserOrNull();
        for (ScorecardImportGroup g : groups.values()) {
            try {
                if (g.name == null || g.name.isBlank()) throw new BusinessException("Thiếu ScorecardName");
                double sum = g.weights.values().stream().mapToDouble(Double::doubleValue).sum();
                if (Math.abs(sum - 100.0) > 0.01) {
                    throw new BusinessException("Tổng trọng số phải = 100% (hiện tại: " + sum + "%)");
                }
                String clean = g.periodName.replaceAll("\\s+", " ");
                KpiPeriod period = kpiPeriodRepository.findByNameSmart(clean, organizationId)
                        .or(() -> kpiPeriodRepository.findByNameIgnoreCase(clean))
                        .orElseThrow(() -> new BusinessException("Không tìm thấy kỳ '" + g.periodName + "'"));

                // Phòng ban áp dụng cho bộ tiêu chí của kỳ này (cột OrgUnits, phân tách dấu phẩy; RỖNG = toàn org).
                List<OrgUnit> targetUnits = resolveUnitsByCodes(organizationId, g.orgUnitCodes);

                // Xác định bộ tiêu chí đích: theo phòng ban đã chọn (upsert thẻ đang chứa các phòng ban đó),
                // hoặc thẻ MẶC ĐỊNH toàn org nếu không chọn phòng ban nào.
                BscScorecard scorecard;
                if (targetUnits.isEmpty()) {
                    List<BscScorecard> defaults = scorecardRepository.findDefaultByPeriod(organizationId, period.getId());
                    scorecard = defaults.isEmpty() ? null : defaults.get(0);
                } else {
                    List<UUID> unitIds = targetUnits.stream().map(OrgUnit::getId).collect(Collectors.toList());
                    List<BscScorecard> overlap = scorecardRepository.findByOrgUnitsAndPeriod(organizationId, unitIds, period.getId());
                    if (overlap.size() > 1) {
                        throw new BusinessException("Các phòng ban đã chọn đang thuộc nhiều bộ tiêu chí khác nhau trong kỳ này");
                    }
                    scorecard = overlap.isEmpty() ? null : overlap.get(0);
                }
                boolean isNew = scorecard == null;
                if (isNew) {
                    scorecard = BscScorecard.builder().organization(organization).name(g.name)
                            .applyScope(BscScorecardApplyScope.PERIOD)
                            .kpiPeriods(new ArrayList<>(List.of(period)))
                            .build();
                }
                scorecard.setOrgUnits(new ArrayList<>(targetUnits));
                scorecard.setLevel(resolveLevel(targetUnits));
                scorecard.setName(g.name);
                if (g.vision != null) scorecard.setVision(g.vision);
                if (g.statusStr != null && !g.statusStr.isBlank()) {
                    try { scorecard.setStatus(BscScorecardStatus.valueOf(g.statusStr.trim().toUpperCase())); } catch (Exception ignored) {}
                }
                if (g.modeStr != null && !g.modeStr.isBlank()) {
                    try { scorecard.setScoringMode(BscScoringMode.valueOf(g.modeStr.trim().toUpperCase())); } catch (Exception ignored) {}
                }
                if (g.policyStr != null && !g.policyStr.isBlank()) {
                    try { scorecard.setEmptyPerspectivePolicy(com.kpitracking.enums.BscEmptyPerspectivePolicy.valueOf(g.policyStr.trim().toUpperCase())); } catch (Exception ignored) {}
                }
                scorecard = scorecardRepository.save(scorecard);

                // Xoá trọng số cũ, ghi lại theo file
                if (!isNew) {
                    for (BscScorecardPerspective sp : scorecardPerspectiveRepository.findByScorecardIdOrderByDisplayOrderAsc(scorecard.getId())) {
                        scorecardPerspectiveRepository.delete(sp);
                    }
                }
                int order = 0;
                for (java.util.Map.Entry<String, Double> w : g.weights.entrySet()) {
                    BscPerspective perspective = upsertPerspectiveFromImport(
                            organization, w.getKey(), perspectiveSpecs.get(w.getKey().toLowerCase()));
                    BscScorecardPerspective sp = BscScorecardPerspective.builder()
                            .scorecard(scorecard).perspective(perspective)
                            .weightPercentage(w.getValue()).displayOrder(order++).build();
                    scorecardPerspectiveRepository.save(sp);
                    logWeightChange(scorecard, perspective, null, w.getValue(), currentUser, "Import Excel");
                }
                successfulImports++;
            } catch (Exception e) {
                errors.add("Bộ tiêu chí kỳ '" + g.periodName + "': " + e.getMessage());
            }
        }

        return ImportBscResponse.builder()
                .totalRows(totalRows)
                .successfulImports(successfulImports)
                .errors(errors)
                .build();
    }

    /** Mô tả một hạng mục đọc từ các cột phụ của tệp bộ tiêu chí. */
    private static class PerspectiveSpec {
        String code;
        String name;
        String fixedStr;
        String unit;
        String color;
        Double target;
        Double minimum;
    }

    /**
     * Tìm hạng mục theo mã; chưa có thì TẠO từ các cột hạng mục trong chính tệp bộ tiêu chí.
     *
     * <p>Đây là chỗ gộp hai lần import thành một. Không có tên hạng mục để tạo thì báo lỗi chỉ
     * thẳng cột còn thiếu, thay vì câu "Không tìm thấy hạng mục" khiến người dùng phải tự đoán ra
     * là phải đi import một tệp khác trước.
     */
    private BscPerspective upsertPerspectiveFromImport(Organization organization, String code, PerspectiveSpec spec) {
        UUID organizationId = organization.getId();
        BscPerspective existing = perspectiveRepository
                .findFirstByOrganizationIdAndCodeIgnoreCase(organizationId, code).orElse(null);

        BscFixedPerspective fixed = BscFixedPerspective.INTERNAL_PROCESS;
        if (spec != null && spec.fixedStr != null) {
            try { fixed = BscFixedPerspective.valueOf(spec.fixedStr.trim().toUpperCase()); }
            catch (Exception e) {
                throw new BusinessException("Lĩnh vực '" + spec.fixedStr + "' của hạng mục '" + code
                        + "' không hợp lệ (FINANCIAL / CUSTOMER / INTERNAL_PROCESS / LEARNING_GROWTH)");
            }
        }

        if (existing != null) {
            // Cột nào có dữ liệu thì cập nhật, cột trống giữ nguyên — tệp bộ tiêu chí không nhất
            // thiết mô tả lại toàn bộ hạng mục đã có.
            if (spec != null) {
                if (spec.name != null) existing.setName(spec.name);
                if (spec.unit != null) existing.setUnit(spec.unit);
                if (spec.color != null) existing.setColor(spec.color);
                if (spec.target != null) existing.setTargetValue(spec.target);
                if (spec.minimum != null) existing.setMinimumValue(spec.minimum);
                if (spec.fixedStr != null) existing.setFixedPerspective(fixed);
                validatePerspectiveTargets(existing.getTargetValue(), existing.getMinimumValue(), existing.getName());
                perspectiveRepository.save(existing);
            }
            return existing;
        }

        if (spec == null || spec.name == null) {
            throw new BusinessException("Chưa có hạng mục mã '" + code
                    + "'. Điền thêm cột PerspectiveName (và FixedPerspective) ở dòng này để hệ thống tạo mới.");
        }
        if (!code.matches("^[A-Za-z0-9_]+$")) {
            throw new BusinessException("Mã hạng mục '" + code + "' chỉ gồm chữ, số và dấu gạch dưới");
        }
        if (isReservedFixedCode(code)) {
            throw new BusinessException("Mã '" + code + "' trùng mã lĩnh vực cố định — dùng mã khác cho hạng mục");
        }
        validatePerspectiveTargets(spec.target, spec.minimum, spec.name);

        int order = (int) perspectiveRepository.countByOrganizationId(organizationId) + 1;
        return perspectiveRepository.save(BscPerspective.builder()
                .organization(organization)
                .code(code)
                .name(spec.name)
                .unit(spec.unit)
                .targetValue(spec.target)
                .minimumValue(spec.minimum)
                .color(spec.color != null && spec.color.matches("^#([0-9A-Fa-f]{6})$") ? spec.color : "#8b5cf6")
                .displayOrder(order)
                .status(BscPerspectiveStatus.ACTIVE)
                .fixedPerspective(fixed)
                .build());
    }

    private static class ScorecardImportGroup {
        String periodName;
        String name;
        String vision;
        String statusStr;
        String modeStr;
        String policyStr;
        String orgUnitCodes;
        final java.util.LinkedHashMap<String, Double> weights = new java.util.LinkedHashMap<>();
    }

    /** Phân giải danh sách MÃ phòng ban (phân tách dấu phẩy) → OrgUnit trong tổ chức. RỖNG ⇒ danh sách rỗng. */
    private List<OrgUnit> resolveUnitsByCodes(UUID organizationId, String codesCsv) {
        List<OrgUnit> units = new ArrayList<>();
        if (codesCsv == null || codesCsv.isBlank()) return units;
        java.util.Set<UUID> seen = new java.util.HashSet<>();
        for (String raw : codesCsv.split(",")) {
            String code = raw.trim();
            if (code.isEmpty()) continue;
            OrgUnit unit = orgUnitRepository.findByCodeSmart(code, organizationId)
                    .orElseThrow(() -> new BusinessException("Không tìm thấy phòng ban mã '" + code + "'"));
            if (seen.add(unit.getId())) units.add(unit);
        }
        return units;
    }

    // ============================================================
    // Mapping
    // ============================================================

    /** 4 mã lĩnh vực cố định là từ khóa DÀNH RIÊNG — hạng mục không được đặt trùng. */
    private static boolean isReservedFixedCode(String code) {
        if (code == null || code.isBlank()) return false;
        try {
            BscFixedPerspective.valueOf(code.trim().toUpperCase());
            return true;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static String trimToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    /**
     * Hạng mục không có cờ "KPI ngược" nên chỉ có một chiều hợp lệ: kết quả tối thiểu là SÀN,
     * phải nhỏ hơn hoặc bằng mục tiêu mong muốn. Đặt ngược lại thì hạng mục không bao giờ đạt sàn.
     * Chỉ kiểm khi cả hai cùng được điền — để trống nghĩa là hạng mục chưa đặt con số.
     */
    /**
     * Mục tiêu, kết quả tối thiểu và đơn vị tính là BẮT BUỘC khi tạo/sửa hạng mục qua màn hình.
     *
     * <p>Thiếu mục tiêu thì dòng chỉ tiêu của đơn vị không quy con số thực đạt ra %đạt được — nó
     * rơi về trung bình tỉ lệ đạt của các KPI con, tức đổi nghĩa con số mà không ai biết. Thiếu
     * đơn vị tính thì bảng kết quả hiện "80 / 100" mà người đọc không biết là tỉ hay buổi.
     *
     * <p>Import Excel CỐ Ý không đi qua chốt này: nhập hàng loạt thường dựng khung trước rồi mới
     * điền mục tiêu, chặn ở đó chỉ khiến người dùng bỏ luôn đường import.
     */
    private void requirePerspectiveMeasurement(PerspectiveRequest request) {
        String label = request.getName() != null && !request.getName().isBlank()
                ? " '" + request.getName() + "'" : "";
        if (request.getTargetValue() == null) {
            throw new BusinessException("Hạng mục" + label + ": vui lòng nhập mục tiêu mong muốn.");
        }
        if (request.getMinimumValue() == null) {
            throw new BusinessException("Hạng mục" + label + ": vui lòng nhập kết quả tối thiểu.");
        }
        if (trimToNull(request.getUnit()) == null) {
            throw new BusinessException("Hạng mục" + label + ": vui lòng nhập đơn vị tính.");
        }
    }

    private void validatePerspectiveTargets(Double target, Double minimum, String name) {
        String label = name != null && !name.isBlank() ? " '" + name + "'" : "";
        if (target != null && target < 0) {
            throw new BusinessException("Hạng mục" + label + ": Mục tiêu mong muốn không được âm.");
        }
        if (minimum != null && minimum < 0) {
            throw new BusinessException("Hạng mục" + label + ": Kết quả tối thiểu không được âm.");
        }
        if (target != null && minimum != null && minimum > target) {
            throw new BusinessException("Hạng mục" + label + ": Kết quả tối thiểu (" + minimum
                    + ") không được lớn hơn mục tiêu mong muốn (" + target + ").");
        }
    }

    private void validateNotReservedCode(String code) {
        if (isReservedFixedCode(code)) {
            throw new BusinessException("Mã hạng mục không được trùng mã lĩnh vực cố định "
                    + "(FINANCIAL, CUSTOMER, INTERNAL_PROCESS, LEARNING_GROWTH)");
        }
    }

    private PerspectiveResponse mapToPerspectiveResponse(BscPerspective p) {
        return PerspectiveResponse.builder()
                .id(p.getId())
                .code(p.getCode())
                .name(p.getName())
                .description(p.getDescription())
                .targetValue(p.getTargetValue())
                .minimumValue(p.getMinimumValue())
                .unit(p.getUnit())
                .color(p.getColor())
                .icon(p.getIcon())
                .displayOrder(p.getDisplayOrder())
                .status(p.getStatus())
                .fixedPerspective(p.getFixedPerspective())
                .fixedPerspectiveName(p.getFixedPerspective() != null ? p.getFixedPerspective().getDisplayName() : null)
                .fixedPerspectiveColor(p.getFixedPerspective() != null ? p.getFixedPerspective().getColor() : null)
                .build();
    }
}
