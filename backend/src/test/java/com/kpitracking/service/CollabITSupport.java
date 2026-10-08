package com.kpitracking.service;

import com.kpitracking.exception.CodedException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Dữ liệu dựng sẵn cho test tích hợp thảo luận / công việc trên PostgreSQL THẬT (DB dev đã chạy Flyway tới V37):
 * một đơn vị có trưởng ({@link #head}, rank 0) và hai nhân viên ({@link #employee}, {@link #colleague}, rank 2,
 * không có MODERATE / VIEW_TEAM), một người ở tổ chức khác ({@link #outsider}); một kỳ + đợt năm 2099 và một KPI
 * đã duyệt do trưởng giao cho {@link #employee}. Mọi thứ tạo ra bị xoá sau mỗi test.
 */
@SpringBootTest
public abstract class CollabITSupport {

    @Autowired protected JdbcTemplate jdbc;
    @Autowired protected UserRepository userRepository;

    protected UUID orgId, unitId, head, employee, colleague, outsider;
    protected UUID cycleId, periodId, kpiId;

    @BeforeEach
    void collabFixture() {
        Map<String, Object> unit = jdbc.queryForMap("""
                SELECT ou.id AS unit_id, h.organization_id AS org_id
                  FROM org_units ou JOIN org_hierarchy_levels h ON h.id = ou.org_hierarchy_id
                 WHERE ou.deleted_at IS NULL
                   AND EXISTS (SELECT 1 FROM user_role_org_units u JOIN roles r ON r.id = u.role_id
                                JOIN users us ON us.id = u.user_id AND us.deleted_at IS NULL AND us.status = 'ACTIVE'
                                WHERE u.org_unit_id = ou.id AND r.rank = 0)
                   AND (SELECT COUNT(DISTINCT u.user_id) FROM user_role_org_units u JOIN roles r ON r.id = u.role_id
                          JOIN users us ON us.id = u.user_id AND us.deleted_at IS NULL AND us.status = 'ACTIVE'
                         WHERE u.org_unit_id = ou.id AND r.rank = 2) >= 2
                 LIMIT 1""");
        unitId = (UUID) unit.get("unit_id");
        orgId = (UUID) unit.get("org_id");
        head = jdbc.queryForObject("""
                SELECT u.user_id FROM user_role_org_units u JOIN roles r ON r.id = u.role_id
                  JOIN users us ON us.id = u.user_id AND us.deleted_at IS NULL AND us.status = 'ACTIVE'
                 WHERE u.org_unit_id = ? AND r.rank = 0 LIMIT 1""", UUID.class, unitId);
        List<UUID> staff = jdbc.queryForList("""
                SELECT DISTINCT u.user_id FROM user_role_org_units u JOIN roles r ON r.id = u.role_id
                  JOIN users us ON us.id = u.user_id AND us.deleted_at IS NULL AND us.status = 'ACTIVE'
                 WHERE u.org_unit_id = ? AND r.rank = 2 AND u.user_id <> ?
                   AND NOT EXISTS (SELECT 1 FROM user_role_org_units x JOIN roles xr ON xr.id = x.role_id
                                    WHERE x.user_id = u.user_id AND xr.rank <= 1)
                   AND NOT EXISTS (SELECT 1 FROM user_role_org_units x JOIN role_permissions rp ON rp.role_id = x.role_id
                                    JOIN permissions p ON p.id = rp.permission_id
                                    WHERE x.user_id = u.user_id
                                      AND p.code IN ('SYSTEM:ADMIN', 'KPI_COMMENT:MODERATE', 'TASK:VIEW_TEAM'))
                 LIMIT 2""", UUID.class, unitId, head);
        employee = staff.get(0);
        colleague = staff.get(1);
        outsider = jdbc.queryForObject("""
                SELECT u.user_id FROM user_role_org_units u JOIN org_units ou ON ou.id = u.org_unit_id
                  JOIN org_hierarchy_levels h ON h.id = ou.org_hierarchy_id
                  JOIN users us ON us.id = u.user_id AND us.deleted_at IS NULL AND us.status = 'ACTIVE'
                 WHERE h.organization_id <> ? LIMIT 1""", UUID.class, orgId);

        cycleId = UUID.randomUUID();
        jdbc.update("INSERT INTO kpi_cycles (id, organization_id, name, cycle_type, start_date, end_date, status) "
                + "VALUES (?, ?, 'IT cộng tác 2099', 'SEMI_ANNUALLY', '2099-01-01'::timestamptz, '2099-06-30'::timestamptz, 'OPEN')",
                cycleId, orgId);
        periodId = UUID.randomUUID();
        jdbc.update("INSERT INTO kpi_periods (id, organization_id, kpi_cycle_id, name, period_type, start_date, end_date) "
                + "VALUES (?, ?, ?, 'IT đợt 2099', 'QUARTERLY', '2099-01-01'::timestamptz, '2099-03-31'::timestamptz)",
                periodId, orgId, cycleId);
        kpiId = newKpi("IT KPI cộng tác", "APPROVED", head, employee);
    }

    /** Thêm một KPI trong đợt 2099 của fixture. */
    protected UUID newKpi(String name, String status, UUID createdBy, UUID assignee) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO kpi_criteria (id, org_unit_id, kpi_period_id, name, frequency, status, created_by, weight, origin) "
                + "VALUES (?, ?, ?, ?, 'QUARTERLY', ?, ?, 100, 'ASSIGNED')", id, unitId, periodId, name, status, createdBy);
        jdbc.update("INSERT INTO quantitative_kpi_details (kpi_criteria_id, target_value, is_reverse_kpi) VALUES (?, 10, false)", id);
        if (assignee != null) {
            jdbc.update("INSERT INTO kpi_criteria_assignees (kpi_criteria_id, user_id) VALUES (?, ?)", id, assignee);
        }
        return id;
    }

    @AfterEach
    void collabCleanup() {
        SecurityContextHolder.clearContext();
        List<UUID> kpis = jdbc.queryForList("SELECT id FROM kpi_criteria WHERE kpi_period_id = ?", UUID.class, periodId);
        for (UUID k : kpis) {
            jdbc.update("DELETE FROM notifications WHERE reference_id IN (SELECT id FROM discussion_comments WHERE target_id = ? "
                    + "OR target_id IN (SELECT id FROM kpi_tasks WHERE kpi_criteria_id = ?))", k, k);
            jdbc.update("DELETE FROM notifications WHERE reference_id = ? OR reference_id IN (SELECT id FROM kpi_tasks WHERE kpi_criteria_id = ?)", k, k);
            jdbc.update("DELETE FROM discussion_read_states WHERE target_id = ? OR target_id IN (SELECT id FROM kpi_tasks WHERE kpi_criteria_id = ?)", k, k);
            jdbc.update("DELETE FROM discussion_comments WHERE target_id = ? OR target_id IN (SELECT id FROM kpi_tasks WHERE kpi_criteria_id = ?)", k, k);
            jdbc.update("DELETE FROM kpi_tasks WHERE kpi_criteria_id = ?", k);
            jdbc.update("DELETE FROM kpi_approval_flows WHERE kpi_criteria_id = ?", k);
            jdbc.update("DELETE FROM kpi_criteria_assignees WHERE kpi_criteria_id = ?", k);
            jdbc.update("DELETE FROM quantitative_kpi_details WHERE kpi_criteria_id = ?", k);
        }
        jdbc.update("UPDATE kpi_criteria SET replaced_by_id = NULL WHERE kpi_period_id = ?", periodId);
        jdbc.update("DELETE FROM kpi_criteria WHERE kpi_period_id = ?", periodId);
        jdbc.update("DELETE FROM kpi_periods WHERE id = ?", periodId);
        jdbc.update("DELETE FROM kpi_cycles WHERE id = ?", cycleId);
    }

    protected void loginAs(UUID userId) {
        String email = userRepository.findById(userId).orElseThrow().getEmail();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(email, "x", List.of()));
    }

    protected static ErrorCode codeOf(Throwable t) {
        return ((CodedException) t).getErrorCode();
    }

    /** Thông báo chạy @Async sau commit — chờ tối đa 10 giây. */
    protected long waitNotifications(UUID userId, UUID referenceId) throws InterruptedException {
        for (int i = 0; i < 50; i++) {
            Long n = jdbc.queryForObject("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND reference_id = ?",
                    Long.class, userId, referenceId);
            if (n != null && n > 0) return n;
            Thread.sleep(200);
        }
        return 0;
    }
}
