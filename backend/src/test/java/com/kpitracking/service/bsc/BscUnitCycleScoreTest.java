package com.kpitracking.service.bsc;

import com.kpitracking.entity.bsc.BscCascadePolicy;
import com.kpitracking.entity.bsc.BscScorecard;
import com.kpitracking.entity.bsc.BscUnitResult;
import com.kpitracking.entity.kpi.KpiPeriod;
import com.kpitracking.entity.organization.OrgUnit;
import com.kpitracking.enums.bsc.BscUnitResultStatus;
import com.kpitracking.repository.bsc.BscUnitResultRepository;
import com.kpitracking.repository.kpi.KpiPeriodRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.kpitracking.service.evaluation.UnitClassificationService;
/** Điểm BSC đơn vị trong kỳ để chọn khung bell curve: cắt trần, trung bình các đợt, chỉ "đã chốt" khi mọi đợt chốt. */
class BscUnitCycleScoreTest {

    static final UUID ORG = UUID.randomUUID(), CYCLE = UUID.randomUUID();
    KpiPeriodRepository periods = mock(KpiPeriodRepository.class);
    BscScoringService scoring = mock(BscScoringService.class);
    BscUnitResultRepository results = mock(BscUnitResultRepository.class);
    BscCascadeService cascade = mock(BscCascadeService.class);
    BscUnitCycleScore service = new BscUnitCycleScore(periods, scoring, results, cascade);

    OrgUnit unit = OrgUnit.builder().id(UUID.randomUUID()).name("Phòng KD").build();
    KpiPeriod p1 = KpiPeriod.builder().id(UUID.randomUUID()).build();
    KpiPeriod p2 = KpiPeriod.builder().id(UUID.randomUUID()).build();
    BscScorecard card = BscScorecard.builder().id(UUID.randomUUID()).build();

    @BeforeEach
    void setUp() {
        when(periods.findByKpiCycleIdOrderByStartDateAsc(CYCLE)).thenReturn(List.of(p1, p2));
        when(scoring.resolveScorecard(eq(unit), eq(ORG), any())).thenReturn(card);
        when(cascade.resolvePolicy(eq(ORG), any())).thenReturn(BscCascadePolicy.builder().recognizedCapPercent(110.0).build());
    }

    void result(KpiPeriod p, double percent, BscUnitResultStatus status) {
        when(results.findByScorecardIdAndKpiPeriodId(card.getId(), p.getId()))
                .thenReturn(Optional.of(BscUnitResult.builder().achievementPercent(percent).status(status).build()));
    }

    @Test
    @DisplayName("Cắt ở trần chính sách rồi lấy trung bình các đợt; mọi đợt chốt ⇒ đã chốt")
    void capsAveragesAndFinalizes() {
        result(p1, 130, BscUnitResultStatus.FINALIZED);   // cắt còn 110
        result(p2, 100, BscUnitResultStatus.FINALIZED);
        BscUnitCycleScore.Score s = service.forCycle(unit, ORG, CYCLE);
        assertThat(s.percent()).isEqualTo(105.0);
        assertThat(s.finalized()).isTrue();
        assertThat(UnitClassificationService.bandOf(s.percent(), 105, 85)).isEqualTo("EXCEED");
    }

    @Test
    @DisplayName("Còn một đợt chưa chốt (hoặc chưa có kết quả) ⇒ chỉ là số tạm")
    void notFinalizedWhenAnyPeriodOpen() {
        result(p1, 90, BscUnitResultStatus.FINALIZED);
        when(results.findByScorecardIdAndKpiPeriodId(card.getId(), p2.getId())).thenReturn(Optional.empty());
        BscUnitCycleScore.Score s = service.forCycle(unit, ORG, CYCLE);
        assertThat(s.percent()).isEqualTo(90.0);
        assertThat(s.finalized()).isFalse();
    }

    @Test
    @DisplayName("Đơn vị không có bộ tiêu chí ⇒ không có số (dùng khung mặc định)")
    void noScorecardNoScore() {
        when(scoring.resolveScorecard(eq(unit), eq(ORG), any())).thenReturn(null);
        assertThat(service.forCycle(unit, ORG, CYCLE).percent()).isNull();
    }

    @Test
    @DisplayName("Ngưỡng: Vượt ≥ 105, Đạt 85–dưới 105, Chưa đạt < 85")
    void bands() {
        assertThat(UnitClassificationService.bandOf(105, 105, 85)).isEqualTo("EXCEED");
        assertThat(UnitClassificationService.bandOf(104.9, 105, 85)).isEqualTo("MEET");
        assertThat(UnitClassificationService.bandOf(85, 105, 85)).isEqualTo("MEET");
        assertThat(UnitClassificationService.bandOf(84.9, 105, 85)).isEqualTo("BELOW");
    }
}
