package com.kpitracking.service;

import com.kpitracking.dto.response.bsc.PerspectiveScoreResponse;
import com.kpitracking.entity.BscPerspective;
import com.kpitracking.entity.BscScorecard;
import com.kpitracking.entity.BscScorecardPerspective;
import com.kpitracking.entity.BscUnitResult;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.BscEmptyPerspectivePolicy;
import com.kpitracking.enums.BscFixedPerspective;
import com.kpitracking.enums.BscScoringMode;
import com.kpitracking.enums.BscUnitResultStatus;
import com.kpitracking.repository.BscPerspectiveRepository;
import com.kpitracking.repository.BscScorecardRepository;
import com.kpitracking.repository.BscUnitResultRepository;
import com.kpitracking.repository.EvaluationPerspectiveScoreRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Chấm điểm cá nhân với dòng "Kết quả cấp trên" (phân rã cả bộ).
 *
 * <pre>
 *   Công ty (A 25 · B 30 · C 35 · D 10)  ──giao cả bộ──▶  Phòng: E1 "Kết quả công ty" + riêng
 *   Phòng                                 ──giao cả bộ──▶  Tổ:    E2 "Kết quả phòng" 10% + riêng 90%
 * </pre>
 * Nhân viên của tổ được chấm theo thẻ tổ.
 */
class BscWholeCascadeScoringTest {

    static final UUID ORG = UUID.randomUUID(), PERIOD = UUID.randomUUID(), USER = UUID.randomUUID();

    BscScorecardRepository scorecardRepository = mock(BscScorecardRepository.class);
    KpiCriteriaRepository kpiCriteriaRepository = mock(KpiCriteriaRepository.class);
    UserRoleOrgUnitRepository userRoleOrgUnitRepository = mock(UserRoleOrgUnitRepository.class);
    BscUnitResultRepository unitResultRepository = mock(BscUnitResultRepository.class);
    BscScoringService service;

    BscScorecard company, dept, team;
    OrgUnit teamUnit;

    @BeforeEach
    void setUp() {
        service = new BscScoringService(scorecardRepository, kpiCriteriaRepository,
                mock(KpiAchievementCalculator.class), mock(BscPerspectiveRepository.class),
                mock(EvaluationPerspectiveScoreRepository.class), userRoleOrgUnitRepository,
                new BscSourceScores(unitResultRepository));

        company = card("BSC công ty", null);
        dept = card("BSC phòng", company);
        team = card("BSC tổ", dept);
        // Thẻ phòng nhận kết quả công ty — dòng này KHÔNG được đọc khi chấm người của tổ.
        dept.getScorecardPerspectives().add(sourceRow(dept, company, 10.0));
        team.getScorecardPerspectives().add(sourceRow(team, dept, 10.0));
        team.getScorecardPerspectives().add(ownRow(team, 90.0));

        teamUnit = OrgUnit.builder().id(UUID.randomUUID()).name("Tổ A").build();
        UserRoleOrgUnit role = mock(UserRoleOrgUnit.class);
        when(role.getOrgUnit()).thenReturn(teamUnit);
        when(userRoleOrgUnitRepository.findByUserId(USER)).thenReturn(List.of(role));
        when(scorecardRepository.findByOrgUnitAndPeriod(ORG, teamUnit.getId(), PERIOD)).thenReturn(List.of(team));
        when(kpiCriteriaRepository.findByUserIdInAssigneesAndKpiPeriodId(eq(USER), eq(PERIOD), any(), any()))
                .thenReturn(new PageImpl<>(List.of()));
    }

    @Test
    @DisplayName("Hai tầng: dòng E của tổ lấy đúng kết quả đã lưu của PHÒNG, không đệ quy lên công ty")
    void twoTierReadsDirectSourceOnly() {
        stubResult(dept, 80.0, BscUnitResultStatus.FINALIZED);

        var score = service.computeForUser(USER, PERIOD, ORG, false);

        PerspectiveScoreResponse e = sourceLine(score);
        assertThat(e.getAchievementPercent()).isEqualTo(80.0);
        assertThat(e.getWeightedScore()).isEqualTo(8.0);
        assertThat(e.getSourceScorecardName()).isEqualTo("BSC phòng");
        assertThat(e.getProvisional()).isFalse();
        // Hạng mục riêng chưa có KPI ⇒ bỏ qua (RENORMALIZE), điểm BSC = đúng điểm dòng E.
        assertThat(score.getBscScore()).isEqualTo(80.0);
        assertThat(score.getProvisionalSourceNames()).isEmpty();
        // Chỉ hỏi kết quả của thẻ nguồn trực tiếp — thẻ công ty không bị đụng tới.
        verify(unitResultRepository).findByScorecardIdInAndKpiPeriodId(eq(java.util.Set.of(dept.getId())), eq(PERIOD));
    }

    @Test
    @DisplayName("Thẻ nguồn chưa chốt ⇒ điểm dòng E là số tạm tính và được báo tên")
    void provisionalWhenSourceNotFinalized() {
        stubResult(dept, 65.0, BscUnitResultStatus.DRAFT);

        var score = service.computeForUser(USER, PERIOD, ORG, false);

        assertThat(sourceLine(score).getAchievementPercent()).isEqualTo(65.0);
        assertThat(sourceLine(score).getProvisional()).isTrue();
        assertThat(score.getProvisionalSourceNames()).containsExactly("BSC phòng");
    }

    @Test
    @DisplayName("Thẻ nguồn chưa tính kết quả đợt ⇒ dòng E rỗng, vẫn báo là đang chờ")
    void emptyWhenSourceNotComputed() {
        when(unitResultRepository.findByScorecardIdInAndKpiPeriodId(anyCollection(), eq(PERIOD))).thenReturn(List.of());

        var score = service.computeForUser(USER, PERIOD, ORG, false);

        assertThat(sourceLine(score).getAchievementPercent()).isNull();
        assertThat(score.getBscScore()).isNull();
        assertThat(score.getProvisionalSourceNames()).containsExactly("BSC phòng");
    }

    @Test
    @DisplayName("Điểm thẻ nguồn trên 100% được lấy nguyên — không áp trần riêng ở dòng E")
    void takesSourceScoreAsIs() {
        stubResult(dept, 115.0, BscUnitResultStatus.FINALIZED);
        team.setEmptyPerspectivePolicy(BscEmptyPerspectivePolicy.ZERO_FILL);

        var score = service.computeForUser(USER, PERIOD, ORG, false);

        assertThat(sourceLine(score).getAchievementPercent()).isEqualTo(115.0);
        // ZERO_FILL: hạng mục riêng 90% không có KPI tính 0 ⇒ 10% × 115 = 11.5
        assertThat(score.getBscScore()).isEqualTo(11.5);
    }

    @Test
    @DisplayName("Thẻ đã ĐÓNG thôi chấm điểm — người của đơn vị rơi về thẻ cấp trên (ở đây: không còn thẻ nào)")
    void closedScorecardIsNotUsedForScoring() {
        team.setStatus(com.kpitracking.enums.BscScorecardStatus.CLOSED);

        assertThat(service.computeForUser(USER, PERIOD, ORG, false)).isNull();
        assertThat(service.resolveScorecardForUser(USER, ORG, PERIOD)).isNull();
    }

    @Test
    @DisplayName("Đơn vị chưa có bộ riêng ⇒ chưa áp dụng BSC, KHÔNG mượn bộ của đơn vị cha / toàn tổ chức")
    void noOwnScorecardMeansNoBsc() {
        OrgUnit parentUnit = OrgUnit.builder().id(UUID.randomUUID()).name("Công ty").build();
        teamUnit.setParent(parentUnit);
        when(scorecardRepository.findByOrgUnitAndPeriod(ORG, teamUnit.getId(), PERIOD)).thenReturn(List.of());
        when(scorecardRepository.findByOrgUnitAndPeriod(ORG, parentUnit.getId(), PERIOD)).thenReturn(List.of(company));
        when(scorecardRepository.findDefaultByPeriod(ORG, PERIOD)).thenReturn(List.of(company));

        assertThat(service.computeForUser(USER, PERIOD, ORG, false)).isNull();
        assertThat(service.resolveScorecardForUser(USER, ORG, PERIOD)).isNull();
    }

    // ------------------------------------------------------------

    void stubResult(BscScorecard card, Double percent, BscUnitResultStatus status) {
        BscUnitResult r = BscUnitResult.builder().scorecard(card).achievementPercent(percent).status(status).build();
        when(unitResultRepository.findByScorecardIdInAndKpiPeriodId(anyCollection(), eq(PERIOD))).thenReturn(List.of(r));
    }

    static PerspectiveScoreResponse sourceLine(BscScoringService.BscUserScore score) {
        return score.getPerspectives().stream().filter(p -> p.getSourceScorecardId() != null).findFirst().orElseThrow();
    }

    static BscScorecard card(String name, BscScorecard parent) {
        return BscScorecard.builder().id(UUID.randomUUID()).name(name).parentScorecard(parent)
                .scoringMode(BscScoringMode.OFFICIAL)
                .emptyPerspectivePolicy(BscEmptyPerspectivePolicy.RENORMALIZE)
                .scorecardPerspectives(new ArrayList<>())
                .build();
    }

    static BscScorecardPerspective sourceRow(BscScorecard owner, BscScorecard source, double weight) {
        BscPerspective p = BscPerspective.builder().id(UUID.randomUUID()).code("SRC").name("Kết quả " + source.getName())
                .fixedPerspective(BscFixedPerspective.FINANCIAL).sourceScorecard(source).build();
        return BscScorecardPerspective.builder().id(UUID.randomUUID()).scorecard(owner).perspective(p)
                .weightPercentage(weight).build();
    }

    static BscScorecardPerspective ownRow(BscScorecard owner, double weight) {
        BscPerspective p = BscPerspective.builder().id(UUID.randomUUID()).code("OWN").name("Hạng mục riêng")
                .fixedPerspective(BscFixedPerspective.CUSTOMER).build();
        return BscScorecardPerspective.builder().id(UUID.randomUUID()).scorecard(owner).perspective(p)
                .weightPercentage(weight).build();
    }
}
