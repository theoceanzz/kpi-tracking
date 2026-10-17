package com.kpitracking.service;

import com.kpitracking.entity.BscPerspective;
import com.kpitracking.entity.BscScorecard;
import com.kpitracking.entity.BscScorecardPerspective;
import com.kpitracking.entity.BscUnitResult;
import com.kpitracking.entity.BscUnitResultItem;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.enums.BscLinkType;
import com.kpitracking.enums.BscMeasurementSource;
import com.kpitracking.enums.BscScorecardStatus;
import com.kpitracking.enums.BscUnitResultStatus;
import com.kpitracking.enums.KpiType;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.repository.BscCascadePolicyRepository;
import com.kpitracking.repository.BscScorecardPerspectiveRepository;
import com.kpitracking.repository.BscScorecardRepository;
import com.kpitracking.repository.BscUnitResultItemRepository;
import com.kpitracking.repository.BscUnitResultRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Kết quả đơn vị tự nhận nguồn số cho từng dòng — người dùng không chọn "nhập tay / cộng KPI" nữa.
 *
 * <pre>
 *   Thẻ công ty
 *   ├─ A  Doanh thu (mục tiêu 100)   đã giao "chia chỉ tiêu" cho phòng con  → cộng từ đơn vị con
 *   ├─ B  Đúng hạn (mục tiêu 10)     có KPI gắn vào                         → cộng từ KPI
 *   ├─ C  Hài lòng (mục tiêu 50)     giữ lại, không KPI                     → nhập tay
 *   ├─ D  Văn hoá (chấm trung bình)  giữ lại, không KPI                     → nhập tay, số gõ = % đạt
 *   └─ E  Thương hiệu (mục tiêu 20)  chỉ giao vai trò "hỗ trợ"              → vẫn là nhập tay
 * </pre>
 */
class BscUnitResultAutoSourceTest {

    static final UUID PERIOD = UUID.randomUUID();

    BscScorecardRepository scorecardRepository = mock(BscScorecardRepository.class);
    BscScorecardPerspectiveRepository rowRepository = mock(BscScorecardPerspectiveRepository.class);
    BscUnitResultRepository unitResultRepository = mock(BscUnitResultRepository.class);
    BscUnitResultItemRepository itemRepository = mock(BscUnitResultItemRepository.class);
    KpiCriteriaRepository kpiCriteriaRepository = mock(KpiCriteriaRepository.class);
    KpiPeriodRepository kpiPeriodRepository = mock(KpiPeriodRepository.class);
    KpiAchievementCalculator calculator = mock(KpiAchievementCalculator.class);
    BscCascadeService service;

    BscScorecard company;
    BscScorecardPerspective a, b, c, d, e, f, childOfA, supportOfE, sharedF1, sharedF2;
    BscUnitResult existing;

    @BeforeEach
    void setUp() {
        service = new BscCascadeService(scorecardRepository, rowRepository, unitResultRepository, itemRepository,
                mock(BscCascadePolicyRepository.class), kpiCriteriaRepository, kpiPeriodRepository, calculator,
                mock(UserRepository.class), mock(BscScoringService.class), mock(BscAccessGuard.class),
                mock(ApplicationEventPublisher.class), new BscSourceScores(unitResultRepository),
                mock(com.kpitracking.service.kpi.approval.KpiApprovalChainService.class), mock(BscCycleLockGuard.class));

        OrgUnit root = OrgUnit.builder().id(UUID.randomUUID()).name("Công ty").build();
        company = BscScorecard.builder().id(UUID.randomUUID()).name("BSC công ty")
                .organization(Organization.builder().id(UUID.randomUUID()).enableWaterfall(false).build())
                .orgUnits(new ArrayList<>(List.of(root))).status(BscScorecardStatus.ACTIVE).build();
        KpiPeriod period = KpiPeriod.builder().id(PERIOD).name("Đợt 1").build();

        a = row("Doanh thu", 40.0, 100.0);
        b = row("Đúng hạn", 20.0, 10.0);
        c = row("Hài lòng", 20.0, 50.0);
        d = row("Văn hoá", 10.0, 0.0);
        e = row("Thương hiệu", 10.0, 20.0);
        // F: giao cả bộ cho 2 phòng (cùng chịu chung) ⇒ công ty = trung bình % đạt của 2 phòng.
        f = row("Quy trình", 0.0, 4.0);
        sharedF1 = BscScorecardPerspective.builder().id(UUID.randomUUID()).parentItem(f).linkType(BscLinkType.SHARED).wholeSharePercent(60.0).build();
        sharedF2 = BscScorecardPerspective.builder().id(UUID.randomUUID()).parentItem(f).linkType(BscLinkType.SHARED).wholeSharePercent(40.0).build();
        childOfA = BscScorecardPerspective.builder().id(UUID.randomUUID()).parentItem(a).linkType(BscLinkType.SUM).build();
        supportOfE = BscScorecardPerspective.builder().id(UUID.randomUUID()).parentItem(e).linkType(BscLinkType.SUPPORT).build();

        existing = BscUnitResult.builder().id(UUID.randomUUID()).scorecard(company).kpiPeriod(period)
                .status(BscUnitResultStatus.DRAFT).build();
        // Lần tính trước đã có số nhập tay của C và D — phải sống sót qua lần tính này.
        List<BscUnitResultItem> previous = List.of(
                BscUnitResultItem.builder().scorecardPerspective(c).measurementSource(BscMeasurementSource.MANUAL).actualValue(25.0).build(),
                BscUnitResultItem.builder().scorecardPerspective(d).measurementSource(BscMeasurementSource.MANUAL).actualValue(120.0).build());

        when(scorecardRepository.findById(company.getId())).thenReturn(Optional.of(company));
        when(kpiPeriodRepository.findById(PERIOD)).thenReturn(Optional.of(period));
        when(unitResultRepository.findByScorecardIdAndKpiPeriodId(company.getId(), PERIOD)).thenReturn(Optional.of(existing));
        when(unitResultRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(itemRepository.findByUnitResultId(existing.getId())).thenReturn(previous);
        when(rowRepository.findByScorecardIdOrderByDisplayOrderAsc(company.getId())).thenReturn(List.of(a, b, c, d, e, f));
        when(rowRepository.findByParentItemIdIn(anyCollection())).thenReturn(List.of(childOfA, supportOfE, sharedF1, sharedF2));
        when(itemRepository.findByPeriodAndRowIds(eq(PERIOD), anyCollection())).thenReturn(List.of(
                BscUnitResultItem.builder().scorecardPerspective(childOfA).actualValue(80.0).achievementPercent(80.0).build(),
                BscUnitResultItem.builder().scorecardPerspective(sharedF1).actualValue(4.0).achievementPercent(80.0).build(),
                BscUnitResultItem.builder().scorecardPerspective(sharedF2).actualValue(3.0).achievementPercent(60.0).build()));

        KpiCriteria kpi = KpiCriteria.builder().id(UUID.randomUUID()).name("KPI đúng hạn")
                .kpiType(KpiType.QUANTITATIVE).weight(1.0).scorecardPerspective(b).build();
        when(kpiCriteriaRepository.findByOrgUnitsAndPeriod(anyCollection(), eq(PERIOD), any())).thenReturn(List.of(kpi));
        when(calculator.countsTowardBscScore(any())).thenReturn(true);
        when(calculator.actualValue(eq(kpi), eq(null), anyBoolean())).thenReturn(7.0);
        when(calculator.perspectiveRatioFromActual(any(), any(), anyDouble())).thenAnswer(inv -> {
            Double target = inv.getArgument(0);
            double actual = inv.getArgument(2);
            return target == null || target == 0 ? 0.0 : Math.min(actual / target, 1.5);
        });
    }

    BscScorecardPerspective row(String name, double weight, double target) {
        BscPerspective p = BscPerspective.builder().id(UUID.randomUUID()).name(name).build();
        return BscScorecardPerspective.builder().id(UUID.randomUUID()).scorecard(company).perspective(p)
                .weightPercentage(weight).targetValue(target).build();
    }

    @SuppressWarnings("unchecked")
    Map<BscScorecardPerspective, BscUnitResultItem> recompute() {
        service.recompute(company.getId(), PERIOD);
        ArgumentCaptor<List<BscUnitResultItem>> saved = ArgumentCaptor.forClass(List.class);
        verify(itemRepository).saveAll(saved.capture());
        return saved.getValue().stream().collect(Collectors.toMap(BscUnitResultItem::getScorecardPerspective, Function.identity()));
    }

    @Test
    @DisplayName("Mỗi dòng tự nhận nguồn: phân rã → đơn vị con, có KPI → KPI, còn lại → nhập tay")
    void picksSourcePerRow() {
        Map<BscScorecardPerspective, BscUnitResultItem> items = recompute();

        assertThat(items.get(a).getMeasurementSource()).isEqualTo(BscMeasurementSource.CHILD_ROLLUP);
        assertThat(items.get(a).getActualValue()).isEqualTo(80.0);
        assertThat(items.get(a).getAchievementPercent()).isEqualTo(80.0);

        assertThat(items.get(b).getMeasurementSource()).isEqualTo(BscMeasurementSource.ROLLUP);
        assertThat(items.get(b).getAchievementPercent()).isEqualTo(70.0);

        assertThat(items.get(c).getMeasurementSource()).isEqualTo(BscMeasurementSource.MANUAL);
        assertThat(items.get(c).getActualValue()).isEqualTo(25.0);
        assertThat(items.get(c).getAchievementPercent()).isEqualTo(50.0);

        // Không mục tiêu, không KPI để lấy trung bình ⇒ số gõ chính là % đạt, trần 150.
        assertThat(items.get(d).getMeasurementSource()).isEqualTo(BscMeasurementSource.MANUAL);
        assertThat(items.get(d).getAchievementPercent()).isEqualTo(120.0);

        // Chỉ giao vai trò hỗ trợ = không ai góp số ⇒ vẫn là chỉ tiêu tự nhập, chưa nhập thì chưa có số.
        assertThat(items.get(e).getMeasurementSource()).isEqualTo(BscMeasurementSource.MANUAL);
        assertThat(items.get(e).getAchievementPercent()).isNull();

        // Giao cả bộ (cùng chịu chung): công ty KHÔNG phải nhập tay — lấy trung bình % đạt của các phòng.
        assertThat(items.get(f).getMeasurementSource()).isEqualTo(BscMeasurementSource.CHILD_ROLLUP);
        assertThat(items.get(f).getAchievementPercent()).isEqualTo(70.0);
    }

    @Test
    @DisplayName("Dòng lấy số tự động (KPI / đơn vị con) không nhập tay được")
    void manualEntryOnlyForManualRows() {
        BscUnitResultItem rollup = BscUnitResultItem.builder().id(UUID.randomUUID()).unitResult(existing)
                .scorecardPerspective(b).measurementSource(BscMeasurementSource.ROLLUP).build();
        when(itemRepository.findById(rollup.getId())).thenReturn(Optional.of(rollup));

        assertThatThrownBy(() -> service.setManualActual(company.getId(), PERIOD, rollup.getId(), 5.0))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getErrorCode())
                .isEqualTo(ErrorCode.KPI_TAKES_FIGURES_AUTOMATICALLY_KPIS);
    }
}
