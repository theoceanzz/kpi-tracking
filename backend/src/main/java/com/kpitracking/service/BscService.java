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
import com.kpitracking.enums.BscScorecardStatus;
import com.kpitracking.enums.BscScoringMode;
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

        validateNotReservedCode(request.getCode());
        if (perspectiveRepository.existsByOrganizationIdAndCode(organizationId, request.getCode())) {
            throw new DuplicateResourceException("Hạng mục", "mã", request.getCode());
        }

        int displayOrder = request.getDisplayOrder() != null ? request.getDisplayOrder() : 0;
        if (perspectiveRepository.existsByOrganizationIdAndFixedPerspectiveAndDisplayOrder(
                organizationId, request.getFixedPerspective(), displayOrder)) {
            throw new DuplicateResourceException("Hạng mục", "thứ tự hiển thị (trong lĩnh vực)", displayOrder);
        }

        BscPerspective perspective = BscPerspective.builder()
                .organization(organization)
                .code(request.getCode())
                .name(request.getName())
                .description(request.getDescription())
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

        validateNotReservedCode(request.getCode());
        if (perspectiveRepository.existsByOrganizationIdAndCodeAndIdNot(
                perspective.getOrganization().getId(), request.getCode(), perspectiveId)) {
            throw new DuplicateResourceException("Hạng mục", "mã", request.getCode());
        }

        // Lĩnh vực hiệu lực khi kiểm trùng: ưu tiên giá trị gửi lên, nếu không thì giữ giá trị hiện tại.
        BscFixedPerspective effectiveFixed = request.getFixedPerspective() != null
                ? request.getFixedPerspective() : perspective.getFixedPerspective();
        if (request.getDisplayOrder() != null
                && perspectiveRepository.existsByOrganizationIdAndFixedPerspectiveAndDisplayOrderAndIdNot(
                        perspective.getOrganization().getId(), effectiveFixed, request.getDisplayOrder(), perspectiveId)) {
            throw new DuplicateResourceException("Hạng mục", "thứ tự hiển thị (trong lĩnh vực)", request.getDisplayOrder());
        }

        perspective.setCode(request.getCode());
        perspective.setName(request.getName());
        perspective.setDescription(request.getDescription());
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
        validateNoScopeClash(organizationId, orgUnits, scope, null);
        validateWeights(request.getPerspectives());

        BscScorecard scorecard = BscScorecard.builder()
                .organization(organization)
                .orgUnits(orgUnits)
                .applyScope(scope.applyScope())
                .kpiPeriods(new ArrayList<>(scope.periods()))
                .kpiCycle(scope.cycle())
                .name(request.getName())
                .vision(request.getVision())
                .status(request.getStatus() != null ? request.getStatus() : BscScorecardStatus.DRAFT)
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
        if (request.getStatus() != null) scorecard.setStatus(request.getStatus());
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
                    double oldWeight = sp.getWeightPercentage() != null ? sp.getWeightPercentage() : 0.0;
                    if (Math.abs(oldWeight - newWeight) > 0.0001) {
                        logWeightChange(scorecard, sp.getPerspective(), oldWeight, newWeight, currentUser, item.getReason());
                    }
                    sp.setWeightPercentage(newWeight);
                    if (item.getDisplayOrder() != null) sp.setDisplayOrder(item.getDisplayOrder());
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
                    scorecardPerspectiveRepository.save(created);
                    logWeightChange(scorecard, perspective, null, newWeight, currentUser, item.getReason());
                }
            }
            // Xoá các lĩnh vực không còn trong danh sách
            for (BscScorecardPerspective sp : existing) {
                if (!keepIds.contains(sp.getPerspective().getId())) {
                    scorecardPerspectiveRepository.delete(sp);
                }
            }
        }
        scorecardRepository.save(scorecard);
        return mapToScorecardResponse(scorecardRepository.findById(scorecardId).orElseThrow());
    }

    @Transactional
    public void deleteScorecard(UUID scorecardId) {
        BscScorecard scorecard = scorecardRepository.findById(scorecardId)
                .orElseThrow(() -> new ResourceNotFoundException("Scorecard not found"));
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
    private List<KpiPeriod> effectivePeriodsOf(BscScorecard s) {
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
                            .weightPercentage(sp.getWeightPercentage())
                            .displayOrder(sp.getDisplayOrder())
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
                .status(s.getStatus())
                .scoringMode(s.getScoringMode())
                .emptyPerspectivePolicy(s.getEmptyPerspectivePolicy())
                .perspectives(perspectives)
                .totalWeight(totalWeight)
                .createdAt(s.getCreatedAt())
                .updatedAt(s.getUpdatedAt())
                .build();
    }

    // ============================================================
    // Import Excel (.xlsx) — upsert lĩnh vực theo mã
    // Cột: Code (bắt buộc), Name (bắt buộc), Description, Color, DisplayOrder, Status
    // ============================================================

    @Transactional
    public ImportBscResponse importPerspectives(UUID organizationId, MultipartFile file) {
        String filename = file.getOriginalFilename();
        if (filename == null || !filename.endsWith(".xlsx")) {
            throw new BusinessException("Chỉ hỗ trợ tập tin định dạng .xlsx");
        }
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization not found"));

        List<String> errors = new ArrayList<>();
        int successfulImports = 0;
        int totalRows = 0;

        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            Row headerRow = sheet.getRow(0);
            if (headerRow == null) throw new BusinessException("Tập tin Excel trống");

            int codeIdx = -1, nameIdx = -1, descIdx = -1, colorIdx = -1, orderIdx = -1, statusIdx = -1, fixedIdx = -1;
            for (int i = 0; i < headerRow.getLastCellNum(); i++) {
                String header = getCellString(headerRow.getCell(i));
                if (header.equalsIgnoreCase("Code")) codeIdx = i;
                else if (header.equalsIgnoreCase("Name")) nameIdx = i;
                else if (header.equalsIgnoreCase("Description")) descIdx = i;
                else if (header.equalsIgnoreCase("Color")) colorIdx = i;
                else if (header.equalsIgnoreCase("DisplayOrder")) orderIdx = i;
                else if (header.equalsIgnoreCase("Status")) statusIdx = i;
                else if (header.equalsIgnoreCase("FixedPerspective") || header.equalsIgnoreCase("Perspective")) fixedIdx = i;
            }
            if (codeIdx == -1 || nameIdx == -1) {
                throw new BusinessException("Thiếu các cột bắt buộc: Code, Name");
            }

            int nextOrder = (int) perspectiveRepository.countByOrganizationId(organizationId) + 1;
            java.util.Set<Integer> seenOrders = new java.util.HashSet<>();

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;
                String code = getCellString(row.getCell(codeIdx));
                String name = nameIdx != -1 ? getCellString(row.getCell(nameIdx)) : "";
                if (code.isBlank() && name.isBlank()) continue; // dòng trống
                totalRows++;
                try {
                    if (code.isBlank()) throw new BusinessException("Mã hạng mục là bắt buộc");
                    if (name.isBlank()) throw new BusinessException("Tên hạng mục là bắt buộc");
                    if (!code.matches("^[A-Za-z0-9_]+$")) throw new BusinessException("Mã '" + code + "' chỉ gồm chữ, số và dấu gạch dưới");
                    if (isReservedFixedCode(code)) throw new BusinessException("Mã '" + code + "' trùng mã lĩnh vực cố định — vui lòng dùng mã khác cho hạng mục");

                    String desc = descIdx != -1 ? getCellString(row.getCell(descIdx)) : null;
                    String color = colorIdx != -1 ? getCellString(row.getCell(colorIdx)) : null;
                    if (color != null && !color.isBlank() && !color.matches("^#([0-9A-Fa-f]{6})$")) {
                        throw new BusinessException("Màu '" + color + "' không hợp lệ (định dạng #RRGGBB)");
                    }
                    String statusStr = statusIdx != -1 ? getCellString(row.getCell(statusIdx)) : null;
                    BscPerspectiveStatus status = BscPerspectiveStatus.ACTIVE;
                    if (statusStr != null && !statusStr.isBlank()) {
                        try { status = BscPerspectiveStatus.valueOf(statusStr.trim().toUpperCase()); }
                        catch (Exception e) { throw new BusinessException("Trạng thái '" + statusStr + "' không hợp lệ (ACTIVE/INACTIVE)"); }
                    }
                    Integer displayOrder = null;
                    if (orderIdx != -1) {
                        String orderStr = getCellString(row.getCell(orderIdx));
                        if (!orderStr.isBlank()) {
                            try { displayOrder = (int) Double.parseDouble(orderStr); }
                            catch (Exception e) { throw new BusinessException("Thứ tự '" + orderStr + "' phải là số"); }
                            if (!seenOrders.add(displayOrder)) {
                                throw new BusinessException("Thứ tự hiển thị '" + displayOrder + "' bị trùng trong tệp");
                            }
                        }
                    }

                    // Lĩnh vực cố định: đọc từ cột (nếu có), không hợp lệ/bỏ trống ⇒ mặc định Quy trình nội bộ.
                    BscFixedPerspective fixed = BscFixedPerspective.INTERNAL_PROCESS;
                    if (fixedIdx != -1) {
                        String fixedStr = getCellString(row.getCell(fixedIdx));
                        if (fixedStr != null && !fixedStr.isBlank()) {
                            try { fixed = BscFixedPerspective.valueOf(fixedStr.trim().toUpperCase()); }
                            catch (Exception e) { fixed = BscFixedPerspective.INTERNAL_PROCESS; }
                        }
                    }

                    // Upsert theo mã (chỉ bản ghi chưa xoá mềm)
                    BscPerspective existing = perspectiveRepository
                            .findFirstByOrganizationIdAndCodeIgnoreCase(organizationId, code).orElse(null);

                    int order = displayOrder != null ? displayOrder : (existing != null ? existing.getDisplayOrder() : nextOrder++);

                    if (existing != null) {
                        existing.setName(name);
                        existing.setDescription(desc);
                        if (color != null && !color.isBlank()) existing.setColor(color);
                        existing.setDisplayOrder(order);
                        existing.setStatus(status);
                        if (existing.getFixedPerspective() == null || fixedIdx != -1) existing.setFixedPerspective(fixed);
                        perspectiveRepository.save(existing);
                    } else {
                        perspectiveRepository.save(BscPerspective.builder()
                                .organization(organization)
                                .code(code)
                                .name(name)
                                .description(desc)
                                .color(color != null && !color.isBlank() ? color : "#8b5cf6")
                                .displayOrder(order)
                                .status(status)
                                .fixedPerspective(fixed)
                                .build());
                    }
                    successfulImports++;
                } catch (Exception e) {
                    errors.add("Dòng " + (i + 1) + ": " + e.getMessage());
                }
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("Lỗi đọc tập tin Excel: " + e.getMessage());
        }

        return ImportBscResponse.builder()
                .totalRows(totalRows)
                .successfulImports(successfulImports)
                .errors(errors)
                .build();
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
    // Import Excel bộ tiêu chí (.xlsx) — mỗi dòng = 1 trọng số lĩnh vực trong 1 kỳ
    // Cột: Period (bắt buộc), ScorecardName (bắt buộc), Vision, PerspectiveCode (bắt buộc),
    //      Weight (bắt buộc), Status, ScoringMode, EmptyPolicy. Gom nhóm theo Period → upsert scorecard.
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

        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            Row headerRow = sheet.getRow(0);
            if (headerRow == null) throw new BusinessException("Tập tin Excel trống");

            int periodIdx = -1, nameIdx = -1, visionIdx = -1, pCodeIdx = -1, weightIdx = -1, statusIdx = -1, modeIdx = -1, policyIdx = -1, unitsIdx = -1;
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
                    BscPerspective perspective = perspectiveRepository
                            .findFirstByOrganizationIdAndCodeIgnoreCase(organizationId, w.getKey())
                            .orElseThrow(() -> new BusinessException("Không tìm thấy hạng mục mã '" + w.getKey() + "'"));
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
