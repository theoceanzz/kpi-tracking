package com.kpitracking.service;

import com.kpitracking.dto.request.bsc.CascadeRequest;
import com.kpitracking.dto.request.bsc.CascadeTargetRequest;
import com.kpitracking.dto.response.bsc.CoverageChildResponse;
import com.kpitracking.dto.response.bsc.CoverageItemResponse;
import com.kpitracking.dto.response.bsc.ScorecardCoverageResponse;
import com.kpitracking.dto.response.bsc.ScorecardTreeNodeResponse;
import com.kpitracking.entity.BscScorecard;
import com.kpitracking.entity.BscScorecardPerspective;
import com.kpitracking.entity.BscUnitResult;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.enums.BscGateScope;
import com.kpitracking.enums.BscItemOrigin;
import com.kpitracking.enums.BscLinkType;
import com.kpitracking.enums.BscScorecardApplyScope;
import com.kpitracking.enums.BscScorecardLevel;
import com.kpitracking.enums.BscScorecardStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.BscScorecardPerspectiveRepository;
import com.kpitracking.repository.BscScorecardRepository;
import com.kpitracking.repository.BscUnitResultRepository;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Cây BSC: phân rã chỉ tiêu xuống đơn vị, đo độ phủ, và vòng đời trình–duyệt
 * (docs/bsc-cascade-design.md — mục 4).
 *
 * <p>Tách khỏi {@link BscService} (vốn đã lo danh mục hạng mục + CRUD bộ tiêu chí + import Excel)
 * vì đây là một nhóm nghiệp vụ khác hẳn: nó thao tác trên QUAN HỆ giữa các bộ tiêu chí.
 */
@Service
@RequiredArgsConstructor
public class BscTreeService {

    private final BscScorecardRepository scorecardRepository;
    private final BscScorecardPerspectiveRepository itemRepository;
    private final BscUnitResultRepository unitResultRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final UserRepository userRepository;
    private final BscAccessGuard accessGuard;

    /** Sai số cho phép khi so tổng đóng góp với mục tiêu cha: 1% hoặc 0.01 tuyệt đối. */
    private static final double COVERAGE_TOLERANCE_RATIO = 0.01;

    // ============================================================
    // Phân rã chỉ tiêu xuống đơn vị
    // ============================================================

    /**
     * Giao MỘT chỉ tiêu của bộ tiêu chí cha xuống nhiều đơn vị.
     *
     * <p>Mỗi đơn vị nhận một dòng {@code ASSIGNED + locked}. Nếu đơn vị đã có bộ tiêu chí cho đợt
     * này thì dòng được thêm vào THẺ ĐÓ chứ không tạo thẻ mới — tạo thêm sẽ sinh hai bộ tiêu chí
     * cùng áp cho một phòng trong một đợt, và luồng chấm điểm không biết chọn cái nào.
     */
    @Transactional
    public ScorecardCoverageResponse cascade(UUID parentScorecardId, CascadeRequest request) {
        BscScorecard parent = scorecardRepository.findById(parentScorecardId)
                .orElseThrow(() -> new ResourceNotFoundException("Bộ tiêu chí", "id", parentScorecardId));
        if (parent.getStatus() == BscScorecardStatus.LOCKED) {
            throw new BusinessException("Bộ tiêu chí đã khoá — mở khoá trước khi phân rã");
        }

        BscScorecardPerspective parentItem = itemRepository.findById(request.getScorecardPerspectiveId())
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu", "id", request.getScorecardPerspectiveId()));
        if (!parentItem.getScorecard().getId().equals(parentScorecardId)) {
            throw new BusinessException("Chỉ tiêu không thuộc bộ tiêu chí đang phân rã");
        }
        if (request.getTargets() == null || request.getTargets().isEmpty()) {
            throw new BusinessException("Chưa chọn đơn vị nào để phân rã");
        }

        BscLinkType linkType = request.getLinkType() != null ? request.getLinkType() : BscLinkType.SUM;
        User actor = currentUserOrNull();
        UUID orgId = parent.getOrganization().getId();

        for (CascadeTargetRequest target : request.getTargets()) {
            OrgUnit unit = orgUnitRepository.findById(target.getOrgUnitId())
                    .orElseThrow(() -> new ResourceNotFoundException("Phòng ban", "id", target.getOrgUnitId()));
            assertCascadeTarget(parent, unit);

            BscScorecard child = findOrCreateChild(parent, unit, orgId, actor);

            List<BscScorecardPerspective> childRows =
                    itemRepository.findByScorecardIdOrderByDisplayOrderAsc(child.getId());
            BscScorecardPerspective row = childRows.stream()
                    .filter(r -> r.getPerspective().getId().equals(parentItem.getPerspective().getId()))
                    .findFirst()
                    .orElseGet(() -> BscScorecardPerspective.builder()
                            .scorecard(child)
                            .perspective(parentItem.getPerspective())
                            .displayOrder(childRows.size())
                            .createdBy(actor)
                            .build());

            row.setParentItem(parentItem);
            row.setLinkType(linkType);
            row.setOrigin(BscItemOrigin.ASSIGNED);
            row.setLocked(true);
            row.setContributionValue(target.getContributionValue());
            row.setContributionPercent(target.getContributionPercent());
            // Mục tiêu của đơn vị mặc định BẰNG mức đóng góp: hai con số này gần như luôn là một,
            // bắt nhập hai lần chỉ tạo cơ hội gõ lệch.
            row.setTargetValue(target.getTargetValue() != null ? target.getTargetValue() : target.getContributionValue());
            row.setMinimumValue(target.getMinimumValue());
            row.setUnit(target.getUnit() != null && !target.getUnit().isBlank()
                    ? target.getUnit() : parentItem.getUnit());
            if (target.getWeightPercentage() != null) {
                row.setWeightPercentage(target.getWeightPercentage());
            } else if (row.getWeightPercentage() == null) {
                // Để 0 và bắt đơn vị tự chia — hệ thống đoán trọng số hộ thì con số đó không ai chịu
                // trách nhiệm, mà tổng vẫn phải đủ 100% lúc trình duyệt.
                row.setWeightPercentage(0.0);
            }
            // Chỉ tiêu chặn được thừa kế xuống: cấp trên đã coi là điều kiện bắt buộc thì đơn vị
            // không được lặng lẽ bỏ qua.
            if (Boolean.TRUE.equals(parentItem.getIsGate())) {
                row.setIsGate(true);
                row.setGateMinPercent(parentItem.getGateMinPercent());
                row.setGateEffect(parentItem.getGateEffect());
                row.setGateCapRating(parentItem.getGateCapRating());
                row.setGateAppliesTo(parentItem.getGateAppliesTo() != null
                        ? parentItem.getGateAppliesTo() : BscGateScope.BOTH);
            }
            itemRepository.save(row);
        }

        return coverage(parentScorecardId);
    }

    /**
     * Phân rã chỉ đi XUỐNG cây tổ chức: đơn vị nhận phải nằm dưới đơn vị của thẻ đang phân rã.
     *
     * <p>Thiếu chốt này thì từ BSC của một team giao ngược lên phòng cha được, và cây BSC sinh ra
     * quan hệ ngược chiều cây tổ chức: thẻ "Team Frontend" thành cha của thẻ "Phòng IT". Lúc chấm
     * điểm, một nhân viên phòng IT đi ngược lên cây đơn vị sẽ gặp thẻ phòng trước, còn tầng hệ số
     * lại coi phòng là con của team — hai chiều mâu thuẫn nhau mà không có chỗ nào báo lỗi.
     *
     * <p>Thẻ KHÔNG gắn đơn vị nào là BSC toàn tổ chức dạng cũ: giao xuống đâu cũng hợp lệ.
     */
    private void assertCascadeTarget(BscScorecard parent, OrgUnit target) {
        List<OrgUnit> owners = parent.getOrgUnits();
        if (owners == null || owners.isEmpty()) return;

        for (OrgUnit owner : owners) {
            if (isDescendant(target, owner)) return;
        }
        String ownerNames = String.join(", ", owners.stream().map(OrgUnit::getName).toList());
        throw new BusinessException("Chỉ giao được chỉ tiêu xuống đơn vị cấp dưới. \""
                + target.getName() + "\" không nằm dưới " + ownerNames + ".");
    }

    /** {@code target} có nằm DƯỚI {@code ancestor} không (không tính chính nó). */
    private static boolean isDescendant(OrgUnit target, OrgUnit ancestor) {
        OrgUnit cur = target.getParent();
        int guard = 0; // chặn treo request nếu dữ liệu cây đơn vị bị lỗi vòng
        while (cur != null && guard++ < 100) {
            if (cur.getId().equals(ancestor.getId())) return true;
            cur = cur.getParent();
        }
        return false;
    }

    /**
     * Bộ tiêu chí của đơn vị nhận phân rã: nhận nuôi thẻ sẵn có nếu đơn vị đã có thẻ cho đợt này,
     * ngược lại tạo thẻ mới ở trạng thái nháp.
     */
    private BscScorecard findOrCreateChild(BscScorecard parent, OrgUnit unit, UUID orgId, User actor) {
        // 1. Thẻ con đã gắn cây sẵn
        for (BscScorecard child : scorecardRepository.findByParentScorecardId(parent.getId())) {
            boolean coversUnit = child.getOrgUnits() != null
                    && child.getOrgUnits().stream().anyMatch(u -> u.getId().equals(unit.getId()));
            if (coversUnit) return child;
        }

        // 2. Thẻ đơn vị đã có sẵn cho đợt này (do trưởng phòng tự tạo trước — kịch bản (c)):
        //    nhận nuôi vào cây thay vì tạo thẻ thứ hai cho cùng một phòng trong cùng một đợt.
        List<KpiPeriod> periods = effectivePeriodsOf(parent);
        for (KpiPeriod period : periods) {
            List<BscScorecard> existing =
                    scorecardRepository.findByOrgUnitAndPeriod(orgId, unit.getId(), period.getId());
            for (BscScorecard sc : existing) {
                if (sc.getId().equals(parent.getId())) continue;
                if (sc.getParentScorecard() == null) {
                    sc.setParentScorecard(parent);
                    scorecardRepository.save(sc);
                }
                return sc;
            }
        }

        // 3. Tạo mới, thừa hưởng phạm vi thời gian và tham số chấm điểm của thẻ cha
        BscScorecard child = BscScorecard.builder()
                .organization(parent.getOrganization())
                .orgUnits(new ArrayList<>(List.of(unit)))
                .level(BscScorecardLevel.UNIT)
                .parentScorecard(parent)
                .applyScope(parent.getApplyScope())
                .kpiPeriods(parent.getApplyScope() == BscScorecardApplyScope.CYCLE
                        ? new ArrayList<>() : new ArrayList<>(parent.getKpiPeriods()))
                .kpiCycle(parent.getKpiCycle())
                .name(parent.getName() + " — " + unit.getName())
                .status(BscScorecardStatus.DRAFT)
                .scoringMode(parent.getScoringMode())
                .emptyPerspectivePolicy(parent.getEmptyPerspectivePolicy())
                .owner(actor)
                .build();
        return scorecardRepository.save(child);
    }

    // ============================================================
    // Độ phủ (FR-015)
    // ============================================================

    @Transactional(readOnly = true)
    public ScorecardCoverageResponse coverage(UUID scorecardId) {
        BscScorecard scorecard = scorecardRepository.findById(scorecardId)
                .orElseThrow(() -> new ResourceNotFoundException("Bộ tiêu chí", "id", scorecardId));

        List<BscScorecardPerspective> rows = itemRepository.findByScorecardIdOrderByDisplayOrderAsc(scorecardId);
        List<UUID> rowIds = rows.stream().map(BscScorecardPerspective::getId).toList();

        Map<UUID, List<BscScorecardPerspective>> childrenByParent = new HashMap<>();
        if (!rowIds.isEmpty()) {
            for (BscScorecardPerspective child : itemRepository.findByParentItemIdIn(rowIds)) {
                childrenByParent.computeIfAbsent(child.getParentItem().getId(), k -> new ArrayList<>()).add(child);
            }
        }

        List<CoverageItemResponse> items = new ArrayList<>();
        int notCascaded = 0, under = 0, ok = 0, over = 0;

        for (BscScorecardPerspective row : rows) {
            List<BscScorecardPerspective> children = childrenByParent.getOrDefault(row.getId(), List.of());
            Double target = row.getTargetValue() != null ? row.getTargetValue() : row.getPerspective().getTargetValue();

            // Chỉ SUM mới cộng dồn. SHARED = nhiều đơn vị cùng gánh MỘT chỉ tiêu (cộng vào là đếm
            // nhiều lần cùng một kết quả); SUPPORT = vai trò hỗ trợ, không mang con số nào (FR-016).
            double sum = 0.0;
            boolean anySum = false;
            for (BscScorecardPerspective child : children) {
                if (child.getLinkType() != BscLinkType.SUM) continue;
                Double value = child.getContributionValue();
                if (value == null && child.getContributionPercent() != null && target != null) {
                    value = target * child.getContributionPercent() / 100.0;
                }
                if (value != null) {
                    sum += value;
                    anySum = true;
                }
            }

            String status;
            Double gap = null;
            if (children.isEmpty()) {
                status = "NOT_CASCADED";
                notCascaded++;
            } else if (target == null || target == 0 || !anySum) {
                // Không có mục tiêu để so thì không kết luận thiếu/đủ — báo thiếu ở đây chỉ tạo
                // cảnh báo giả mà người dùng không có cách nào dập.
                status = "OK";
                ok++;
            } else {
                double tolerance = Math.max(0.01, Math.abs(target) * COVERAGE_TOLERANCE_RATIO);
                gap = target - sum;
                if (sum < target - tolerance) { status = "UNDER"; under++; }
                else if (sum > target + tolerance) { status = "OVER"; over++; }
                else { status = "OK"; ok++; }
            }

            items.add(CoverageItemResponse.builder()
                    .scorecardPerspectiveId(row.getId())
                    .perspectiveId(row.getPerspective().getId())
                    .name(row.getPerspective().getName())
                    .color(row.getPerspective().getColor())
                    .targetValue(target)
                    .unit(row.getUnit() != null ? row.getUnit() : row.getPerspective().getUnit())
                    .cascadedValue(anySum ? sum : null)
                    .status(status)
                    .gap(gap)
                    .children(children.stream().map(this::toCoverageChild).toList())
                    .build());
        }

        return ScorecardCoverageResponse.builder()
                .scorecardId(scorecardId)
                .scorecardName(scorecard.getName())
                .notCascadedCount(notCascaded)
                .underCount(under)
                .okCount(ok)
                .overCount(over)
                .items(items)
                .build();
    }

    private CoverageChildResponse toCoverageChild(BscScorecardPerspective child) {
        BscScorecard sc = child.getScorecard();
        String unitName = sc.getOrgUnits() == null || sc.getOrgUnits().isEmpty()
                ? null
                : String.join(", ", sc.getOrgUnits().stream().map(OrgUnit::getName).toList());
        // Thẻ do phân rã sinh ra luôn gắn ĐÚNG một đơn vị; thẻ nhận nuôi thì lấy đơn vị đầu tiên.
        UUID unitId = sc.getOrgUnits() == null || sc.getOrgUnits().isEmpty()
                ? null : sc.getOrgUnits().get(0).getId();
        return CoverageChildResponse.builder()
                .scorecardPerspectiveId(child.getId())
                .scorecardId(sc.getId())
                .scorecardName(sc.getName())
                .orgUnitId(unitId)
                .orgUnitName(unitName)
                .linkType(child.getLinkType())
                .contributionValue(child.getContributionValue())
                .contributionPercent(child.getContributionPercent())
                .targetValue(child.getTargetValue())
                .weightPercentage(child.getWeightPercentage())
                .build();
    }

    // ============================================================
    // Cây BSC
    // ============================================================

    /**
     * Cây Công ty → Đơn vị của một tổ chức. {@code kpiPeriodId} chỉ dùng để đính kèm %đạt đã tính
     * của từng nhánh (bỏ trống thì cây vẫn dựng được, chỉ không có con số kết quả).
     */
    @Transactional(readOnly = true)
    public List<ScorecardTreeNodeResponse> tree(UUID organizationId, UUID kpiPeriodId) {
        List<BscScorecard> all = scorecardRepository.findByOrganizationIdOrderByCreatedAtDesc(organizationId);

        Map<UUID, BscUnitResult> resultByScorecard = new HashMap<>();
        if (kpiPeriodId != null) {
            for (BscUnitResult r : unitResultRepository.findByOrganizationAndPeriod(organizationId, kpiPeriodId)) {
                resultByScorecard.put(r.getScorecard().getId(), r);
            }
        }

        Map<UUID, List<BscScorecard>> byParent = new HashMap<>();
        List<BscScorecard> roots = new ArrayList<>();
        for (BscScorecard s : all) {
            if (s.getParentScorecard() == null) roots.add(s);
            else byParent.computeIfAbsent(s.getParentScorecard().getId(), k -> new ArrayList<>()).add(s);
        }
        // Thẻ công ty lên đầu — cây đọc từ trên xuống mới đúng thứ tự phân rã.
        roots.sort((a, b) -> Integer.compare(levelRank(a), levelRank(b)));

        List<ScorecardTreeNodeResponse> nodes = new ArrayList<>();
        for (BscScorecard root : roots) {
            nodes.add(buildNode(root, byParent, resultByScorecard, 0));
        }
        return nodes;
    }

    private static int levelRank(BscScorecard s) {
        return s.getLevel() == BscScorecardLevel.COMPANY ? 0 : 1;
    }

    private ScorecardTreeNodeResponse buildNode(BscScorecard s,
                                                Map<UUID, List<BscScorecard>> byParent,
                                                Map<UUID, BscUnitResult> results,
                                                int depth) {
        List<BscScorecardPerspective> rows = itemRepository.findByScorecardIdOrderByDisplayOrderAsc(s.getId());
        int assigned = (int) rows.stream().filter(r -> r.getOrigin() == BscItemOrigin.ASSIGNED).count();
        int gates = (int) rows.stream().filter(r -> Boolean.TRUE.equals(r.getIsGate())).count();
        double totalWeight = rows.stream()
                .mapToDouble(r -> r.getWeightPercentage() != null ? r.getWeightPercentage() : 0.0).sum();

        List<ScorecardTreeNodeResponse> children = new ArrayList<>();
        // Chặn đệ quy vô hạn nếu dữ liệu cây bị lỗi (cha-con vòng), giống guard ở resolveScorecard.
        if (depth < 20) {
            for (BscScorecard child : byParent.getOrDefault(s.getId(), List.of())) {
                children.add(buildNode(child, byParent, results, depth + 1));
            }
        }

        BscUnitResult result = results.get(s.getId());
        String unitName = s.getOrgUnits() == null || s.getOrgUnits().isEmpty()
                ? null : String.join(", ", s.getOrgUnits().stream().map(OrgUnit::getName).toList());

        return ScorecardTreeNodeResponse.builder()
                .id(s.getId())
                .name(s.getName())
                .level(s.getLevel())
                .status(s.getStatus())
                .orgUnitName(unitName)
                .periodLabel(periodLabelOf(s))
                .totalWeight(totalWeight)
                .itemCount(rows.size())
                .assignedCount(assigned)
                .gateCount(gates)
                .achievementPercent(result != null ? result.getAchievementPercent() : null)
                .bandLabel(result != null ? result.getBandCode() : null)
                .factor(result != null ? result.getFactor() : null)
                .children(children)
                .build();
    }

    // ============================================================
    // Vòng đời trình – duyệt (mục 4.2)
    // ============================================================

    /**
     * Trình bộ tiêu chí lên cấp trên. Đây là chốt chặn duy nhất bắt tổng trọng số đủ 100%:
     * lúc soạn nháp thì cho phép lệch, nếu không người dùng không thể lưu dở dang.
     */
    @Transactional
    public BscScorecard submit(UUID scorecardId) {
        BscScorecard s = load(scorecardId);
        // Trình duyệt là thao tác lên bộ tiêu chí của MỘT đơn vị, không phải quyền chung: thiếu
        // dòng này thì trưởng đơn vị nào cũng trình được bộ tiêu chí của đơn vị khác.
        accessGuard.assertCanEdit(s);
        if (s.getStatus() != BscScorecardStatus.DRAFT) {
            throw new BusinessException("Chỉ trình được bộ tiêu chí đang ở trạng thái nháp");
        }
        List<BscScorecardPerspective> rows = itemRepository.findByScorecardIdOrderByDisplayOrderAsc(scorecardId);
        if (rows.isEmpty()) {
            throw new BusinessException("Bộ tiêu chí chưa có chỉ tiêu nào");
        }
        double total = rows.stream()
                .mapToDouble(r -> r.getWeightPercentage() != null ? r.getWeightPercentage() : 0.0).sum();
        if (Math.abs(total - 100.0) > 0.01) {
            throw new BusinessException("Tổng trọng số phải bằng 100% mới trình được (hiện tại: "
                    + Math.round(total * 10) / 10.0 + "%)");
        }
        s.setStatus(BscScorecardStatus.SUBMITTED);
        s.setSubmittedBy(currentUserOrNull());
        s.setSubmittedAt(Instant.now());
        s.setRejectReason(null);
        return scorecardRepository.save(s);
    }

    @Transactional
    public BscScorecard approve(UUID scorecardId) {
        BscScorecard s = load(scorecardId);
        if (s.getStatus() != BscScorecardStatus.SUBMITTED) {
            throw new BusinessException("Chỉ duyệt được bộ tiêu chí đang chờ duyệt");
        }
        s.setStatus(BscScorecardStatus.APPROVED);
        s.setApprovedBy(currentUserOrNull());
        s.setApprovedAt(Instant.now());
        s.setRejectReason(null);
        return scorecardRepository.save(s);
    }

    /** Trả lại cho cấp dưới sửa. Lý do bắt buộc — người nhận cần biết phải sửa gì. */
    @Transactional
    public BscScorecard reject(UUID scorecardId, String reason) {
        if (reason == null || reason.isBlank()) {
            throw new BusinessException("Vui lòng nhập lý do trả lại");
        }
        BscScorecard s = load(scorecardId);
        if (s.getStatus() != BscScorecardStatus.SUBMITTED) {
            throw new BusinessException("Chỉ trả lại được bộ tiêu chí đang chờ duyệt");
        }
        s.setStatus(BscScorecardStatus.DRAFT);
        s.setRejectReason(reason.trim());
        s.setSubmittedAt(null);
        s.setSubmittedBy(null);
        return scorecardRepository.save(s);
    }

    @Transactional
    public BscScorecard activate(UUID scorecardId) {
        BscScorecard s = load(scorecardId);
        if (s.getStatus() != BscScorecardStatus.APPROVED && s.getStatus() != BscScorecardStatus.CLOSED) {
            throw new BusinessException("Chỉ áp dụng được bộ tiêu chí đã duyệt");
        }
        s.setStatus(BscScorecardStatus.ACTIVE);
        return scorecardRepository.save(s);
    }

    @Transactional
    public BscScorecard lock(UUID scorecardId) {
        BscScorecard s = load(scorecardId);
        if (s.getStatus() == BscScorecardStatus.DRAFT || s.getStatus() == BscScorecardStatus.SUBMITTED) {
            throw new BusinessException("Bộ tiêu chí chưa được duyệt thì chưa khoá được");
        }
        s.setStatus(BscScorecardStatus.LOCKED);
        s.setLockedAt(Instant.now());
        return scorecardRepository.save(s);
    }

    /** Mở khoá để sửa lại — kết quả đã công bố chỉ đổi khi đi qua đây. */
    @Transactional
    public BscScorecard reopen(UUID scorecardId) {
        BscScorecard s = load(scorecardId);
        if (s.getStatus() != BscScorecardStatus.LOCKED && s.getStatus() != BscScorecardStatus.CLOSED) {
            throw new BusinessException("Bộ tiêu chí không ở trạng thái khoá");
        }
        s.setStatus(BscScorecardStatus.ACTIVE);
        s.setLockedAt(null);
        return scorecardRepository.save(s);
    }

    // ============================================================
    // Helper
    // ============================================================

    private BscScorecard load(UUID id) {
        return scorecardRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bộ tiêu chí", "id", id));
    }

    private List<KpiPeriod> effectivePeriodsOf(BscScorecard s) {
        if (s.getApplyScope() == BscScorecardApplyScope.CYCLE && s.getKpiCycle() != null) {
            return kpiPeriodRepository.findByKpiCycleIdOrderByStartDateAsc(s.getKpiCycle().getId());
        }
        return s.getKpiPeriods() == null ? List.of() : s.getKpiPeriods();
    }

    private String periodLabelOf(BscScorecard s) {
        if (s.getApplyScope() == BscScorecardApplyScope.CYCLE && s.getKpiCycle() != null) {
            return s.getKpiCycle().getName();
        }
        List<KpiPeriod> periods = effectivePeriodsOf(s);
        return periods.isEmpty() ? null : String.join(", ", periods.stream().map(KpiPeriod::getName).toList());
    }

    private User currentUserOrNull() {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            return userRepository.findByEmail(email).orElse(null);
        } catch (Exception e) {
            return null;
        }
    }
}
