package com.kpitracking.service;

import com.kpitracking.dto.request.kpi.BscKpiAllocationRequest;
import com.kpitracking.dto.request.kpi.CreateKpiCriteriaRequest;
import com.kpitracking.dto.request.kpi.CreateKpiFromBscRequest;
import com.kpitracking.dto.response.bsc.BscKpiPlanPeriodResponse;
import com.kpitracking.dto.response.bsc.BscKpiPlanResponse;
import com.kpitracking.dto.response.bsc.ScorecardOrgUnitResponse;
import com.kpitracking.dto.response.kpi.KpiCriteriaResponse;
import com.kpitracking.entity.BscScorecard;
import com.kpitracking.entity.BscScorecardPerspective;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.UserStatus;
import com.kpitracking.enums.KpiType;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.BscScorecardPerspectiveRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * "KPI = BSC": chia MỘT dòng chỉ tiêu của bộ tiêu chí thành các KPI theo từng đợt.
 *
 * <p>Trước đây trưởng đơn vị phải tự gõ lại từng KPI rồi nhớ gán đúng hạng mục, nên con số ở BSC
 * và con số ở KPI trôi khỏi nhau. Ở đây mục tiêu của hạng mục (VD doanh thu 100 triệu cho một kỳ
 * gồm 2 đợt) được chia thẳng ra KPI của từng đợt và gắn sẵn vào đúng dòng chỉ tiêu, nên KPI vừa
 * tạo tự cộng ngược vào kết quả BSC của đơn vị.
 *
 * <p>Việc TẠO vẫn đi qua {@link KpiCriteriaService#createKpiCriteria} chứ không tự dựng entity:
 * mọi phép kiểm quyền theo đơn vị, tần suất so với đợt, hạn chót trong đợt và sự kiện thông báo
 * đều nằm ở đó — viết lại ở đây là sớm muộn lệch luật.
 */
@Service
@RequiredArgsConstructor
public class BscKpiPlanService {

    /**
     * Trạng thái được coi là "đã chia" khi tính phần còn lại.
     *
     * <p>Rộng hơn {@link BscScoringService#ACTIVE_STATUSES} một cách CÓ CHỦ Ý: KPI vừa tạo còn ở
     * nháp/chờ duyệt vẫn đang giữ chỗ của mục tiêu. Không đếm chúng thì chia xong đợt 1, mở lại
     * vẫn thấy "còn nguyên 100 triệu" và người dùng chia thêm một lần nữa.
     */
    private static final List<KpiStatus> PLANNED_STATUSES = List.of(
            KpiStatus.DRAFT, KpiStatus.PENDING_APPROVAL, KpiStatus.APPROVED,
            KpiStatus.EDIT, KpiStatus.EDITED, KpiStatus.INACTIVE);

    private final BscScorecardPerspectiveRepository scorecardPerspectiveRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final BscService bscService;
    private final BscCascadeService cascadeService;
    private final KpiCriteriaService kpiCriteriaService;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;

    // ============================================================
    // Đọc kế hoạch chia
    // ============================================================

    @Transactional(readOnly = true)
    public BscKpiPlanResponse plan(UUID scorecardPerspectiveId) {
        BscScorecardPerspective row = loadRow(scorecardPerspectiveId);
        BscScorecard scorecard = row.getScorecard();
        List<UUID> unitIds = unitIdsOf(scorecard);

        double allocatedTotal = 0.0;
        List<BscKpiPlanPeriodResponse> periods = new ArrayList<>();
        for (KpiPeriod period : sortedPeriodsOf(scorecard)) {
            List<KpiCriteria> linked = linkedKpis(unitIds, period.getId(), row);
            double value = linked.stream().filter(k -> k.getTargetValue() != null)
                    .mapToDouble(KpiCriteria::getTargetValue).sum();
            double weight = linked.stream().mapToDouble(k -> k.getWeight() != null ? k.getWeight() : 0.0).sum();
            allocatedTotal += value;
            periods.add(BscKpiPlanPeriodResponse.builder()
                    .kpiPeriodId(period.getId())
                    .name(period.getName())
                    .periodType(period.getPeriodType())
                    .startDate(period.getStartDate())
                    .endDate(period.getEndDate())
                    .allocatedValue(value)
                    .allocatedWeight(weight)
                    .kpiCount(linked.size())
                    .build());
        }

        Double target = BscCascadeService.effectiveTarget(row);
        return BscKpiPlanResponse.builder()
                .scorecardId(scorecard.getId())
                .scorecardName(scorecard.getName())
                .scorecardPerspectiveId(row.getId())
                .perspectiveId(row.getPerspective().getId())
                .name(row.getPerspective().getName())
                .color(row.getPerspective().getColor())
                .unit(effectiveUnit(row))
                .targetValue(target)
                .minimumValue(BscCascadeService.effectiveMinimum(row))
                .weightPercentage(row.getWeightPercentage())
                .orgUnits(scorecard.getOrgUnits() == null ? List.of() : scorecard.getOrgUnits().stream()
                        .map(u -> ScorecardOrgUnitResponse.builder().id(u.getId()).name(u.getName()).build())
                        .collect(Collectors.toList()))
                .periods(periods)
                .allocatedValue(allocatedTotal)
                .remainingValue(target != null ? target - allocatedTotal : null)
                .build();
    }

    // ============================================================
    // Tạo KPI theo bản chia
    // ============================================================

    @Transactional
    public List<KpiCriteriaResponse> createFromBsc(CreateKpiFromBscRequest request) {
        BscScorecardPerspective row = loadRow(request.getScorecardPerspectiveId());
        BscScorecard scorecard = row.getScorecard();

        Map<UUID, KpiPeriod> periodsInScope = sortedPeriodsOf(scorecard).stream()
                .collect(Collectors.toMap(KpiPeriod::getId, Function.identity(), (a, b) -> a));
        if (periodsInScope.isEmpty()) {
            throw new BusinessException("Bộ tiêu chí " + scorecard.getName() + " chưa gắn đợt nào — "
                    + "hãy gắn kỳ hoặc đợt cho bộ tiêu chí trước khi chia chỉ tiêu thành KPI.");
        }

        List<UUID> targetUnitIds = resolveTargetUnits(request, scorecard);
        List<BscKpiAllocationRequest> allocations = request.getAllocations();
        validateAllocations(allocations, periodsInScope);
        validateTotalWithinTarget(row, scorecard, allocations, targetUnitIds.size());

        String unit = request.getUnit() != null && !request.getUnit().isBlank()
                ? request.getUnit() : effectiveUnit(row);

        // Giao cho cả đơn vị ⇒ mỗi đơn vị nhận danh sách nhân sự CỦA CHÍNH NÓ, nên phải tạo từng
        // đơn vị một; giao đích danh (hoặc không giao ai) thì một lượt cho cả cụm là đủ.
        boolean perUnitMembers = Boolean.TRUE.equals(request.getAssignToAllUnitMembers())
                && (request.getAssignedToIds() == null || request.getAssignedToIds().isEmpty());

        List<KpiCriteriaResponse> created = new ArrayList<>();
        for (BscKpiAllocationRequest allocation : allocations) {
            KpiPeriod period = periodsInScope.get(allocation.getKpiPeriodId());
            String name = allocation.getName() != null && !allocation.getName().isBlank()
                    ? allocation.getName().trim()
                    : row.getPerspective().getName() + " — " + period.getName();

            if (perUnitMembers) {
                for (UUID unitId : targetUnitIds) {
                    List<UUID> members = activeMemberIdsOf(unitId);
                    if (members.isEmpty()) {
                        throw new BusinessException("Đơn vị được chọn chưa có nhân sự nào để giao — "
                                + "hãy thêm người vào đơn vị, hoặc giao đích danh cho người cụ thể.");
                    }
                    created.add(kpiCriteriaService.createKpiCriteria(
                            allocationRequest(request, row, period, allocation, name, unit,
                                    List.of(unitId), members)));
                }
            } else {
                created.add(kpiCriteriaService.createKpiCriteria(
                        allocationRequest(request, row, period, allocation, name, unit,
                                targetUnitIds, request.getAssignedToIds())));
            }
        }
        return created;
    }

    private CreateKpiCriteriaRequest allocationRequest(
            CreateKpiFromBscRequest request, BscScorecardPerspective row, KpiPeriod period,
            BscKpiAllocationRequest allocation, String name, String unit,
            List<UUID> orgUnitIds, List<UUID> assignedToIds) {
        return CreateKpiCriteriaRequest.builder()
                .name(name)
                .kpiType(KpiType.QUANTITATIVE)
                .description(request.getDescription())
                .weight(allocation.getWeight())
                .targetValue(allocation.getTargetValue())
                .minimumValue(allocation.getMinimumValue())
                .unit(unit)
                .frequency(allocation.getFrequency() != null ? allocation.getFrequency() : period.getPeriodType())
                .orgUnitIds(orgUnitIds)
                .assignedToIds(assignedToIds)
                .kpiPeriodId(period.getId())
                .isReverseKpi(Boolean.TRUE.equals(request.getIsReverseKpi()))
                .isBonusKpi(false)
                .deadline(allocation.getDeadline())
                .perspectiveId(row.getPerspective().getId())
                .scorecardPerspectiveId(row.getId())
                .build();
    }

    /**
     * Nhân sự đang hoạt động của một đơn vị.
     *
     * <p>Lấy thẳng từ bảng phân công chứ không mượn danh sách của màn quản lý người dùng: danh sách
     * đó còn bị cắt theo quyền xem và theo cấp bậc của người đang đăng nhập, dùng ở đây thì "cả đơn
     * vị" lại thiếu người một cách vô hình.
     */
    private List<UUID> activeMemberIdsOf(UUID orgUnitId) {
        return userRoleOrgUnitRepository.findByOrgUnitId(orgUnitId).stream()
                .map(assignment -> assignment.getUser())
                .filter(u -> u != null && u.getDeletedAt() == null && u.getStatus() == UserStatus.ACTIVE)
                .map(User::getId)
                .distinct()
                .collect(Collectors.toList());
    }

    // ============================================================
    // Helpers
    // ============================================================

    private BscScorecardPerspective loadRow(UUID scorecardPerspectiveId) {
        BscScorecardPerspective row = scorecardPerspectiveRepository.findById(scorecardPerspectiveId)
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu BSC", "id", scorecardPerspectiveId));
        if (row.getPerspective() == null || row.getScorecard() == null) {
            throw new BusinessException("Chỉ tiêu BSC này thiếu hạng mục hoặc bộ tiêu chí gốc");
        }
        return row;
    }

    /** Đợt của bộ tiêu chí, xếp theo thời gian để bảng chia hiện đúng thứ tự đợt 1 → đợt 2. */
    private List<KpiPeriod> sortedPeriodsOf(BscScorecard scorecard) {
        return bscService.effectivePeriodsOf(scorecard).stream()
                .sorted(Comparator.comparing(KpiPeriod::getStartDate,
                        Comparator.nullsLast(Comparator.<java.time.Instant>naturalOrder())))
                .collect(Collectors.toList());
    }

    private List<UUID> unitIdsOf(BscScorecard scorecard) {
        return scorecard.getOrgUnits() == null ? List.of()
                : scorecard.getOrgUnits().stream().map(OrgUnit::getId).collect(Collectors.toList());
    }

    /** KPI của các đơn vị trong một đợt đang tính vào ĐÚNG dòng chỉ tiêu này. */
    private List<KpiCriteria> linkedKpis(List<UUID> unitIds, UUID periodId, BscScorecardPerspective row) {
        if (unitIds.isEmpty()) return List.of();
        return cascadeService.kpisOfRow(
                kpiCriteriaRepository.findByOrgUnitsAndPeriod(unitIds, periodId, PLANNED_STATUSES), row);
    }

    private String effectiveUnit(BscScorecardPerspective row) {
        if (row.getUnit() != null && !row.getUnit().isBlank()) return row.getUnit();
        return row.getPerspective() != null ? row.getPerspective().getUnit() : null;
    }

    /**
     * Đơn vị nhận KPI. Mặc định là các phòng ban của bộ tiêu chí; chọn tay thì phải nằm TRONG
     * số đó — KPI gắn vào đơn vị ngoài phạm vi sẽ không được cộng vào kết quả BSC của bộ tiêu chí,
     * tức là im lặng không có tác dụng gì.
     */
    private List<UUID> resolveTargetUnits(CreateKpiFromBscRequest request, BscScorecard scorecard) {
        List<UUID> scorecardUnits = unitIdsOf(scorecard);
        List<UUID> requested = request.getOrgUnitIds() == null ? List.of()
                : new ArrayList<>(new LinkedHashSet<>(request.getOrgUnitIds()));

        if (requested.isEmpty()) {
            if (scorecardUnits.isEmpty()) {
                throw new BusinessException("Bộ tiêu chí " + scorecard.getName() + " áp dụng cho toàn tổ chức "
                        + "nên không suy ra được đơn vị nhận KPI — hãy chọn đơn vị thực hiện.");
            }
            return scorecardUnits;
        }

        if (!scorecardUnits.isEmpty()) {
            Set<UUID> allowed = new HashSet<>(scorecardUnits);
            for (UUID id : requested) {
                if (!allowed.contains(id)) {
                    String names = scorecard.getOrgUnits().stream().map(OrgUnit::getName)
                            .collect(Collectors.joining(", "));
                    throw new BusinessException("Đơn vị được chọn nằm ngoài phạm vi bộ tiêu chí "
                            + scorecard.getName() + " (" + names + ") nên KPI sẽ không được tính vào kết quả BSC.");
                }
            }
        }
        return requested;
    }

    private void validateAllocations(List<BscKpiAllocationRequest> allocations, Map<UUID, KpiPeriod> periodsInScope) {
        Set<UUID> seen = new HashSet<>();
        for (BscKpiAllocationRequest allocation : allocations) {
            KpiPeriod period = periodsInScope.get(allocation.getKpiPeriodId());
            if (period == null) {
                throw new BusinessException("Đợt được chọn không thuộc phạm vi áp dụng của bộ tiêu chí này");
            }
            if (!seen.add(allocation.getKpiPeriodId())) {
                throw new BusinessException("Đợt " + period.getName() + " bị chia hai lần trong cùng một lần tạo");
            }
            if (allocation.getWeight() == null || allocation.getWeight() <= 0) {
                throw new BusinessException("Đợt " + period.getName() + ": trọng số phải lớn hơn 0");
            }
        }
    }

    /**
     * Tổng phần chia (đã có + đang tạo) không được vượt mục tiêu của chỉ tiêu.
     *
     * <p>Chia cho NHIỀU đơn vị thì mỗi đơn vị nhận một bản KPI, và kết quả BSC cộng cả các đơn vị
     * của bộ tiêu chí lại — nên phần đang tạo phải nhân với số đơn vị, nếu không "chia 100 triệu
     * cho 2 phòng" âm thầm thành 200 triệu.
     *
     * <p>Bỏ qua với KPI ngược (mục tiêu càng thấp càng tốt): cộng dồn ngưỡng lỗi/chi phí của các
     * đợt rồi so với mục tiêu không nói lên điều gì.
     */
    private void validateTotalWithinTarget(BscScorecardPerspective row, BscScorecard scorecard,
                                           List<BscKpiAllocationRequest> allocations, int unitCount) {
        Double target = BscCascadeService.effectiveTarget(row);
        if (target == null || target <= 0) return;

        List<UUID> unitIds = unitIdsOf(scorecard);
        double already = 0.0;
        for (KpiPeriod period : sortedPeriodsOf(scorecard)) {
            already += linkedKpis(unitIds, period.getId(), row).stream()
                    .filter(k -> k.getTargetValue() != null)
                    .mapToDouble(KpiCriteria::getTargetValue).sum();
        }
        double adding = allocations.stream()
                .mapToDouble(a -> a.getTargetValue() != null ? a.getTargetValue() : 0.0)
                .sum() * Math.max(unitCount, 1);

        if (already + adding > target + 0.001) {
            throw new BusinessException("Tổng mục tiêu chia cho các đợt (" + round1(already + adding)
                    + ") vượt mục tiêu của hạng mục " + row.getPerspective().getName() + " ("
                    + round1(target) + (already > 0 ? "; đã chia trước đó: " + round1(already) : "")
                    + "). Hãy giảm bớt ở một trong các đợt.");
        }
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
