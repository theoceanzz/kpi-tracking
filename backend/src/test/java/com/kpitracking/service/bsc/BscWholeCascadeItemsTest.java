package com.kpitracking.service.bsc;

import com.kpitracking.dto.request.bsc.CascadeRequest;
import com.kpitracking.dto.request.bsc.CascadeTargetRequest;
import com.kpitracking.dto.request.bsc.WholeCascadeRequest;
import com.kpitracking.entity.bsc.BscPerspective;
import com.kpitracking.entity.bsc.BscScorecard;
import com.kpitracking.entity.bsc.BscScorecardPerspective;
import com.kpitracking.entity.kpi.KpiPeriod;
import com.kpitracking.entity.organization.OrgUnit;
import com.kpitracking.entity.organization.Organization;
import com.kpitracking.enums.bsc.BscItemOrigin;
import com.kpitracking.enums.bsc.BscLinkType;
import com.kpitracking.enums.bsc.BscScorecardApplyScope;
import com.kpitracking.enums.bsc.BscScorecardStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.repository.bsc.BscPerspectiveRepository;
import com.kpitracking.repository.bsc.BscScorecardPerspectiveRepository;
import com.kpitracking.repository.bsc.BscScorecardRepository;
import com.kpitracking.repository.bsc.BscUnitResultItemRepository;
import com.kpitracking.repository.bsc.BscUnitResultRepository;
import com.kpitracking.repository.kpi.KpiCriteriaRepository;
import com.kpitracking.repository.kpi.KpiPeriodRepository;
import com.kpitracking.repository.organization.OrgUnitRepository;
import com.kpitracking.repository.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * "Giao cả bộ" kiểu mới: đơn vị nhận TOÀN BỘ chỉ tiêu của thẻ nguồn (dòng khoá, cùng chịu chung), trọng số
 * X% chia theo tỉ lệ của thẻ nguồn — để thẻ công ty tự cộng lên từ các đơn vị thay vì phải nhập tay.
 *
 * <pre>
 *   Thẻ công ty: Doanh thu 40% (mục tiêu 100) · Hài lòng 60% (mục tiêu 90)
 *   Giao cả bộ cho Phòng KD 50%  ⇒  Phòng KD: Doanh thu 20% · Hài lòng 30% (+ 50% hạng mục riêng)
 * </pre>
 * Kho dòng là một bản giả trong bộ nhớ để kiểm được cả lần giao lại / đồng bộ / thu hồi.
 */
class BscWholeCascadeItemsTest {

    static final UUID ORG = UUID.randomUUID();

    BscScorecardRepository scorecardRepository = mock(BscScorecardRepository.class);
    BscScorecardPerspectiveRepository itemRepository = mock(BscScorecardPerspectiveRepository.class);
    OrgUnitRepository orgUnitRepository = mock(OrgUnitRepository.class);
    KpiCriteriaRepository kpiCriteriaRepository = mock(KpiCriteriaRepository.class);
    BscUnitResultItemRepository unitResultItemRepository = mock(BscUnitResultItemRepository.class);
    BscTreeService service;

    /** Kho dòng giả: mọi dòng của mọi thẻ. */
    final List<BscScorecardPerspective> store = new ArrayList<>();
    BscScorecard company, sales;
    BscScorecardPerspective revenue, satisfaction;
    OrgUnit salesUnit;

    @BeforeEach
    void setUp() {
        service = new BscTreeService(scorecardRepository, itemRepository, mock(BscPerspectiveRepository.class),
                mock(BscUnitResultRepository.class), unitResultItemRepository, kpiCriteriaRepository,
                orgUnitRepository, mock(KpiPeriodRepository.class), mock(UserRepository.class),
                mock(BscAccessGuard.class), mock(ApplicationEventPublisher.class), mock(com.kpitracking.service.kpi.approval.KpiApprovalChainService.class), mock(BscCycleLockGuard.class));

        KpiPeriod period = KpiPeriod.builder().id(UUID.randomUUID()).name("Đợt 1").build();
        Organization org = Organization.builder().id(ORG).build();
        salesUnit = OrgUnit.builder().id(UUID.randomUUID()).name("Phòng KD").build();
        // Thẻ công ty không gắn đơn vị ⇒ giao xuống đơn vị nào cũng hợp lệ (không phải dựng cây đơn vị).
        company = BscScorecard.builder().id(UUID.randomUUID()).name("BSC công ty").organization(org)
                .applyScope(BscScorecardApplyScope.PERIOD).kpiPeriods(new ArrayList<>(List.of(period)))
                .status(BscScorecardStatus.ACTIVE).build();
        sales = BscScorecard.builder().id(UUID.randomUUID()).name("BSC Phòng KD").organization(org)
                .orgUnits(new ArrayList<>(List.of(salesUnit))).parentScorecard(company)
                .applyScope(BscScorecardApplyScope.PERIOD).kpiPeriods(new ArrayList<>(List.of(period)))
                .status(BscScorecardStatus.DRAFT).build();

        revenue = sourceRow("Doanh thu", 40.0, 100.0);
        satisfaction = sourceRow("Hài lòng", 60.0, 90.0);

        when(scorecardRepository.findById(company.getId())).thenReturn(Optional.of(company));
        when(scorecardRepository.findById(sales.getId())).thenReturn(Optional.of(sales));
        when(scorecardRepository.findByParentScorecardId(company.getId())).thenReturn(List.of(sales));
        when(orgUnitRepository.findById(salesUnit.getId())).thenReturn(Optional.of(salesUnit));

        when(itemRepository.findByScorecardIdOrderByDisplayOrderAsc(any())).thenAnswer(inv -> rowsOf(inv.getArgument(0)));
        when(itemRepository.save(any())).thenAnswer(inv -> {
            BscScorecardPerspective r = inv.getArgument(0);
            if (r.getId() == null) r.setId(UUID.randomUUID());
            if (!store.contains(r)) store.add(r);
            return r;
        });
        doAnswer(inv -> { store.remove((BscScorecardPerspective) inv.getArgument(0)); return null; })
                .when(itemRepository).delete(any());
        when(itemRepository.findWholeRowsFromSource(any())).thenAnswer(inv -> store.stream()
                .filter(r -> r.getWholeSharePercent() != null && r.getParentItem() != null
                        && r.getParentItem().getScorecard().getId().equals(inv.getArgument(0)))
                .toList());
        when(itemRepository.findBySourceScorecardId(any())).thenReturn(List.of());
        when(itemRepository.findById(any())).thenAnswer(inv -> store.stream()
                .filter(r -> r.getId().equals(inv.getArgument(0))).findFirst());
        when(itemRepository.findByParentItemId(any())).thenAnswer(inv -> store.stream()
                .filter(r -> r.getParentItem() != null && r.getParentItem().getId().equals(inv.getArgument(0))).toList());
        when(itemRepository.findByParentItemIdIn(anyCollection())).thenReturn(List.of());
        when(kpiCriteriaRepository.countLiveByScorecardPerspectiveId(any())).thenReturn(0L);
        when(unitResultItemRepository.findByScorecardPerspectiveId(any())).thenReturn(List.of());
    }

    BscScorecardPerspective sourceRow(String name, double weight, double target) {
        BscPerspective p = BscPerspective.builder().id(UUID.randomUUID()).name(name).build();
        BscScorecardPerspective r = BscScorecardPerspective.builder().id(UUID.randomUUID()).scorecard(company)
                .perspective(p).weightPercentage(weight).targetValue(target).minimumValue(0.0).unit("đ")
                .displayOrder(store.size()).build();
        company.getScorecardPerspectives().add(r);
        store.add(r);
        return r;
    }

    List<BscScorecardPerspective> rowsOf(UUID cardId) {
        return store.stream().filter(r -> r.getScorecard().getId().equals(cardId))
                .sorted(Comparator.comparing(r -> r.getDisplayOrder() != null ? r.getDisplayOrder() : 0)).toList();
    }

    Map<String, BscScorecardPerspective> salesRows() {
        return rowsOf(sales.getId()).stream().collect(Collectors.toMap(r -> r.getPerspective().getName(), Function.identity()));
    }

    void giveWhole(double share) {
        service.cascadeWhole(company.getId(), WholeCascadeRequest.builder()
                .targets(List.of(WholeCascadeRequest.Target.builder().orgUnitId(salesUnit.getId()).weightPercentage(share).build()))
                .build());
    }

    @Test
    @DisplayName("Giao cả bộ 50%: đơn vị nhận mọi chỉ tiêu, trọng số chia theo tỉ lệ công ty, cùng chịu chung, khoá")
    void givesEveryItemProportionally() {
        giveWhole(50);
        Map<String, BscScorecardPerspective> rows = salesRows();
        assertThat(rows).containsOnlyKeys("Doanh thu", "Hài lòng");
        assertThat(rows.get("Doanh thu").getWeightPercentage()).isEqualTo(20.0);
        assertThat(rows.get("Hài lòng").getWeightPercentage()).isEqualTo(30.0);
        for (BscScorecardPerspective r : rows.values()) {
            assertThat(r.getLinkType()).isEqualTo(BscLinkType.SHARED);
            assertThat(r.getOrigin()).isEqualTo(BscItemOrigin.ASSIGNED);
            assertThat(r.getLocked()).isTrue();
            assertThat(r.getWholeSharePercent()).isEqualTo(50.0);
        }
        // Mục tiêu đi theo thẻ công ty ⇒ công ty lấy trung bình % đạt của các đơn vị ở từng chỉ tiêu.
        assertThat(rows.get("Doanh thu").getParentItem()).isSameAs(revenue);
        assertThat(rows.get("Doanh thu").getTargetValue()).isEqualTo(100.0);
        assertThat(rows.get("Hài lòng").getTargetValue()).isEqualTo(90.0);
    }

    @Test
    @DisplayName("Giao lại với trọng số khác ⇒ cập nhật đè, không nhân đôi dòng")
    void regiveUpdatesInPlace() {
        giveWhole(50);
        giveWhole(80);
        Map<String, BscScorecardPerspective> rows = salesRows();
        assertThat(rows).hasSize(2);
        assertThat(rows.get("Doanh thu").getWeightPercentage()).isEqualTo(32.0);
        assertThat(rows.get("Hài lòng").getWeightPercentage()).isEqualTo(48.0);
    }

    @Test
    @DisplayName("Thẻ công ty thêm chỉ tiêu / đổi trọng số ⇒ đơn vị đang nhận cả bộ được đồng bộ theo")
    void syncFollowsSourceChanges() {
        giveWhole(50);
        satisfaction.setWeightPercentage(30.0);
        sourceRow("Quy trình", 30.0, 4.0);
        service.syncWholeRecipients(company.getId());
        Map<String, BscScorecardPerspective> rows = salesRows();
        assertThat(rows).containsOnlyKeys("Doanh thu", "Hài lòng", "Quy trình");
        assertThat(rows.get("Doanh thu").getWeightPercentage()).isEqualTo(20.0);
        assertThat(rows.get("Hài lòng").getWeightPercentage()).isEqualTo(15.0);
        assertThat(rows.get("Quy trình").getWeightPercentage()).isEqualTo(15.0);

        // Bỏ một chỉ tiêu khỏi thẻ công ty ⇒ đơn vị mất dòng tương ứng.
        store.remove(satisfaction);
        company.getScorecardPerspectives().remove(satisfaction);
        service.syncWholeRecipients(company.getId());
        assertThat(salesRows()).containsOnlyKeys("Doanh thu", "Quy trình");
    }

    @Test
    @DisplayName("Thu hồi cả bộ ⇒ gỡ mọi dòng cả bộ khỏi thẻ đơn vị")
    void revokeRemovesWholeSet() {
        giveWhole(50);
        service.cascadeWhole(company.getId(), WholeCascadeRequest.builder().revokeOrgUnitIds(List.of(salesUnit.getId())).build());
        assertThat(salesRows()).isEmpty();
    }

    @Test
    @DisplayName("Thu hồi cả bộ: dòng đã có KPI gắn vào được trả về làm hạng mục riêng của đơn vị, không xoá")
    void revokeKeepsRowsWithKpisAsOwnItems() {
        giveWhole(50);
        BscScorecardPerspective withKpi = salesRows().get("Doanh thu");
        when(kpiCriteriaRepository.countLiveByScorecardPerspectiveId(withKpi.getId())).thenReturn(2L);
        service.cascadeWhole(company.getId(), WholeCascadeRequest.builder().revokeOrgUnitIds(List.of(salesUnit.getId())).build());
        Map<String, BscScorecardPerspective> rows = salesRows();
        assertThat(rows).containsOnlyKeys("Doanh thu");
        BscScorecardPerspective kept = rows.get("Doanh thu");
        assertThat(kept.getOrigin()).isEqualTo(BscItemOrigin.SELF);
        assertThat(kept.getLocked()).isFalse();
        assertThat(kept.getParentItem()).isNull();
        assertThat(kept.getWholeSharePercent()).isNull();
    }

    @Test
    @DisplayName("Đơn vị đang nhận cả bộ thì không giao riêng từng chỉ tiêu từ cùng thẻ (chỉ chọn một trong hai)")
    void cannotMixWithItemCascade() {
        giveWhole(50);
        CascadeRequest item = CascadeRequest.builder().scorecardPerspectiveId(revenue.getId()).linkType(BscLinkType.SUM)
                .targets(List.of(CascadeTargetRequest.builder().orgUnitId(salesUnit.getId()).contributionValue(50.0).build()))
                .build();
        assertThatThrownBy(() -> service.cascade(company.getId(), item))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getErrorCode())
                .isEqualTo(ErrorCode.ITEM_CASCADE_OVERLAPS_WHOLE);
    }

    @Test
    @DisplayName("Thu hồi lẻ một dòng của cả bộ ở hộp 'Giao từng chỉ tiêu' bị chặn")
    void singleRowRevokeBlocked() {
        giveWhole(50);
        assertThatThrownBy(() -> service.revokeCascade(company.getId(), revenue.getId(), salesUnit.getId()))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getErrorCode())
                .isEqualTo(ErrorCode.WHOLE_ROW_REVOKE_VIA_WHOLE);
    }
}
