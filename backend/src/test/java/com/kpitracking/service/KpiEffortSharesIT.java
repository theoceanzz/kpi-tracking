package com.kpitracking.service;

import com.kpitracking.dto.request.user.UpdateEffortSharesRequest;
import com.kpitracking.dto.request.userrole.AssignRoleRequest;
import com.kpitracking.dto.response.evaluation.EffortShareLine;
import com.kpitracking.dto.response.evaluation.EvaluationScorePreview;
import com.kpitracking.dto.response.user.UserEffortShareResponse;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

/**
 * "% công sức" của người kiêm nhiệm (V46) trên dữ liệu demo: staff@demo.com có 100% KPI ở Team Backend
 * đợt Tháng 1/2026, được gán kiêm nhiệm Team Content và nhận thêm một KPI 100% ở đó. Phần công thức
 * thuần ở {@link KpiEffortSharesTest}.
 *
 * <p>Cần DB local (org demo DEMO1). Mỗi test rollback. Chạy tay: {@code ./mvnw test -Dtest=KpiEffortSharesIT}.
 */
@SpringBootTest
@Transactional
class KpiEffortSharesIT {

    private static final UUID PHONG_IT = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID TEAM_BACKEND = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private static final UUID TEAM_CONTENT = UUID.fromString("ffffffff-ffff-ffff-ffff-ffffffffffff");
    private static final UUID DEMO1 = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID PERIOD = UUID.fromString("44444444-0000-0000-0000-000020260100");

    @Autowired UserService userService;
    @Autowired UserRoleService userRoleService;
    @Autowired EvaluationService evaluationService;
    @Autowired KpiCriteriaService kpiCriteriaService;
    @Autowired KpiEffortShares effortShares;
    @Autowired EvaluationReadinessService readinessService;
    @Autowired com.kpitracking.repository.KpiPeriodRepository kpiPeriodRepository;
    @Autowired com.kpitracking.service.feedback360.F360RaterSuggestionService raterSuggestions;
    @Autowired PrimaryUnitResolver primaryUnits;
    @Autowired JdbcTemplate jdbc;
    @Autowired jakarta.persistence.EntityManager em;

    private UUID staff;
    private List<UUID> backendKpis;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("director@demo.com", null, List.of()));
        staff = jdbc.queryForObject("SELECT id FROM users WHERE email = 'staff@demo.com'", UUID.class);
        backendKpis = jdbc.queryForList("""
                SELECT k.id FROM kpi_criteria k JOIN kpi_criteria_assignees a ON a.kpi_criteria_id = k.id
                 WHERE a.user_id = ? AND k.kpi_period_id = ? AND k.deleted_at IS NULL""", UUID.class, staff, PERIOD);
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void singleBranch_scoresExactlyAsBefore() {
        EvaluationScorePreview p = evaluationService.getScorePreview(PERIOD, staff);
        assertThat(p.getKpiWeightFactors()).isNullOrEmpty();
        assertThat(p.getEffortShares()).isNullOrEmpty();
        assertThat(userService.getUserById(staff).getEffortShares()).isNull();
    }

    @Test
    void secondBranch_splitsEquallyByDefault_thenFollowsConfiguredShares() {
        UUID contentKpi = secondBranchWithKpi();

        EvaluationScorePreview equal = evaluationService.getScorePreview(PERIOD, staff);
        assertThat(equal.getEffortShares()).extracting(EffortShareLine::getOrgUnitId).containsExactly(TEAM_BACKEND, TEAM_CONTENT);
        assertThat(equal.getEffortShares()).extracting(EffortShareLine::getSharePercent).containsExactly(50.0, 50.0);
        // Team Backend: 2 KPI × 50% trọng số ⇒ hệ số 0.5; Team Content: 1 KPI 100% ⇒ 0.5.
        backendKpis.forEach(id -> assertThat(equal.getKpiWeightFactors().get(id)).isCloseTo(0.5, within(1e-9)));
        assertThat(equal.getKpiWeightFactors().get(contentKpi)).isCloseTo(0.5, within(1e-9));
        Double backendCompletion = equal.getEffortShares().get(0).getCompletionPercent();
        // KPI ở Team Content chưa nộp ⇒ 0% ⇒ hoàn thành chung = 50% × hoàn thành của Team Backend.
        assertThat(equal.getKpiCompletionPercent()).isCloseTo(backendCompletion * 0.5, within(0.1));

        userService.updateEffortShares(staff, shares(80, 20));
        em.flush();

        EvaluationScorePreview weighted = evaluationService.getScorePreview(PERIOD, staff);
        assertThat(weighted.getEffortShares()).extracting(EffortShareLine::getSharePercent).containsExactly(80.0, 20.0);
        backendKpis.forEach(id -> assertThat(weighted.getKpiWeightFactors().get(id)).isCloseTo(0.8, within(1e-9)));
        assertThat(weighted.getKpiCompletionPercent()).isCloseTo(backendCompletion * 0.8, within(0.1));
        assertThat(userService.getUserById(staff).getEffortShares())
                .extracting(UserEffortShareResponse::getSharePercent, UserEffortShareResponse::isConfigured)
                .containsExactly(org.assertj.core.groups.Tuple.tuple(80.0, true), org.assertj.core.groups.Tuple.tuple(20.0, true));
    }

    @Test
    void shares_mustCoverEveryBranchAndAddUpTo100() {
        secondBranchWithKpi();

        assertThatThrownBy(() -> userService.updateEffortShares(staff, shares(80, 30)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode()).isEqualTo(ErrorCode.EFFORT_SHARES_TOTAL_NOT_100);
        // Phòng IT chỉ là dòng nhân viên tự sinh ở cha của Team Backend — không phải một nhánh riêng.
        UpdateEffortSharesRequest parent = UpdateEffortSharesRequest.builder().shares(List.of(
                item(PHONG_IT, 50), item(TEAM_CONTENT, 50))).build();
        assertThatThrownBy(() -> userService.updateEffortShares(staff, parent))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode()).isEqualTo(ErrorCode.EFFORT_SHARE_UNIT_NOT_BRANCH);
        // Rỗng = về chia đều.
        userService.updateEffortShares(staff, shares(80, 20));
        userService.updateEffortShares(staff, UpdateEffortSharesRequest.builder().build());
        assertThat(userService.getUserById(staff).getEffortShares())
                .extracting(UserEffortShareResponse::getSharePercent).containsExactly(50.0, 50.0);
    }

    @Test
    void totalWeight_sameBranch_countsEachBranchSeparately() {
        secondBranchWithKpi();

        assertThat(kpiCriteriaService.getTotalWeight(TEAM_CONTENT, staff, PERIOD, true)).isCloseTo(100.0, within(1e-6));
        assertThat(kpiCriteriaService.getTotalWeight(TEAM_BACKEND, staff, PERIOD, true)).isCloseTo(100.0, within(1e-6));
        // KPI giao từ Phòng IT thuộc nhánh Team Backend bên dưới nó.
        assertThat(kpiCriteriaService.getTotalWeight(PHONG_IT, staff, PERIOD, true)).isCloseTo(100.0, within(1e-6));
        assertThat(kpiCriteriaService.getTotalWeight(null, staff, PERIOD)).isCloseTo(200.0, within(1e-6));
    }

    @Test
    void sharesFrozenAtScoring_ignoreLaterEdits() {
        secondBranchWithKpi();
        // Lần chấm đầu của quản lý chụp % đang áp dụng (50/50) cho đợt.
        effortShares.freezeForPeriod(staff, PERIOD, kpisOfStaff());
        em.flush();

        userService.updateEffortShares(staff, shares(80, 20));
        em.flush();

        EvaluationScorePreview p = evaluationService.getScorePreview(PERIOD, staff);
        assertThat(p.getEffortShares()).extracting(EffortShareLine::getSharePercent).containsExactly(50.0, 50.0);
        assertThat(p.getEffortShares()).allMatch(EffortShareLine::isFrozen);
        // Hồ sơ vẫn hiện % mới — áp cho các đợt chưa chấm.
        assertThat(userService.getUserById(staff).getEffortShares())
                .extracting(UserEffortShareResponse::getSharePercent).containsExactly(80.0, 20.0);
    }

    @Test
    void readiness_namesTheUnitOfMissingSecondaryKpis() {
        secondBranchWithKpi();
        var r = readinessService.compute(kpiPeriodRepository.findById(PERIOD).orElseThrow(), staff);
        assertThat(r.getMissingKpiNames()).contains("IT kiêm nhiệm (Team Content)");
        assertThat(r.getMissingKpiNames()).noneMatch(n -> n.endsWith("(Team Backend)"));
    }

    @Test
    void import_existingActiveUser_addsSecondaryUnitWithoutTouchingProfile() {
        String name = jdbc.queryForObject("SELECT full_name FROM users WHERE id = ?", String.class, staff);
        String code = jdbc.queryForObject("SELECT code FROM org_units WHERE id = ?", String.class, TEAM_CONTENT);
        String csv = "Email,FullName,Role,OrgUnitCode\nstaff@demo.com,Ten khac,," + code + "\n";
        var file = new org.springframework.mock.web.MockMultipartFile("file", "u.csv", "text/csv",
                csv.getBytes(java.nio.charset.StandardCharsets.UTF_8));

        var first = userService.importUsers(file, null);
        em.flush();
        assertThat(first.getErrors()).isEmpty();
        assertThat(jdbc.queryForList("SELECT org_unit_id FROM user_role_org_units WHERE user_id = ?", UUID.class, staff))
                .contains(TEAM_BACKEND, TEAM_CONTENT);
        assertThat(jdbc.queryForObject("SELECT full_name FROM users WHERE id = ?", String.class, staff)).isEqualTo(name);
        assertThat(primaryUnits.unitOf(staff).getId()).isEqualTo(TEAM_BACKEND);

        // Nhập lại cùng dòng ⇒ báo đã thuộc, không thêm gì.
        var again = userService.importUsers(file, null);
        assertThat(again.getErrors()).hasSize(1);
    }

    @Test
    void f360Snapshot_listsTheSecondaryBranchOnly() {
        secondBranchWithKpi();
        var snap = raterSuggestions.snapshot(DEMO1);
        assertThat(snap.secondaryUnits(staff)).containsOnlyKeys(TEAM_CONTENT);
    }

    private List<com.kpitracking.entity.KpiCriteria> kpisOfStaff() {
        return jdbc.queryForList(
                "SELECT k.id FROM kpi_criteria k JOIN kpi_criteria_assignees a ON a.kpi_criteria_id = k.id "
                        + "WHERE a.user_id = ? AND k.kpi_period_id = ? AND k.deleted_at IS NULL", UUID.class, staff, PERIOD)
                .stream().map(id -> em.find(com.kpitracking.entity.KpiCriteria.class, id)).toList();
    }

    /** Kiêm nhiệm Team Content + một KPI 100% ở đó (chưa nộp) cho staff. */
    private UUID secondBranchWithKpi() {
        UUID staffRole = jdbc.queryForObject(
                "SELECT id FROM roles WHERE organization_id = ? AND rank = 2 AND deleted_at IS NULL LIMIT 1", UUID.class, DEMO1);
        userRoleService.assignRole(AssignRoleRequest.builder().userId(staff).roleId(staffRole).orgUnitId(TEAM_CONTENT).build());
        UUID src = backendKpis.get(0);
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO kpi_criteria (id, org_unit_id, kpi_period_id, name, kpi_type, weight, frequency, origin,
                                          is_bonus_kpi, status, created_by, created_at, updated_at)
                SELECT ?, ?, kpi_period_id, 'IT kiêm nhiệm', 'QUANTITATIVE', 100, frequency, origin,
                       false, 'APPROVED', created_by, now(), now() FROM kpi_criteria WHERE id = ?""", id, TEAM_CONTENT, src);
        jdbc.update("INSERT INTO quantitative_kpi_details (kpi_criteria_id, target_value, is_reverse_kpi) VALUES (?, 100, false)", id);
        jdbc.update("INSERT INTO kpi_criteria_assignees (kpi_criteria_id, user_id) VALUES (?, ?)", id, staff);
        em.flush();
        em.clear();
        return id;
    }

    private static UpdateEffortSharesRequest shares(double backend, double content) {
        return UpdateEffortSharesRequest.builder().shares(List.of(item(TEAM_BACKEND, backend), item(TEAM_CONTENT, content))).build();
    }

    private static UpdateEffortSharesRequest.Item item(UUID unit, double pct) {
        return UpdateEffortSharesRequest.Item.builder().orgUnitId(unit).sharePercent(pct).build();
    }
}
