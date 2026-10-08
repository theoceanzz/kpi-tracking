package com.kpitracking.service.kpi;

import com.kpitracking.dto.response.kpi.KpiCriteriaResponse;
import com.kpitracking.enums.DiscussionTargetType;
import com.kpitracking.exception.CodedException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.service.KpiCriteriaService;
import com.kpitracking.service.discussion.DiscussionService;
import com.kpitracking.service.discussion.DiscussionSubscriptionGuard;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Luật xem KPI theo chuỗi duyệt trên PostgreSQL THẬT: cấp trên KHÔNG thấy KPI đang chờ ở bước dưới, thấy khi tới
 * lượt mình hoặc khi KPI đã duyệt; người đã duyệt bước dưới vẫn xem được sau khi KPI chuyển lên.
 * Dùng một đơn vị con (trưởng phòng + nhân viên) nằm dưới một đơn vị cha (trưởng khối), cả hai trưởng không phải
 * quản trị viên. Chạy tay: {@code ./mvnw test -Dtest=KpiAccessChainIT}.
 */
@SpringBootTest
class KpiAccessChainIT {

    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository userRepository;
    @Autowired KpiCriteriaService kpiCriteriaService;
    @Autowired DiscussionService discussionService;
    @Autowired DiscussionSubscriptionGuard subscriptionGuard;
    @Autowired PlatformTransactionManager txManager;

    private UUID orgId, teamId, deptId, employee, teamHead, deptHead;
    private UUID cycleId, periodId, kpiId, flowId, step1, step2;

    @BeforeEach
    void fixture() {
        Map<String, Object> row = jdbc.queryForMap("""
                WITH admin AS (SELECT DISTINCT uro.user_id FROM user_role_org_units uro
                                 JOIN role_permissions rp ON rp.role_id = uro.role_id
                                 JOIN permissions p ON p.id = rp.permission_id AND p.code = 'SYSTEM:ADMIN'),
                     heads AS (SELECT uro.user_id, uro.org_unit_id FROM user_role_org_units uro
                                 JOIN roles r ON r.id = uro.role_id
                                 JOIN users u ON u.id = uro.user_id AND u.deleted_at IS NULL AND u.status = 'ACTIVE'
                                WHERE r.rank = 0 AND uro.user_id NOT IN (SELECT user_id FROM admin))
                SELECT c.id AS team_id, p.id AS dept_id, h1.user_id AS team_head, h2.user_id AS dept_head,
                       hl.organization_id AS org_id,
                       (SELECT s.user_id FROM user_role_org_units s JOIN roles r ON r.id = s.role_id
                          JOIN users u ON u.id = s.user_id AND u.status = 'ACTIVE' AND u.deleted_at IS NULL
                         WHERE s.org_unit_id = c.id AND r.rank = 2
                           AND NOT EXISTS (SELECT 1 FROM user_role_org_units x JOIN roles xr ON xr.id = x.role_id
                                            WHERE x.user_id = s.user_id AND xr.rank <= 1)
                         LIMIT 1) AS employee
                  FROM org_units c JOIN org_units p ON p.id = c.parent_id
                  JOIN org_hierarchy_levels hl ON hl.id = c.org_hierarchy_id
                  JOIN heads h1 ON h1.org_unit_id = c.id
                  JOIN heads h2 ON h2.org_unit_id = p.id AND h2.user_id <> h1.user_id
                 WHERE c.deleted_at IS NULL
                   AND NOT EXISTS (SELECT 1 FROM user_role_org_units x JOIN roles xr ON xr.id = x.role_id
                                    WHERE x.user_id = h2.user_id AND x.org_unit_id = c.id)
                   AND EXISTS (SELECT 1 FROM user_role_org_units s JOIN roles r ON r.id = s.role_id
                                 JOIN users u ON u.id = s.user_id AND u.status = 'ACTIVE'
                                WHERE s.org_unit_id = c.id AND r.rank = 2
                                  AND NOT EXISTS (SELECT 1 FROM user_role_org_units x JOIN roles xr ON xr.id = x.role_id
                                                   WHERE x.user_id = s.user_id AND xr.rank <= 1))
                 LIMIT 1""");
        teamId = (UUID) row.get("team_id");
        deptId = (UUID) row.get("dept_id");
        teamHead = (UUID) row.get("team_head");
        deptHead = (UUID) row.get("dept_head");
        employee = (UUID) row.get("employee");
        orgId = (UUID) row.get("org_id");

        cycleId = UUID.randomUUID();
        jdbc.update("INSERT INTO kpi_cycles (id, organization_id, name, cycle_type, start_date, end_date, status) "
                + "VALUES (?, ?, 'IT chuỗi xem 2099', 'SEMI_ANNUALLY', '2099-01-01'::timestamptz, '2099-06-30'::timestamptz, 'OPEN')",
                cycleId, orgId);
        periodId = UUID.randomUUID();
        jdbc.update("INSERT INTO kpi_periods (id, organization_id, kpi_cycle_id, name, period_type, start_date, end_date) "
                + "VALUES (?, ?, ?, 'IT đợt 2099', 'QUARTERLY', '2099-01-01'::timestamptz, '2099-03-31'::timestamptz)",
                periodId, orgId, cycleId);
        // KPI nhân viên tự lập, đang chờ duyệt: bước 1 trưởng phòng (đang chờ), bước 2 trưởng khối (chưa tới lượt).
        kpiId = UUID.randomUUID();
        jdbc.update("INSERT INTO kpi_criteria (id, org_unit_id, kpi_period_id, name, frequency, status, created_by, weight, origin) "
                + "VALUES (?, ?, ?, 'IT KPI chuỗi xem', 'QUARTERLY', 'PENDING_APPROVAL', ?, 100, 'SELF')", kpiId, teamId, periodId, employee);
        jdbc.update("INSERT INTO quantitative_kpi_details (kpi_criteria_id, target_value, is_reverse_kpi) VALUES (?, 10, false)", kpiId);
        jdbc.update("INSERT INTO kpi_criteria_assignees (kpi_criteria_id, user_id) VALUES (?, ?)", kpiId, employee);
        flowId = UUID.randomUUID();
        jdbc.update("INSERT INTO kpi_approval_flows (id, organization_id, subject_type, kpi_criteria_id, requester_id, current_step_order) "
                + "VALUES (?, ?, 'CRITERIA', ?, ?, 1)", flowId, orgId, kpiId, employee);
        step1 = step(1, teamId, "PENDING", teamHead);
        step2 = step(2, deptId, "WAITING", deptHead);
    }

    private UUID step(int order, UUID unit, String status, UUID holder) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO kpi_approval_steps (id, flow_id, step_order, org_unit_id, org_unit_name, status, pending_since) "
                + "VALUES (?, ?, ?, ?, 'IT', ?, now())", id, flowId, order, unit, status);
        jdbc.update("INSERT INTO kpi_approval_step_approvers (step_id, user_id, user_name) VALUES (?, ?, 'IT')", id, holder);
        return id;
    }

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
        jdbc.update("DELETE FROM discussion_comments WHERE target_id = ?", kpiId);
        jdbc.update("DELETE FROM kpi_approval_flows WHERE kpi_criteria_id = ?", kpiId);
        jdbc.update("DELETE FROM kpi_criteria_assignees WHERE kpi_criteria_id = ?", kpiId);
        jdbc.update("DELETE FROM quantitative_kpi_details WHERE kpi_criteria_id = ?", kpiId);
        jdbc.update("DELETE FROM kpi_criteria WHERE id = ?", kpiId);
        jdbc.update("DELETE FROM kpi_periods WHERE id = ?", periodId);
        jdbc.update("DELETE FROM kpi_cycles WHERE id = ?", cycleId);
    }

    private String email(UUID userId) {
        return userRepository.findById(userId).orElseThrow().getEmail();
    }

    private void loginAs(UUID userId) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(email(userId), "x", List.of()));
    }

    /** Người dùng thấy KPI ở mọi cửa: chi tiết, danh sách, thảo luận, kênh WebSocket. */
    private void assertVisible(UUID userId, boolean visible) {
        loginAs(userId);
        // getKpiCriteria không tự mở transaction (qua HTTP thì open-session-in-view giữ phiên) — test mở hộ.
        List<UUID> listed = new TransactionTemplate(txManager).execute(s -> kpiCriteriaService.getKpiCriteria(0, 50, null, null,
                        null, null, periodId, null, null, null, "createdAt", "desc", null, null, null, false, null, null, null, null)
                .getContent().stream().map(KpiCriteriaResponse::getId).toList());
        assertThat(listed.contains(kpiId)).as("danh sách").isEqualTo(visible);
        assertThat(subscriptionGuard.canSubscribe(email(userId), "/topic/discussion.KPI." + kpiId)).as("WebSocket").isEqualTo(visible);
        if (visible) {
            assertThat(kpiCriteriaService.getKpiCriteriaById(kpiId).getId()).isEqualTo(kpiId);
            assertThat(discussionService.page(DiscussionTargetType.KPI, kpiId, null, 20)).isNotNull();
        } else {
            assertThatThrownBy(() -> kpiCriteriaService.getKpiCriteriaById(kpiId))
                    .satisfies(e -> assertThat(((CodedException) e).getErrorCode()).isEqualTo(ErrorCode.NO_PERMISSION_VIEW_KPI));
            assertThatThrownBy(() -> discussionService.page(DiscussionTargetType.KPI, kpiId, null, 20))
                    .satisfies(e -> assertThat(((CodedException) e).getErrorCode()).isEqualTo(ErrorCode.DISCUSSION_NO_PERMISSION_VIEW));
        }
    }

    @Test
    void upperHeadDoesNotSeeKpiPendingAtLowerStep_thenSeesItWhenItIsTheirTurn() {
        assertVisible(teamHead, true);   // đang giữ bước hiện tại
        assertVisible(deptHead, false);  // bước của mình chưa tới

        // @tag: trưởng khối không được gợi ý khi KPI chưa tới bước của họ.
        loginAs(employee);
        assertThat(discussionService.mentionCandidates(DiscussionTargetType.KPI, kpiId, null))
                .extracting(m -> m.getId()).contains(teamHead).doesNotContain(deptHead);

        // Trưởng phòng duyệt bước 1, chuyển lên trưởng khối.
        jdbc.update("UPDATE kpi_approval_steps SET status = 'APPROVED_FORWARDED', acted_by_id = ?, acted_at = now() WHERE id = ?", teamHead, step1);
        jdbc.update("UPDATE kpi_approval_steps SET status = 'PENDING', pending_since = now() WHERE id = ?", step2);
        jdbc.update("UPDATE kpi_approval_flows SET current_step_order = 2 WHERE id = ?", flowId);

        assertVisible(deptHead, true);   // tới lượt mình
        assertVisible(teamHead, true);   // đã duyệt bước dưới, vẫn xem được (chỉ đọc)
    }

    @Test
    void upperHeadSeesKpiOnlyAfterFinalApproval() {
        // Chuỗi một bước: trưởng phòng là người duyệt cuối, trưởng khối không nằm trong chuỗi.
        jdbc.update("DELETE FROM kpi_approval_steps WHERE id = ?", step2);
        assertVisible(deptHead, false);

        jdbc.update("UPDATE kpi_approval_steps SET status = 'APPROVED_FINAL', acted_by_id = ?, acted_at = now() WHERE id = ?", teamHead, step1);
        jdbc.update("UPDATE kpi_approval_flows SET status = 'APPROVED' WHERE id = ?", flowId);
        jdbc.update("UPDATE kpi_criteria SET status = 'APPROVED', approved_by = ?, approved_at = now() WHERE id = ?", teamHead, kpiId);

        assertVisible(deptHead, true);
    }

    @Test
    void draftIsVisibleOnlyToItsCreatorAndAssignees() {
        jdbc.update("DELETE FROM kpi_approval_flows WHERE id = ?", flowId);
        jdbc.update("UPDATE kpi_criteria SET status = 'DRAFT' WHERE id = ?", kpiId);
        assertVisible(employee, true);
        assertVisible(teamHead, false);
        assertVisible(deptHead, false);
    }
}
