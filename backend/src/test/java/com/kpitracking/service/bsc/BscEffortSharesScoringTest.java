package com.kpitracking.service.bsc;

import com.kpitracking.service.kpi.KpiAchievementCalculator;

import com.kpitracking.entity.bsc.BscScorecard;
import com.kpitracking.entity.bsc.BscUnitResult;
import com.kpitracking.entity.kpi.KpiCriteria;
import com.kpitracking.entity.organization.OrgUnit;
import com.kpitracking.entity.user.UserPeriodEffortShare;
import com.kpitracking.entity.user.UserRoleOrgUnit;
import com.kpitracking.entity.user.UserUnitEffortShare;
import com.kpitracking.enums.bsc.BscUnitResultStatus;
import com.kpitracking.repository.bsc.BscPerspectiveRepository;
import com.kpitracking.repository.bsc.BscScorecardRepository;
import com.kpitracking.repository.bsc.BscUnitResultRepository;
import com.kpitracking.repository.evaluation.EvaluationPerspectiveScoreRepository;
import com.kpitracking.repository.kpi.KpiCriteriaRepository;
import com.kpitracking.repository.user.UserPeriodEffortShareRepository;
import com.kpitracking.repository.user.UserRepository;
import com.kpitracking.repository.user.UserRoleOrgUnitRepository;
import com.kpitracking.repository.user.UserUnitEffortShareRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;

import java.util.List;
import java.util.UUID;

import static com.kpitracking.service.bsc.BscWholeCascadeScoringTest.card;
import static com.kpitracking.service.bsc.BscWholeCascadeScoringTest.sourceRow;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.kpitracking.service.PrimaryUnitResolver;
import com.kpitracking.service.kpi.KpiEffortShares;
/**
 * Điểm BSC của người KIÊM NHIỆM (KpiEffortShares): mỗi nhánh chấm bằng thẻ của chính đơn vị nhánh trên
 * KPI của nhánh, rồi gộp theo % công sức.
 *
 * <pre>
 *   Tổ A (đơn vị chính, /KPC/a/): thẻ A = 100% "Kết quả phòng A" → 80
 *   Tổ B (kiêm nhiệm,   /KPC/b/): thẻ B = 100% "Kết quả phòng B" → 40
 *   Mỗi tổ giao người này một KPI.
 * </pre>
 * Dùng dòng "Kết quả cấp trên" để mỗi thẻ ra một con số cố định mà không phải dựng bài nộp KPI.
 */
class BscEffortSharesScoringTest {

    static final UUID ORG = UUID.randomUUID(), PERIOD = UUID.randomUUID(), USER = UUID.randomUUID();

    BscScorecardRepository scorecardRepository = mock(BscScorecardRepository.class);
    KpiCriteriaRepository kpiCriteriaRepository = mock(KpiCriteriaRepository.class);
    UserRoleOrgUnitRepository userRoleOrgUnitRepository = mock(UserRoleOrgUnitRepository.class);
    BscUnitResultRepository unitResultRepository = mock(BscUnitResultRepository.class);
    UserUnitEffortShareRepository shareRepository = mock(UserUnitEffortShareRepository.class);
    UserPeriodEffortShareRepository periodShareRepository = mock(UserPeriodEffortShareRepository.class);
    BscScoringService service;

    OrgUnit unitA, unitB;
    BscScorecard cardA, cardB;
    UserRoleOrgUnit atA, atB;
    KpiCriteria kpiA, kpiB;

    @BeforeEach
    void setUp() {
        UserRepository users = mock(UserRepository.class);
        service = new BscScoringService(scorecardRepository, kpiCriteriaRepository,
                mock(KpiAchievementCalculator.class), mock(BscPerspectiveRepository.class),
                mock(EvaluationPerspectiveScoreRepository.class),
                new PrimaryUnitResolver(userRoleOrgUnitRepository, users),
                new BscSourceScores(unitResultRepository),
                new KpiEffortShares(userRoleOrgUnitRepository, users, shareRepository, periodShareRepository));

        unitA = OrgUnit.builder().id(UUID.randomUUID()).name("Tổ A").path("/KPC/a/").build();
        unitB = OrgUnit.builder().id(UUID.randomUUID()).name("Tổ B").path("/KPC/b/").build();
        BscScorecard sourceA = card("BSC phòng A", null), sourceB = card("BSC phòng B", null);
        cardA = card("BSC tổ A", sourceA);
        cardB = card("BSC tổ B", sourceB);
        cardA.getScorecardPerspectives().add(sourceRow(cardA, sourceA, 100.0));
        cardB.getScorecardPerspectives().add(sourceRow(cardB, sourceB, 100.0));
        when(unitResultRepository.findByScorecardIdInAndKpiPeriodId(anyCollection(), eq(PERIOD))).thenReturn(List.of(
                result(sourceA, 80.0), result(sourceB, 40.0)));

        atA = row(unitA);
        atB = row(unitB);
        when(userRoleOrgUnitRepository.findByUserId(USER)).thenReturn(List.of(atA, atB));
        when(scorecardRepository.findByOrgUnitAndPeriod(ORG, unitA.getId(), PERIOD)).thenReturn(List.of(cardA));
        when(scorecardRepository.findByOrgUnitAndPeriod(ORG, unitB.getId(), PERIOD)).thenReturn(List.of(cardB));

        kpiA = KpiCriteria.builder().id(UUID.randomUUID()).orgUnit(unitA).weight(100.0).build();
        kpiB = KpiCriteria.builder().id(UUID.randomUUID()).orgUnit(unitB).weight(100.0).build();
        when(kpiCriteriaRepository.findByUserIdInAssigneesAndKpiPeriodId(eq(USER), eq(PERIOD), any(), any()))
                .thenReturn(new PageImpl<>(List.of(kpiA, kpiB)));
        when(shareRepository.findByUserId(USER)).thenReturn(List.of());
        when(periodShareRepository.findByUserIdAndKpiPeriodId(USER, PERIOD)).thenReturn(List.of());
    }

    @Test
    @DisplayName("Chưa đặt % ⇒ chia đều: (80 + 40) / 2 = 60; hạng mục và chế độ chấm theo thẻ đơn vị chính")
    void equalSharesByDefault() {
        var score = service.computeForUser(USER, PERIOD, ORG, false);

        assertThat(score.getBscScore()).isCloseTo(60.0, within(1e-9));
        assertThat(score.getScorecard()).isSameAs(cardA);
        assertThat(score.getPerspectives()).hasSize(1);
        assertThat(score.getPerspectives().get(0).getSourceScorecardName()).isEqualTo("BSC phòng A");
    }

    @Test
    @DisplayName("Đặt 70/30 ⇒ 0,7 × 80 + 0,3 × 40 = 68")
    void configuredShares() {
        when(shareRepository.findByUserId(USER)).thenReturn(List.of(share(unitA, 70), share(unitB, 30)));

        assertThat(service.computeForUser(USER, PERIOD, ORG, false).getBscScore()).isCloseTo(68.0, within(1e-9));
    }

    @Test
    @DisplayName("Đợt đã chấm dùng % đã chốt (20/80 ⇒ 48), bỏ qua cấu hình hiện tại 70/30")
    void frozenSharesWinForScoredPeriod() {
        when(shareRepository.findByUserId(USER)).thenReturn(List.of(share(unitA, 70), share(unitB, 30)));
        when(periodShareRepository.findByUserIdAndKpiPeriodId(USER, PERIOD)).thenReturn(List.of(frozen(unitA, 20), frozen(unitB, 80)));

        assertThat(service.computeForUser(USER, PERIOD, ORG, false).getBscScore()).isCloseTo(48.0, within(1e-9));
    }

    @Test
    @DisplayName("Nhánh kiêm nhiệm chưa có thẻ ⇒ bỏ khỏi phép gộp, điểm = thẻ đơn vị chính")
    void secondaryWithoutScorecardIsLeftOut() {
        when(scorecardRepository.findByOrgUnitAndPeriod(ORG, unitB.getId(), PERIOD)).thenReturn(List.of());

        assertThat(service.computeForUser(USER, PERIOD, ORG, false).getBscScore()).isCloseTo(80.0, within(1e-9));
    }

    @Test
    @DisplayName("Thẻ của nhánh kiêm nhiệm còn nháp ⇒ chưa chấm, không tính vào phép gộp")
    void secondaryDraftScorecardIsLeftOut() {
        cardB.setStatus(com.kpitracking.enums.bsc.BscScorecardStatus.DRAFT);

        assertThat(service.computeForUser(USER, PERIOD, ORG, false).getBscScore()).isCloseTo(80.0, within(1e-9));
    }

    @Test
    @DisplayName("Đơn vị chính chưa áp dụng BSC ⇒ người này chưa có điểm BSC, dù nhánh kiêm nhiệm có thẻ")
    void noPrimaryScorecardMeansNoBsc() {
        when(scorecardRepository.findByOrgUnitAndPeriod(ORG, unitA.getId(), PERIOD)).thenReturn(List.of());

        assertThat(service.computeForUser(USER, PERIOD, ORG, false)).isNull();
    }

    @Test
    @DisplayName("Thẻ nhánh chính chưa ra số ⇒ dùng số của nhánh còn lại thay vì null")
    void primaryWithoutNumberFallsBackToOtherBranch() {
        BscScorecard sourceB = cardB.getScorecardPerspectives().get(0).getPerspective().getSourceScorecard();
        when(unitResultRepository.findByScorecardIdInAndKpiPeriodId(anyCollection(), eq(PERIOD))).thenReturn(List.of(
                result(sourceB, 40.0)));

        assertThat(service.computeForUser(USER, PERIOD, ORG, false).getBscScore()).isCloseTo(40.0, within(1e-9));
    }

    @Test
    @DisplayName("Chỉ KPI của một nhánh trong đợt ⇒ không chia, chấm như người một phòng (= 80)")
    void kpisFromOneBranchOnly_scoreAsBefore() {
        when(kpiCriteriaRepository.findByUserIdInAssigneesAndKpiPeriodId(eq(USER), eq(PERIOD), any(), any()))
                .thenReturn(new PageImpl<>(List.of(kpiA)));

        assertThat(service.computeForUser(USER, PERIOD, ORG, false).getBscScore()).isCloseTo(80.0, within(1e-9));
    }

    // ------------------------------------------------------------

    static UserRoleOrgUnit row(OrgUnit unit) {
        UserRoleOrgUnit r = mock(UserRoleOrgUnit.class);
        when(r.getOrgUnit()).thenReturn(unit);
        return r;
    }

    static BscUnitResult result(BscScorecard card, double percent) {
        return BscUnitResult.builder().scorecard(card).achievementPercent(percent).status(BscUnitResultStatus.FINALIZED).build();
    }

    static UserUnitEffortShare share(OrgUnit unit, double pct) {
        return UserUnitEffortShare.builder().userId(USER).orgUnitId(unit.getId()).sharePercent(pct).build();
    }

    static UserPeriodEffortShare frozen(OrgUnit unit, double pct) {
        return UserPeriodEffortShare.builder().userId(USER).kpiPeriodId(PERIOD).orgUnitId(unit.getId()).sharePercent(pct).build();
    }
}
