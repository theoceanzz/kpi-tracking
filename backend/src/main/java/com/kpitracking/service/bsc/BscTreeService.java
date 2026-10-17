package com.kpitracking.service.bsc;

import com.kpitracking.dto.request.bsc.CascadeRequest;
import com.kpitracking.dto.request.bsc.CascadeTargetRequest;
import com.kpitracking.dto.request.bsc.WholeCascadeRequest;
import com.kpitracking.dto.response.bsc.CoverageChildResponse;
import com.kpitracking.dto.response.bsc.CoverageItemResponse;
import com.kpitracking.dto.response.bsc.ScorecardCoverageResponse;
import com.kpitracking.dto.response.bsc.ScorecardTreeNodeResponse;
import com.kpitracking.dto.response.bsc.WholeCascadeResponse;
import com.kpitracking.entity.bsc.BscPerspective;
import com.kpitracking.entity.bsc.BscScorecard;
import com.kpitracking.entity.bsc.BscScorecardPerspective;
import com.kpitracking.entity.bsc.BscUnitResult;
import com.kpitracking.entity.kpi.KpiPeriod;
import com.kpitracking.entity.organization.OrgUnit;
import com.kpitracking.entity.user.User;
import com.kpitracking.enums.bsc.BscFixedPerspective;
import com.kpitracking.enums.bsc.BscGateScope;
import com.kpitracking.enums.bsc.BscItemOrigin;
import com.kpitracking.enums.bsc.BscLinkType;
import com.kpitracking.enums.bsc.BscScorecardApplyScope;
import com.kpitracking.enums.bsc.BscScorecardLevel;
import com.kpitracking.enums.bsc.BscScorecardStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.bsc.BscPerspectiveRepository;
import com.kpitracking.repository.bsc.BscScorecardPerspectiveRepository;
import com.kpitracking.repository.bsc.BscScorecardRepository;
import com.kpitracking.repository.bsc.BscUnitResultRepository;
import com.kpitracking.repository.bsc.BscUnitResultItemRepository;
import com.kpitracking.repository.kpi.KpiCriteriaRepository;
import com.kpitracking.repository.kpi.KpiPeriodRepository;
import com.kpitracking.repository.organization.OrgUnitRepository;
import com.kpitracking.repository.user.UserRepository;
import com.kpitracking.event.BscEvents;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.i18n.Terms;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

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
    private final BscPerspectiveRepository perspectiveRepository;
    private final BscUnitResultRepository unitResultRepository;
    private final BscUnitResultItemRepository unitResultItemRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final UserRepository userRepository;
    private final BscAccessGuard accessGuard;
    private final ApplicationEventPublisher eventPublisher;
    private final com.kpitracking.service.kpi.approval.KpiApprovalChainService approvalChain;
    private final BscCycleLockGuard cycleLockGuard;

    /** Sai số cho phép khi so tổng đóng góp với mục tiêu cha: 1% hoặc 0.01 tuyệt đối. */
    private static final double COVERAGE_TOLERANCE_RATIO = 0.01;

    // ============================================================
    // Phân rã chỉ tiêu xuống đơn vị
    // ============================================================

    /**
     * Thu hồi MỘT chỉ tiêu đã phân rã khỏi bộ tiêu chí của một đơn vị — cách duy nhất để gỡ một lần giao
     * nhầm (giao cả bộ thì thu hồi qua {@link #cascadeWhole}). Xoá hẳn dòng "Cấp trên giao" ở thẻ đơn vị.
     *
     * <p>Chặn khi xoá dòng sẽ làm mất dữ liệu đã có ý nghĩa: còn KPI gắn thẳng vào dòng (KPI sẽ mồ côi,
     * điểm BSC của người làm đổi), dòng đã được giao tiếp xuống cấp dưới (thu hồi ở cấp dưới trước), hoặc
     * dòng đã nằm trong một kết quả đợt đã chốt (số đã công bố). Kết quả nháp thì xoá dòng kết quả theo.
     */
    @Transactional
    public ScorecardCoverageResponse revokeCascade(UUID parentScorecardId, UUID parentItemId, UUID orgUnitId) {
        BscScorecard parent = scorecardRepository.findById(parentScorecardId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.scorecard"), "id", parentScorecardId));
        BscScorecardPerspective parentItem = itemRepository.findById(parentItemId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.kpi"), "id", parentItemId));
        if (!parentItem.getScorecard().getId().equals(parent.getId())) {
            throw new BusinessException(ErrorCode.KPI_OUTSIDE_SCORECARD_BEING_CASCADED);
        }
        cycleLockGuard.assertWritable(parent);
        BscScorecardPerspective row = itemRepository.findByParentItemId(parentItemId).stream()
                .filter(r -> r.getOrigin() == BscItemOrigin.ASSIGNED)
                .filter(r -> r.getScorecard().getOrgUnits() != null
                        && r.getScorecard().getOrgUnits().stream().anyMatch(u -> u.getId().equals(orgUnitId)))
                .findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.CASCADE_REVOKE_NOT_ASSIGNED));
        String unitName = row.getScorecard().getOrgUnits().stream()
                .filter(u -> u.getId().equals(orgUnitId)).map(OrgUnit::getName).findFirst().orElse("?");
        cycleLockGuard.assertWritable(row.getScorecard());
        // Dòng đến từ "giao cả bộ" đi chung với cả bộ: thu hồi lẻ một dòng thì thẻ đơn vị lệch khỏi cả bộ.
        if (row.getWholeSharePercent() != null) {
            throw new BusinessException(ErrorCode.WHOLE_ROW_REVOKE_VIA_WHOLE, unitName);
        }

        assertRevocable(row, unitName);
        BscScorecard child = row.getScorecard();
        deleteAssignedRow(row);
        itemRepository.flush();

        User actor = currentUserOrNull();
        eventPublisher.publishEvent(new BscEvents.CascadeRevoked(orgUnitId, child.getId(), idOf(actor),
                parentItem.getPerspective() != null ? parentItem.getPerspective().getName() : ""));
        return coverage(parentScorecardId);
    }

    /**
     * Dòng được giao có gỡ được không: chưa có KPI gắn vào, chưa giao tiếp xuống cấp dưới, chưa nằm trong
     * kết quả đợt đã chốt. Dùng chung cho thu hồi từng chỉ tiêu và thu hồi / đồng bộ giao cả bộ.
     */
    private void assertRevocable(BscScorecardPerspective row, String unitName) {
        long kpis = kpiCriteriaRepository.countLiveByScorecardPerspectiveId(row.getId());
        if (kpis > 0) {
            throw new BusinessException(ErrorCode.CASCADE_REVOKE_HAS_KPIS, unitName, String.valueOf(kpis));
        }
        if (!itemRepository.findByParentItemId(row.getId()).isEmpty()) {
            throw new BusinessException(ErrorCode.CASCADE_REVOKE_HAS_CHILDREN, unitName);
        }
        String finalized = unitResultItemRepository.findByScorecardPerspectiveId(row.getId()).stream()
                .filter(i -> i.getUnitResult().getStatus() != com.kpitracking.enums.bsc.BscUnitResultStatus.DRAFT)
                .map(i -> i.getUnitResult().getKpiPeriod() != null ? i.getUnitResult().getKpiPeriod().getName() : "?")
                .distinct().collect(java.util.stream.Collectors.joining(", "));
        if (!finalized.isEmpty()) {
            throw new BusinessException(ErrorCode.CASCADE_REVOKE_FINALIZED, unitName, finalized);
        }
    }

    /** Xoá một dòng được giao cùng các dòng kết quả nháp của nó. Gọi sau {@link #assertRevocable}. */
    private void deleteAssignedRow(BscScorecardPerspective row) {
        unitResultItemRepository.deleteAll(unitResultItemRepository.findByScorecardPerspectiveId(row.getId()));
        // Gỡ khỏi collection (cascade ALL) trước khi xoá, không thì Hibernate ghi lại dòng vừa xoá.
        row.getScorecard().getScorecardPerspectives().removeIf(x -> x.getId().equals(row.getId()));
        itemRepository.delete(row);
    }

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
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.scorecard"), "id", parentScorecardId));
        BscScorecardPerspective parentItem = itemRepository.findById(request.getScorecardPerspectiveId())
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.kpi"), "id", request.getScorecardPerspectiveId()));
        if (!parentItem.getScorecard().getId().equals(parentScorecardId)) {
            throw new BusinessException(ErrorCode.KPI_OUTSIDE_SCORECARD_BEING_CASCADED);
        }
        // Thẻ con luôn nằm trong đợt của thẻ cha ⇒ chặn ở thẻ cha là đủ.
        cycleLockGuard.assertWritable(parent);
        // Dòng "Kết quả cấp trên" không mang con số nào để chia — muốn giao tiếp xuống thì giao
        // cả bộ của thẻ này.
        if (BscSourceScores.sourceOf(parentItem) != null) {
            throw new BusinessException(ErrorCode.SOURCE_ROW_CANNOT_CASCADE);
        }
        if (request.getTargets() == null || request.getTargets().isEmpty()) {
            throw new BusinessException(ErrorCode.NO_UNIT_CHOSEN_CASCADE);
        }

        BscLinkType defaultLink = request.getLinkType() != null ? request.getLinkType() : BscLinkType.SUM;
        assertNoSumSharedMix(parentItem, request.getTargets(), defaultLink);
        User actor = currentUserOrNull();
        UUID orgId = parent.getOrganization().getId();
        List<BscEvents.CascadeAssignment> assignments = new ArrayList<>();

        for (CascadeTargetRequest target : request.getTargets()) {
            OrgUnit unit = orgUnitRepository.findById(target.getOrgUnitId())
                    .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.department"), "id", target.getOrgUnitId()));
            assertCascadeTarget(parent, unit);

            BscScorecard child = findOrCreateChild(parent, unit, orgId, actor);

            List<BscScorecardPerspective> childRows =
                    itemRepository.findByScorecardIdOrderByDisplayOrderAsc(child.getId());
            // Đơn vị đã nhận kết quả CẢ BỘ của thẻ này thì chỉ tiêu này đã nằm sẵn trong đó —
            // giao riêng thêm là tính trùng.
            boolean receivesWhole = childRows.stream().anyMatch(r -> {
                BscScorecard src = BscSourceScores.sourceOf(r);
                if (src != null && src.getId().equals(parent.getId())) return true;
                return r.getWholeSharePercent() != null && r.getParentItem() != null
                        && r.getParentItem().getScorecard().getId().equals(parent.getId());
            });
            if (receivesWhole) {
                throw new BusinessException(ErrorCode.ITEM_CASCADE_OVERLAPS_WHOLE, unit.getName());
            }
            BscScorecardPerspective row = childRows.stream()
                    .filter(r -> r.getPerspective().getId().equals(parentItem.getPerspective().getId()))
                    .findFirst()
                    .orElseGet(() -> BscScorecardPerspective.builder()
                            .scorecard(child)
                            .perspective(parentItem.getPerspective())
                            .displayOrder(childRows.size())
                            .createdBy(actor)
                            .build());

            boolean alreadyAssigned = row.getId() != null && row.getOrigin() == BscItemOrigin.ASSIGNED
                    && row.getParentItem() != null && row.getParentItem().getId().equals(parentItem.getId());
            row.setParentItem(parentItem);
            row.setLinkType(target.getLinkType() != null ? target.getLinkType() : defaultLink);
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
            assignments.add(new BscEvents.CascadeAssignment(
                    unit.getId(), child.getId(), row.getContributionValue(), row.getUnit(), alreadyAssigned));
        }

        // Đơn vị nhận chỉ tiêu phải biết mình vừa được giao gì — nếu không, chỉ tiêu nằm im trong
        // bộ tiêu chí của họ với trọng số 0 cho tới lúc ai đó tình cờ mở ra xem.
        eventPublisher.publishEvent(new BscEvents.ScorecardCascaded(
                parent.getId(), idOf(actor), parentItem.getPerspective().getName(), assignments));

        return coverage(parentScorecardId);
    }

    /**
     * Một chỉ tiêu chỉ có MỘT cách ra kết quả từ cấp dưới: cộng thực đạt (SUM) hoặc lấy trung bình %đạt
     * của các đơn vị cùng chịu (SHARED). Trộn hai loại thì phép gộp ({@code rollupFromChildren}) dùng
     * phần SUM và lặng lẽ bỏ qua phần SHARED — đơn vị "dùng chung" làm gì cũng không ảnh hưởng chỉ tiêu
     * cha. SUPPORT/CUSTOM không mang con số nên đi kèm loại nào cũng được.
     *
     * <p>Xét cả các đơn vị đã nhận từ trước mà lần giao này không gửi lại — chúng vẫn nằm dưới chỉ tiêu cha.
     */
    private void assertNoSumSharedMix(BscScorecardPerspective parentItem, List<CascadeTargetRequest> targets,
                                      BscLinkType defaultLink) {
        Set<UUID> requested = targets.stream().map(CascadeTargetRequest::getOrgUnitId).collect(Collectors.toSet());
        Set<BscLinkType> links = new java.util.HashSet<>();
        for (CascadeTargetRequest t : targets) {
            links.add(t.getLinkType() != null ? t.getLinkType() : defaultLink);
        }
        for (BscScorecardPerspective existing : itemRepository.findByParentItemIdIn(List.of(parentItem.getId()))) {
            List<OrgUnit> units = existing.getScorecard().getOrgUnits();
            boolean resent = units != null && units.stream().anyMatch(u -> requested.contains(u.getId()));
            if (!resent && existing.getLinkType() != null) links.add(existing.getLinkType());
        }
        if (links.contains(BscLinkType.SUM) && links.contains(BscLinkType.SHARED)) {
            throw new BusinessException(ErrorCode.CASCADE_SUM_SHARED_MIX, parentItem.getPerspective().getName());
        }
    }

    // ============================================================
    // Phân rã CẢ BỘ tiêu chí
    // ============================================================

    /**
     * Giao CẢ BỘ chỉ tiêu của {@code sourceId} xuống các đơn vị con.
     *
     * <p>Mỗi đơn vị nhận TOÀN BỘ chỉ tiêu của thẻ nguồn, mỗi chỉ tiêu một dòng {@code ASSIGNED + locked}
     * kiểu "cùng chịu chung" (mục tiêu = mục tiêu của thẻ nguồn). Trọng số X% cấp trên đặt cho đơn vị được
     * chia cho các dòng theo đúng tỉ lệ trọng số ở thẻ nguồn; (100 − X)% còn lại là hạng mục riêng của đơn vị.
     * Thẻ nguồn KHÔNG phải nhập tay: mỗi chỉ tiêu của nó = trung bình % đạt của các đơn vị ở chỉ tiêu đó
     * (cộng từ đơn vị con của {@code BscCascadeService.recompute}).
     *
     * <ul>
     *   <li>Giao lại ⇒ đồng bộ lại cả bộ theo X mới (và theo thẻ nguồn hiện tại).</li>
     *   <li>Thu hồi ({@code revokeOrgUnitIds}) ⇒ gỡ mọi dòng cả bộ khỏi thẻ đơn vị (chặn nếu dòng đã có KPI,
     *       đã giao tiếp xuống, hoặc đã chốt kết quả).</li>
     *   <li>Một đơn vị nhận từ một thẻ nguồn HOẶC cả bộ HOẶC từng chỉ tiêu — không trộn.</li>
     *   <li>Dòng "Kết quả cấp trên" kiểu cũ (một dòng lấy điểm tổng thẻ nguồn) của đơn vị được giao lại sẽ
     *       được thay bằng cả bộ kiểu mới.</li>
     * </ul>
     */
    @Transactional
    public WholeCascadeResponse cascadeWhole(UUID sourceId, WholeCascadeRequest request) {
        BscScorecard source = load(sourceId);
        cycleLockGuard.assertWritable(source);
        List<WholeCascadeRequest.Target> targets = request.getTargets() == null ? List.of() : request.getTargets();
        List<UUID> revokes = request.getRevokeOrgUnitIds() == null ? List.of() : request.getRevokeOrgUnitIds();
        if (targets.isEmpty() && revokes.isEmpty()) {
            throw new BusinessException(ErrorCode.WHOLE_CASCADE_NOTHING_TO_DO);
        }
        List<BscScorecardPerspective> sourceRows = wholeSourceRows(sourceId);
        if (!targets.isEmpty() && sourceRows.isEmpty()) {
            throw new BusinessException(ErrorCode.WHOLE_CASCADE_SOURCE_EMPTY, source.getName());
        }

        User actor = currentUserOrNull();
        UUID orgId = source.getOrganization().getId();
        Set<UUID> sourcePeriods = effectivePeriodsOf(source).stream().map(KpiPeriod::getId).collect(Collectors.toSet());
        List<BscEvents.CascadeAssignment> assignments = new ArrayList<>();

        for (WholeCascadeRequest.Target target : targets) {
            OrgUnit unit = orgUnitRepository.findById(target.getOrgUnitId())
                    .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.department"), "id", target.getOrgUnitId()));
            if (!BscWholeCascadeRules.validWeight(target.getWeightPercentage())) {
                throw new BusinessException(ErrorCode.WHOLE_CASCADE_WEIGHT_INVALID, unit.getName());
            }
            assertCascadeTarget(source, unit);

            BscScorecard child = findOrCreateChild(source, unit, orgId, actor);
            if (BscWholeCascadeRules.createsLoop(sourceId, child.getId(), this::upstreamOf)) {
                throw new BusinessException(ErrorCode.WHOLE_CASCADE_LOOP, unit.getName());
            }
            List<KpiPeriod> childPeriods = effectivePeriodsOf(child);
            Set<UUID> missing = BscWholeCascadeRules.missingPeriods(
                    childPeriods.stream().map(KpiPeriod::getId).toList(), sourcePeriods);
            if (!missing.isEmpty()) {
                String names = childPeriods.stream().filter(p -> missing.contains(p.getId()))
                        .map(KpiPeriod::getName).collect(Collectors.joining(", "));
                throw new BusinessException(ErrorCode.WHOLE_CASCADE_PERIOD_MISMATCH, unit.getName(), names);
            }

            List<BscScorecardPerspective> childRows = itemRepository.findByScorecardIdOrderByDisplayOrderAsc(child.getId());
            // Đã nhận riêng chỉ tiêu nào từ thẻ nguồn (phân rã từng chỉ tiêu) ⇒ không trộn với cả bộ.
            String overlapping = childRows.stream()
                    .filter(r -> r.getWholeSharePercent() == null && r.getParentItem() != null
                            && r.getParentItem().getScorecard().getId().equals(sourceId))
                    .map(r -> r.getPerspective().getName())
                    .collect(Collectors.joining(", "));
            if (!overlapping.isEmpty()) {
                throw new BusinessException(ErrorCode.WHOLE_CASCADE_OVERLAPS_ITEMS, unit.getName(), overlapping);
            }
            // Dòng "Kết quả cấp trên" kiểu cũ từ chính thẻ nguồn này ⇒ thay bằng cả bộ kiểu mới.
            for (BscScorecardPerspective legacy : childRows) {
                BscScorecard src = BscSourceScores.sourceOf(legacy);
                if (src != null && src.getId().equals(sourceId)) {
                    assertRevocable(legacy, unit.getName());
                    deleteAssignedRow(legacy);
                }
            }
            itemRepository.flush();

            applyWhole(child, sourceRows, target.getWeightPercentage(), unit.getName(), actor);
            assignments.add(new BscEvents.CascadeAssignment(unit.getId(), child.getId(), null, null, false));
        }

        if (!revokes.isEmpty()) {
            Set<UUID> revokeSet = Set.copyOf(revokes);
            List<BscScorecardPerspective> toRemove = new ArrayList<>();
            itemRepository.findWholeRowsFromSource(sourceId).stream().filter(r -> belongsTo(r, revokeSet)).forEach(toRemove::add);
            itemRepository.findBySourceScorecardId(sourceId).stream().filter(r -> belongsTo(r, revokeSet)).forEach(toRemove::add);
            toRemove.forEach(this::releaseWholeRow);
        }

        if (!assignments.isEmpty()) {
            eventPublisher.publishEvent(new BscEvents.ScorecardCascaded(
                    source.getId(), idOf(actor), source.getName(), assignments));
        }
        itemRepository.flush();
        return wholeCascade(sourceId);
    }

    /**
     * Thẻ nguồn vừa đổi chỉ tiêu / trọng số ⇒ đồng bộ lại cả bộ ở mọi đơn vị đang nhận (giữ nguyên X% của
     * từng đơn vị). Gọi từ {@code BscService.updateScorecard} sau khi lưu thẻ.
     */
    @Transactional
    public void syncWholeRecipients(UUID sourceId) {
        List<BscScorecardPerspective> wholeRows = itemRepository.findWholeRowsFromSource(sourceId);
        if (wholeRows.isEmpty()) return;
        List<BscScorecardPerspective> sourceRows = wholeSourceRows(sourceId);
        Map<UUID, BscScorecard> cards = new java.util.LinkedHashMap<>();
        Map<UUID, Double> shares = new HashMap<>();
        for (BscScorecardPerspective r : wholeRows) {
            cards.putIfAbsent(r.getScorecard().getId(), r.getScorecard());
            shares.putIfAbsent(r.getScorecard().getId(), r.getWholeSharePercent());
        }
        User actor = currentUserOrNull();
        for (BscScorecard card : cards.values()) {
            applyWhole(card, sourceRows, shares.get(card.getId()), unitNameOf(card), actor);
        }
        itemRepository.flush();
    }

    /**
     * Đưa thẻ đơn vị về đúng "cả bộ" của thẻ nguồn với trọng số {@code share}: mỗi dòng nguồn một dòng khoá
     * kiểu cùng chịu chung, trọng số = trọng số dòng nguồn ÷ tổng nguồn × share; dòng cả bộ không còn ứng
     * với dòng nguồn nào thì gỡ (qua đúng chốt thu hồi).
     */
    private void applyWhole(BscScorecard child, List<BscScorecardPerspective> sourceRows, double share,
                            String unitName, User actor) {
        List<BscScorecardPerspective> childRows = itemRepository.findByScorecardIdOrderByDisplayOrderAsc(child.getId());
        Set<UUID> sourceRowIds = sourceRows.stream().map(BscScorecardPerspective::getId).collect(Collectors.toSet());
        UUID sourceId = sourceRows.isEmpty() ? null : sourceRows.get(0).getScorecard().getId();

        // Dòng cả bộ mồ côi (dòng nguồn đã bị xoá khỏi thẻ nguồn) ⇒ gỡ.
        for (BscScorecardPerspective r : childRows) {
            boolean wholeFromHere = r.getWholeSharePercent() != null && (r.getParentItem() == null
                    || (sourceId != null && r.getParentItem().getScorecard().getId().equals(sourceId)));
            if (wholeFromHere && (r.getParentItem() == null || !sourceRowIds.contains(r.getParentItem().getId()))) {
                releaseWholeRow(r);
            }
        }
        itemRepository.flush();
        childRows = itemRepository.findByScorecardIdOrderByDisplayOrderAsc(child.getId());

        double sourceTotal = sourceRows.stream()
                .mapToDouble(r -> r.getWeightPercentage() != null ? r.getWeightPercentage() : 0.0).sum();
        int nextOrder = childRows.stream().mapToInt(r -> r.getDisplayOrder() != null ? r.getDisplayOrder() : 0)
                .max().orElse(-1) + 1;
        for (BscScorecardPerspective src : sourceRows) {
            // Cùng hạng mục ⇒ dùng lại dòng sẵn có của đơn vị (ràng buộc một hạng mục một dòng / thẻ).
            BscScorecardPerspective row = null;
            for (BscScorecardPerspective r : childRows) {
                if (r.getPerspective().getId().equals(src.getPerspective().getId())) { row = r; break; }
            }
            // Đơn vị đã nhận chỉ tiêu này từ một THẺ KHÁC ⇒ không lặng lẽ cướp dòng (mất liên kết cũ).
            if (row != null && row.getParentItem() != null
                    && !row.getParentItem().getScorecard().getId().equals(src.getScorecard().getId())) {
                throw new BusinessException(ErrorCode.WHOLE_CASCADE_ITEM_CONFLICT, unitName,
                        src.getPerspective().getName(), row.getParentItem().getScorecard().getName());
            }
            if (row == null) {
                row = BscScorecardPerspective.builder()
                        .scorecard(child)
                        .perspective(src.getPerspective())
                        .displayOrder(nextOrder++)
                        .createdBy(actor)
                        .build();
            }
            double srcWeight = src.getWeightPercentage() != null ? src.getWeightPercentage() : 0.0;
            double weight = sourceTotal > 0 ? srcWeight / sourceTotal * share : share / sourceRows.size();
            row.setParentItem(src);
            row.setLinkType(BscLinkType.SHARED);
            row.setOrigin(BscItemOrigin.ASSIGNED);
            row.setLocked(true);
            row.setWholeSharePercent(share);
            row.setContributionValue(null);
            row.setContributionPercent(null);
            row.setTargetValue(BscCascadeService.effectiveTarget(src));
            row.setMinimumValue(BscCascadeService.effectiveMinimum(src));
            row.setUnit(src.getUnit() != null && !src.getUnit().isBlank() ? src.getUnit() : src.getPerspective().getUnit());
            row.setWeightPercentage(Math.round(weight * 100.0) / 100.0);
            // Chỉ tiêu chặn được thừa kế xuống như phân rã từng chỉ tiêu.
            if (Boolean.TRUE.equals(src.getIsGate())) {
                row.setIsGate(true);
                row.setGateMinPercent(src.getGateMinPercent());
                row.setGateEffect(src.getGateEffect());
                row.setGateCapRating(src.getGateCapRating());
                row.setGateAppliesTo(src.getGateAppliesTo() != null ? src.getGateAppliesTo() : BscGateScope.BOTH);
            }
            itemRepository.save(row);
        }
    }

    /**
     * Gỡ một dòng khỏi "cả bộ" (thu hồi, hoặc thẻ nguồn bỏ chỉ tiêu đó). Dòng còn dữ liệu — có KPI gắn vào,
     * đã giao tiếp xuống cấp dưới, hoặc đã nằm trong kết quả đã chốt — thì TRẢ VỀ làm hạng mục riêng của
     * đơn vị (giữ KPI, giữ lịch sử); dòng trống thì xoá. Chặn hẳn như thu hồi từng chỉ tiêu thì không gỡ
     * được cả bộ chỉ vì một dòng — thường là hạng mục đơn vị tự có từ trước, bị cả bộ nhận vào.
     */
    private void releaseWholeRow(BscScorecardPerspective row) {
        boolean hasData = kpiCriteriaRepository.countLiveByScorecardPerspectiveId(row.getId()) > 0
                || !itemRepository.findByParentItemId(row.getId()).isEmpty()
                || unitResultItemRepository.findByScorecardPerspectiveId(row.getId()).stream()
                        .anyMatch(i -> i.getUnitResult().getStatus() != com.kpitracking.enums.bsc.BscUnitResultStatus.DRAFT);
        if (!hasData) {
            deleteAssignedRow(row);
            return;
        }
        row.setOrigin(BscItemOrigin.SELF);
        row.setLocked(false);
        row.setParentItem(null);
        row.setLinkType(null);
        row.setWholeSharePercent(null);
        itemRepository.save(row);
    }

    /** Dòng của thẻ nguồn được đưa xuống khi giao cả bộ (bỏ dòng "Kết quả cấp trên" kiểu cũ nếu còn). */
    private List<BscScorecardPerspective> wholeSourceRows(UUID sourceId) {
        return itemRepository.findByScorecardIdOrderByDisplayOrderAsc(sourceId).stream()
                .filter(r -> BscSourceScores.sourceOf(r) == null)
                .toList();
    }

    private static boolean belongsTo(BscScorecardPerspective row, Set<UUID> unitIds) {
        List<OrgUnit> units = row.getScorecard().getOrgUnits();
        return units != null && units.stream().anyMatch(u -> unitIds.contains(u.getId()));
    }

    private static String unitNameOf(BscScorecard card) {
        return card.getOrgUnits() == null || card.getOrgUnits().isEmpty() ? card.getName() : card.getOrgUnits().get(0).getName();
    }

    /** Hiện trạng giao cả bộ của một thẻ — modal mở lại phải thấy đúng phần đã giao (mỗi đơn vị một dòng). */
    @Transactional(readOnly = true)
    public WholeCascadeResponse wholeCascade(UUID sourceId) {
        load(sourceId);
        Map<UUID, WholeCascadeResponse.Recipient> byCard = new java.util.LinkedHashMap<>();
        List<BscScorecardPerspective> rows = new ArrayList<>(itemRepository.findWholeRowsFromSource(sourceId));
        rows.addAll(itemRepository.findBySourceScorecardId(sourceId)); // kiểu cũ còn sót: vẫn hiện để giao lại / thu hồi
        for (BscScorecardPerspective row : rows) {
            BscScorecard card = row.getScorecard();
            if (byCard.containsKey(card.getId())) continue;
            OrgUnit unit = card.getOrgUnits() == null || card.getOrgUnits().isEmpty() ? null : card.getOrgUnits().get(0);
            double total = itemRepository.findByScorecardIdOrderByDisplayOrderAsc(card.getId()).stream()
                    .mapToDouble(r -> r.getWeightPercentage() != null ? r.getWeightPercentage() : 0.0).sum();
            byCard.put(card.getId(), WholeCascadeResponse.Recipient.builder()
                    .orgUnitId(unit != null ? unit.getId() : null)
                    .orgUnitName(unit != null ? unit.getName() : null)
                    .scorecardId(card.getId())
                    .scorecardName(card.getName())
                    .scorecardPerspectiveId(row.getId())
                    .weightPercentage(row.getWholeSharePercent() != null ? row.getWholeSharePercent() : row.getWeightPercentage())
                    .scorecardTotalWeight(total)
                    .build());
        }
        return WholeCascadeResponse.builder()
                .sourceScorecardId(sourceId)
                .recipients(new ArrayList<>(byCard.values()))
                .build();
    }

    /** Các thẻ mà {@code scorecardId} đang lấy số từ đó: thẻ cha và thẻ nguồn của dòng "Kết quả cấp trên". */
    private List<UUID> upstreamOf(UUID scorecardId) {
        List<UUID> out = new ArrayList<>();
        scorecardRepository.findById(scorecardId).ifPresent(s -> {
            if (s.getParentScorecard() != null) out.add(s.getParentScorecard().getId());
        });
        for (BscScorecardPerspective row : itemRepository.findByScorecardIdOrderByDisplayOrderAsc(scorecardId)) {
            BscScorecard src = BscSourceScores.sourceOf(row);
            if (src != null) out.add(src.getId());
        }
        return out;
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
        throw new BusinessException(ErrorCode.KPIS_CAN_ONLY_ASSIGNED_DOWN_LOWER_UNITS, target.getName(), String.valueOf(ownerNames));
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
            if (child.getStatus() != null && child.getStatus().isRetired()) continue;
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
                if (sc.getStatus() != null && sc.getStatus().isRetired()) continue;
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
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.scorecard"), "id", scorecardId));

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
            // Dòng "Kết quả cấp trên" không có con số để giao tiếp xuống — đưa vào đây chỉ sinh
            // cảnh báo "chưa phân rã" giả mà đơn vị không có cách nào dập.
            if (BscSourceScores.sourceOf(row) != null) continue;
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
                .wholeSharePercent(child.getWholeSharePercent())
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
                .children(children)
                .build();
    }

    // ============================================================
    // Gắn thẻ vào cây
    // ============================================================

    /**
     * Gắn một bộ tiêu chí ĐÃ TỒN TẠI vào bộ tiêu chí cấp trên (hoặc gỡ ra khi {@code parentId} null).
     *
     * <p>Đơn vị tự dựng bộ tiêu chí của mình trước khi cấp trên phân rã là chuyện thường; thẻ đó
     * nằm mồ côi ở gốc cây, không vào được bảng độ phủ và cấp trên không thấy nó thuộc nhánh nào.
     * Trước đây chỉ có một đường nối lại: cấp trên phải phân rã một chỉ tiêu xuống chính đơn vị đó
     * ({@code findOrCreateChild} nhận nuôi thẻ có sẵn) — tức là phải giao thêm chỉ tiêu chỉ để nối
     * cây. Hàm này tách riêng việc nối, không đụng gì tới chỉ tiêu.
     *
     * <p>{@code linkItems = true} thì nối luôn các dòng chỉ tiêu TRÙNG HẠNG MỤC giữa hai thẻ
     * ({@link #linkItemsByPerspective}) — nếu không, quan hệ cha–con chỉ đổi cách vẽ cây chứ không
     * đưa được con số nào lên cấp trên.
     *
     * @return số dòng chỉ tiêu đã nối được (0 khi chỉ nối cây)
     */
    @Transactional
    public int attachParent(UUID scorecardId, UUID parentId, boolean linkItems) {
        BscScorecard child = load(scorecardId);
        accessGuard.assertCanEdit(child);
        cycleLockGuard.assertWritable(child);

        if (parentId == null) {
            child.setParentScorecard(null);
            scorecardRepository.save(child);
            // Gỡ cây phải gỡ luôn các dòng đã NỐI lên cấp trên, nếu không độ phủ của cấp trên vẫn đếm
            // chúng (từng làm một chỉ tiêu báo "giao vượt 200%" sau khi thẻ con đã gỡ ra).
            unlinkSelfRows(child, null);
            return 0;
        }
        if (parentId.equals(scorecardId)) {
            throw new BusinessException(ErrorCode.SCORECARD_CANNOT_ATTACHED_ITSELF);
        }
        // Thẻ cấp công ty (không gắn đơn vị, hoặc gắn đơn vị gốc) là gốc của cây. Vòng kiểm "cây BSC
        // cùng chiều cây tổ chức" bên dưới duyệt theo đơn vị của thẻ, nên thẻ không đơn vị lọt qua nó.
        if (child.getLevel() == com.kpitracking.enums.bsc.BscScorecardLevel.COMPANY
                || child.getOrgUnits() == null || child.getOrgUnits().isEmpty()) {
            throw new BusinessException(ErrorCode.COMPANY_LEVEL_SCORECARD_ROOT_BSC_TREE_CANNOT);
        }

        BscScorecard parent = load(parentId);
        if (!parent.getOrganization().getId().equals(child.getOrganization().getId())) {
            throw new BusinessException(ErrorCode.PARENT_SCORECARD_MUST_BELONG_SAME_ORGANIZATION_2);
        }
        // Cha nằm trong nhánh con ⇒ nối vào là tạo vòng, cây thành danh sách vòng tròn và mọi hàm
        // duyệt đệ quy (dựng cây, tra thẻ công ty) sẽ chạy tới khi chạm guard rồi trả kết quả sai.
        BscScorecard cur = parent;
        int guard = 0;
        while (cur != null && guard++ < 100) {
            if (cur.getId().equals(scorecardId)) {
                throw new BusinessException(ErrorCode.PARENT_SCORECARD_UNDER_VERY_SCORECARD);
            }
            cur = cur.getParentScorecard();
        }
        // Cùng luật với phân rã: cây BSC phải cùng chiều với cây tổ chức.
        for (OrgUnit unit : child.getOrgUnits() == null ? List.<OrgUnit>of() : child.getOrgUnits()) {
            assertCascadeTarget(parent, unit);
        }

        child.setParentScorecard(parent);
        scorecardRepository.save(child);
        // Chuyển sang cha khác: dòng còn nối với chỉ tiêu của cha CŨ phải gỡ, không thì nó vẫn được
        // đếm vào độ phủ của cha cũ và linkItemsByPerspective bỏ qua nó (đã có cha).
        unlinkSelfRows(child, parent.getId());
        return linkItems ? linkItemsByPerspective(child, parent) : 0;
    }

    /**
     * Gỡ liên kết lên cấp trên của các dòng đơn vị TỰ CÓ ({@code SELF}) — chính những dòng mà "Gắn vào
     * cây + nối chỉ tiêu trùng hạng mục" đã nối. Dòng được giao ({@code ASSIGNED}) là phân rã thật của
     * cấp trên nên giữ nguyên; muốn bỏ thì cấp trên thu hồi.
     *
     * @param keepParentId dòng đang nối vào thẻ này thì giữ (null = gỡ hết)
     */
    private void unlinkSelfRows(BscScorecard child, UUID keepParentId) {
        for (BscScorecardPerspective row : itemRepository.findByScorecardIdOrderByDisplayOrderAsc(child.getId())) {
            if (row.getParentItem() == null || row.getOrigin() == BscItemOrigin.ASSIGNED) continue;
            if (keepParentId != null && row.getParentItem().getScorecard() != null
                    && keepParentId.equals(row.getParentItem().getScorecard().getId())) continue;
            row.setParentItem(null);
            row.setLinkType(null);
            row.setContributionValue(null);
            row.setContributionPercent(null);
            itemRepository.save(row);
        }
    }

    /**
     * Nối các dòng chỉ tiêu của thẻ con lên dòng CÙNG HẠNG MỤC của thẻ cha.
     *
     * <p>Vì sao cần: mọi thứ có ý nghĩa số liệu của quan hệ cha–con đều bám vào {@code parentItem}
     * ở mức TỪNG DÒNG chứ không phải quan hệ giữa hai thẻ — độ phủ đếm theo nó, và cấp trên cộng
     * kết quả từ cấp dưới cũng đi qua nó. Gắn cây suông là một liên kết rỗng về số liệu.
     *
     * <p>Khác phân rã ở chỗ đây là quan hệ ĐI LÊN từ dưới: đơn vị tự đặt chỉ tiêu, cấp trên chỉ
     * công nhận nó thuộc chỉ tiêu nào của mình. Nên dòng vẫn là {@code SELF} và KHÔNG bị khoá —
     * đơn vị vẫn sửa được. Mức đóng góp lấy chính mục tiêu đơn vị tự đặt, để bảng độ phủ so được
     * "các đơn vị cộng lại đã đủ mục tiêu của cấp trên chưa"; cấp trên muốn ấn định con số khác
     * thì phân rã như thường, lúc đó dòng chuyển sang {@code ASSIGNED} và bị khoá.
     *
     * <p>Chỉ đụng vào dòng CHƯA có cha: dòng đã nhận phân rã từ nơi khác mà bị nối lại là mất dấu
     * mục tiêu đã giao.
     */
    private int linkItemsByPerspective(BscScorecard child, BscScorecard parent) {
        List<BscScorecardPerspective> parentRows =
                itemRepository.findByScorecardIdOrderByDisplayOrderAsc(parent.getId());
        Map<UUID, BscScorecardPerspective> parentByPerspective = new HashMap<>();
        for (BscScorecardPerspective row : parentRows) {
            if (row.getPerspective() != null) {
                parentByPerspective.putIfAbsent(row.getPerspective().getId(), row);
            }
        }
        if (parentByPerspective.isEmpty()) return 0;

        int linked = 0;
        for (BscScorecardPerspective row : itemRepository.findByScorecardIdOrderByDisplayOrderAsc(child.getId())) {
            if (row.getParentItem() != null || row.getPerspective() == null) continue;
            BscScorecardPerspective parentRow = parentByPerspective.get(row.getPerspective().getId());
            if (parentRow == null) continue;

            row.setParentItem(parentRow);
            row.setLinkType(BscLinkType.SUM);
            if (row.getContributionValue() == null) {
                Double own = row.getTargetValue() != null
                        ? row.getTargetValue() : row.getPerspective().getTargetValue();
                row.setContributionValue(own);
            }
            itemRepository.save(row);
            linked++;
        }
        return linked;
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
        cycleLockGuard.assertWritable(s);
        // Trình duyệt là thao tác lên bộ tiêu chí của MỘT đơn vị, không phải quyền chung: thiếu
        // dòng này thì trưởng đơn vị nào cũng trình được bộ tiêu chí của đơn vị khác.
        accessGuard.assertCanEdit(s);
        if (s.getStatus() != BscScorecardStatus.DRAFT) {
            throw new BusinessException(ErrorCode.ONLY_DRAFT_SCORECARDS_CAN_SUBMITTED);
        }
        assertComplete(s);
        User actor = currentUserOrNull();
        s.setStatus(BscScorecardStatus.SUBMITTED);
        s.setSubmittedBy(actor);
        s.setSubmittedAt(Instant.now());
        s.setRejectReason(null);
        BscScorecard saved = scorecardRepository.save(s);
        if (actor != null) startScorecardApproval(saved, actor);
        eventPublisher.publishEvent(new BscEvents.ScorecardSubmitted(saved.getId(), idOf(actor)));
        return saved;
    }

    /**
     * Quy trình "Lập và phê duyệt thẻ điểm": thẻ vẫn ở CHỜ DUYỆT, nhưng chỉ người giữ bước của quy
     * trình duyệt / trả lại được (qua hộp "Chờ tôi duyệt"); bước cuối ⇒ áp dụng như duyệt tay.
     */
    private void startScorecardApproval(BscScorecard s, User actor) {
        List<BscScorecardPerspective> rows = itemRepository.findByScorecardIdOrderByDisplayOrderAsc(s.getId());
        double total = rows.stream().mapToDouble(r -> r.getWeightPercentage() != null ? r.getWeightPercentage() : 0.0).sum();
        UUID orgId = s.getOrganization().getId();
        OrgUnit unit = s.getOrgUnits() == null || s.getOrgUnits().isEmpty()
                ? approvalChain.rootUnitOf(orgId) : s.getOrgUnits().get(0);
        if (unit == null) return;
        java.util.Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("scorecardId", s.getId().toString());
        payload.put("scorecardName", s.getName());
        payload.put("unitNames", s.getOrgUnits() == null ? List.of()
                : s.getOrgUnits().stream().map(OrgUnit::getName).toList());
        payload.put("itemCount", rows.size());
        payload.put("totalWeight", Math.round(total * 10) / 10.0);
        payload.put("level", s.getLevel() == null ? null : s.getLevel().name());
        approvalChain.startProposal(com.kpitracking.enums.kpi.ApprovalSubjectType.BSC_SCORECARD, s.getId(), s.getName(),
                unit, null, actor, null, null, payload);
    }

    /** Duyệt / trả lại tay không đi được khi thẻ đang theo quy trình duyệt. */
    private void assertNotInProcess(UUID scorecardId) {
        if (approvalChain.runningSubjectFlowId(com.kpitracking.enums.kpi.ApprovalSubjectType.BSC_SCORECARD, scorecardId).isPresent()) {
            throw new BusinessException(ErrorCode.BSC_SCORECARD_IN_APPROVAL_PROCESS);
        }
    }

    /** Bước cuối của quy trình vừa duyệt: áp dụng thẻ như {@link #approve}. */
    @Transactional
    public void applyApprovedByProcess(UUID scorecardId, User actor) {
        BscScorecard s = load(scorecardId);
        if (s.getStatus() != BscScorecardStatus.SUBMITTED) {
            throw new BusinessException(ErrorCode.ONLY_SCORECARDS_PENDING_APPROVAL_CAN_APPROVED);
        }
        s.setStatus(BscScorecardStatus.ACTIVE);
        s.setApprovedBy(actor);
        s.setApprovedAt(Instant.now());
        s.setRejectReason(null);
        scorecardRepository.save(s);
        eventPublisher.publishEvent(new BscEvents.ScorecardApproved(s.getId(), idOf(actor)));
    }

    /** Bị từ chối ở một bước của quy trình: trả thẻ về nháp như {@link #reject}. */
    @Transactional
    public void applyRejectedByProcess(UUID scorecardId, User actor, String reason) {
        BscScorecard s = load(scorecardId);
        if (s.getStatus() != BscScorecardStatus.SUBMITTED) return;
        UUID submitterId = idOf(s.getSubmittedBy());
        s.setStatus(BscScorecardStatus.DRAFT);
        s.setRejectReason(reason == null ? null : reason.trim());
        s.setSubmittedAt(null);
        s.setSubmittedBy(null);
        scorecardRepository.save(s);
        eventPublisher.publishEvent(new BscEvents.ScorecardRejected(s.getId(), submitterId, idOf(actor), s.getRejectReason()));
    }

    /**
     * Duyệt là ÁP DỤNG LUÔN — thẻ chuyển thẳng sang {@code ACTIVE}, không dừng ở {@code APPROVED}.
     *
     * <p>{@code APPROVED} từng là một bước riêng giữa duyệt và áp dụng; bỏ nó đi để duyệt xong là
     * chấm luôn. Chỉ thẻ đã duyệt ({@link BscScorecardStatus#isScoring}) mới được
     * {@code BscScoringService.resolveScorecard} dùng để chấm — nháp / chờ duyệt thì chưa.
     *
     * <p>Giá trị {@code APPROVED} vẫn còn trong enum cho dữ liệu cũ; {@link #activate} vẫn nhận nó
     * để những thẻ đang mắc kẹt ở trạng thái đó bấm được một lần cho xong.
     */
    @Transactional
    public BscScorecard approve(UUID scorecardId) {
        assertNotInProcess(scorecardId);
        BscScorecard s = load(scorecardId);
        cycleLockGuard.assertWritable(s);
        // Người duyệt được duyệt thẳng thẻ NHÁP (vd thẻ phân rã xuống đơn vị đã đủ, hay thẻ công ty
        // chính họ dựng) — bắt họ "trình" cho chính mình rồi tự duyệt là một bước thừa. Vẫn qua đúng
        // điều kiện của lúc trình: có hạng mục và tổng trọng số đủ 100%.
        if (s.getStatus() == BscScorecardStatus.DRAFT) {
            // Tổ chức đang bật quy trình duyệt thẻ: duyệt thẳng thẻ nháp là đi tắt qua quy trình — phải trình.
            if (s.getOrganization() != null && approvalChain.hasActiveProcess(s.getOrganization().getId(),
                    com.kpitracking.enums.approvalprocess.ApprovalObjectType.BSC_SCORECARD)) {
                throw new BusinessException(ErrorCode.BSC_SCORECARD_PROCESS_REQUIRES_SUBMIT);
            }
            assertComplete(s);
        } else if (s.getStatus() != BscScorecardStatus.SUBMITTED) {
            throw new BusinessException(ErrorCode.ONLY_SCORECARDS_PENDING_APPROVAL_CAN_APPROVED);
        }
        User actor = currentUserOrNull();
        s.setStatus(BscScorecardStatus.ACTIVE);
        s.setApprovedBy(actor);
        s.setApprovedAt(Instant.now());
        s.setRejectReason(null);
        BscScorecard saved = scorecardRepository.save(s);
        eventPublisher.publishEvent(new BscEvents.ScorecardApproved(saved.getId(), idOf(actor)));
        return saved;
    }

    /** Điều kiện để thẻ vào áp dụng (trình hoặc duyệt thẳng): có hạng mục, tổng trọng số đúng 100%. */
    private void assertComplete(BscScorecard s) {
        List<BscScorecardPerspective> rows = itemRepository.findByScorecardIdOrderByDisplayOrderAsc(s.getId());
        if (rows.isEmpty()) {
            throw new BusinessException(ErrorCode.SCORECARD_NO_KPIS);
        }
        double total = rows.stream()
                .mapToDouble(r -> r.getWeightPercentage() != null ? r.getWeightPercentage() : 0.0).sum();
        if (Math.abs(total - 100.0) > 0.01) {
            throw new BusinessException(ErrorCode.TOTAL_WEIGHT_MUST_100_PERCENT_SUBMIT, String.valueOf(Math.round(total * 10) / 10.0));
        }
    }

    /** Trả lại cho cấp dưới sửa. Lý do bắt buộc — người nhận cần biết phải sửa gì. */
    @Transactional
    public BscScorecard reject(UUID scorecardId, String reason) {
        if (reason == null || reason.isBlank()) {
            throw new BusinessException(ErrorCode.ENTER_REASON_RETURNING);
        }
        assertNotInProcess(scorecardId);
        BscScorecard s = load(scorecardId);
        cycleLockGuard.assertWritable(s);
        if (s.getStatus() != BscScorecardStatus.SUBMITTED) {
            throw new BusinessException(ErrorCode.ONLY_SCORECARDS_PENDING_APPROVAL_CAN_RETURNED);
        }
        // Người trình bị xoá khỏi thẻ ngay dưới đây, nên phải giữ lại trước để còn báo cho họ.
        UUID submitterId = idOf(s.getSubmittedBy());
        s.setStatus(BscScorecardStatus.DRAFT);
        s.setRejectReason(reason.trim());
        s.setSubmittedAt(null);
        s.setSubmittedBy(null);
        BscScorecard saved = scorecardRepository.save(s);
        eventPublisher.publishEvent(new BscEvents.ScorecardRejected(
                saved.getId(), submitterId, idOf(currentUserOrNull()), saved.getRejectReason()));
        return saved;
    }

    /**
     * Mở lại thẻ đã đóng, và lối thoát cho thẻ cũ còn kẹt ở {@code APPROVED} (xem {@link #approve}).
     * Luồng duyệt bình thường không đi qua đây nữa.
     */
    @Transactional
    public BscScorecard activate(UUID scorecardId) {
        BscScorecard s = load(scorecardId);
        cycleLockGuard.assertWritable(s);
        if (s.getStatus() != BscScorecardStatus.APPROVED && s.getStatus() != BscScorecardStatus.CLOSED) {
            throw new BusinessException(ErrorCode.ONLY_APPROVED_CLOSED_SCORECARDS_CAN_APPLIED);
        }
        // Lúc thẻ đóng, đơn vị có thể đã lập thẻ mới cho cùng đợt — mở lại thì hai thẻ cùng áp cho
        // một đơn vị, chấm điểm không biết chọn cái nào.
        if (s.getStatus() == BscScorecardStatus.CLOSED) assertNoLiveClash(s);
        s.setStatus(BscScorecardStatus.ACTIVE);
        BscScorecard saved = scorecardRepository.save(s);
        eventPublisher.publishEvent(new BscEvents.ScorecardActivated(saved.getId(), idOf(currentUserOrNull())));
        return saved;
    }

    /** Có thẻ CÒN DÙNG nào khác đang chiếm cùng đơn vị/đợt với {@code s} không. */
    private void assertNoLiveClash(BscScorecard s) {
        UUID orgId = s.getOrganization().getId();
        List<OrgUnit> units = s.getOrgUnits() == null ? List.of() : s.getOrgUnits();
        for (KpiPeriod period : effectivePeriodsOf(s)) {
            List<BscScorecard> others = units.isEmpty()
                    ? scorecardRepository.findDefaultByPeriod(orgId, period.getId())
                    : scorecardRepository.findByOrgUnitsAndPeriod(orgId, units.stream().map(OrgUnit::getId).toList(), period.getId());
            String clash = others.stream()
                    .filter(o -> !o.getId().equals(s.getId()) && (o.getStatus() == null || !o.getStatus().isRetired()))
                    .map(BscScorecard::getName)
                    .collect(Collectors.joining(", "));
            if (!clash.isEmpty()) {
                throw new BusinessException(ErrorCode.SCORECARD_REOPEN_CLASH, period.getName(), clash);
            }
        }
    }

    // ============================================================
    // Helper
    // ============================================================

    private BscScorecard load(UUID id) {
        return scorecardRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.scorecard"), "id", id));
    }

    /** Sự kiện chỉ mang ID — xem {@link BscEvents} để biết vì sao không truyền thẳng entity. */
    private static UUID idOf(User u) {
        return u == null ? null : u.getId();
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
