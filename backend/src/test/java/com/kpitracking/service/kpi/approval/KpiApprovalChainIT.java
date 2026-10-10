package com.kpitracking.service.kpi.approval;

import com.kpitracking.exception.ErrorCode;
import com.kpitracking.dto.request.kpi.RejectKpiRequest;
import com.kpitracking.dto.request.kpi.approval.ApproveKpiRequest;
import com.kpitracking.entity.User;
import com.kpitracking.enums.ApprovalSubjectType;
import com.kpitracking.event.ApprovalChainNotificationListener;
import com.kpitracking.event.NotificationEventListener;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.StaleStateException;
import com.kpitracking.repository.KpiApprovalFlowRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.KpiCriteriaService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.*;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Chuỗi duyệt trên PostgreSQL THẬT — test 1 (hộp chờ: cấp trên chưa thấy), 8 (kỳ đã khoá) và
 * 10 (hai người duyệt cùng lúc).
 *
 * <p>Cần DB local đã chạy Flyway tới V19. Tên kết thúc bằng {@code IT} nên {@code mvn test} mặc
 * định không chạy; chạy tay: {@code ./mvnw test -Dtest=KpiApprovalChainIT}. Dữ liệu tạo ra nằm ở
 * năm 2099 và bị xoá sau mỗi test.
 */
@SpringBootTest
class KpiApprovalChainIT {

    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager txManager;
    @Autowired KpiApprovalChainService chainService;
    @Autowired KpiApprovalFlowRepository flowRepository;
    @Autowired KpiCriteriaService kpiCriteriaService;
    @Autowired UserRepository userRepository;

    @MockBean PermissionChecker permissionChecker;
    /** Không phát chuông/email thật vào DB dev. */
    @MockBean ApprovalChainNotificationListener chainNotifications;
    @MockBean NotificationEventListener kpiNotifications;

    private TransactionTemplate tx;
    private final ExecutorService pool = Executors.newFixedThreadPool(2);

    private UUID orgId, unitId, requester, approverA, approverB, approverC;
    private UUID cycleId, periodId, kpiId, flowId, step1, step2;

    @BeforeEach
    void fixture() {
        tx = new TransactionTemplate(txManager);
        orgId = jdbc.queryForObject("""
                SELECT h.organization_id FROM user_role_org_units uro
                  JOIN org_units ou ON ou.id = uro.org_unit_id
                  JOIN org_hierarchy_levels h ON h.id = ou.org_hierarchy_id
                  JOIN users u ON u.id = uro.user_id AND u.deleted_at IS NULL
                 GROUP BY h.organization_id HAVING COUNT(DISTINCT uro.user_id) >= 4 LIMIT 1""", UUID.class);
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT DISTINCT ON (uro.user_id) uro.user_id, uro.org_unit_id FROM user_role_org_units uro
                  JOIN org_units ou ON ou.id = uro.org_unit_id
                  JOIN org_hierarchy_levels h ON h.id = ou.org_hierarchy_id
                  JOIN users u ON u.id = uro.user_id AND u.deleted_at IS NULL
                 WHERE h.organization_id = ? LIMIT 4""", orgId);
        requester = (UUID) rows.get(0).get("user_id");
        unitId = (UUID) rows.get(0).get("org_unit_id");
        approverA = (UUID) rows.get(1).get("user_id");
        approverB = (UUID) rows.get(2).get("user_id");
        approverC = (UUID) rows.get(3).get("user_id");

        cycleId = UUID.randomUUID();
        jdbc.update("INSERT INTO kpi_cycles (id, organization_id, name, cycle_type, start_date, end_date, status) "
                + "VALUES (?, ?, 'IT chuỗi duyệt 2099', 'SEMI_ANNUALLY', '2099-01-01'::timestamptz, '2099-06-30 23:59:59+07'::timestamptz, 'OPEN')",
                cycleId, orgId);
        periodId = UUID.randomUUID();
        jdbc.update("INSERT INTO kpi_periods (id, organization_id, kpi_cycle_id, name, period_type, start_date, end_date) "
                + "VALUES (?, ?, ?, 'IT đợt 2099', 'QUARTERLY', '2099-01-01'::timestamptz, '2099-03-31 23:59:59+07'::timestamptz)",
                periodId, orgId, cycleId);
        kpiId = UUID.randomUUID();
        jdbc.update("INSERT INTO kpi_criteria (id, org_unit_id, kpi_period_id, name, frequency, status, created_by, weight) "
                + "VALUES (?, ?, ?, 'IT KPI chuỗi duyệt', 'QUARTERLY', 'PENDING_APPROVAL', ?, 100)", kpiId, unitId, periodId, requester);
        jdbc.update("INSERT INTO quantitative_kpi_details (kpi_criteria_id, target_value, is_reverse_kpi) VALUES (?, 10, false)", kpiId);

        // Chuỗi 2 bước: bước 1 giữ bởi NHÓM (A, B) — để hai người cùng bấm; bước 2 là C.
        flowId = UUID.randomUUID();
        jdbc.update("INSERT INTO kpi_approval_flows (id, organization_id, subject_type, kpi_criteria_id, requester_id, current_step_order) "
                + "VALUES (?, ?, 'CRITERIA', ?, ?, 1)", flowId, orgId, kpiId, requester);
        step1 = insertStep(1, "PENDING", approverA, approverB);
        step2 = insertStep(2, "WAITING", approverC);

        when(permissionChecker.hasRolePermissionInOrgUnit(any(), any(), any())).thenReturn(false);
        when(permissionChecker.isGlobalAdminIn(any(), any())).thenReturn(false);
    }

    private UUID insertStep(int order, String status, UUID... approvers) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO kpi_approval_steps (id, flow_id, step_order, org_unit_id, org_unit_name, status, pending_since) "
                + "VALUES (?, ?, ?, ?, 'IT đơn vị', ?, now())", id, flowId, order, unitId, status);
        for (UUID a : approvers) {
            jdbc.update("INSERT INTO kpi_approval_step_approvers (step_id, user_id, user_name) VALUES (?, ?, 'IT')", id, a);
        }
        return id;
    }

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
        pool.shutdownNow();
        // Mỗi sự kiện duyệt ghi thêm một dòng hệ thống vào khung thảo luận của KPI.
        jdbc.update("DELETE FROM discussion_comments WHERE target_id = ?", kpiId);
        jdbc.update("DELETE FROM kpi_approval_flows WHERE kpi_criteria_id = ?", kpiId);
        jdbc.update("DELETE FROM quantitative_kpi_details WHERE kpi_criteria_id = ?", kpiId);
        jdbc.update("DELETE FROM kpi_criteria WHERE id = ?", kpiId);
        jdbc.update("DELETE FROM kpi_periods WHERE id = ?", periodId);
        jdbc.update("DELETE FROM kpi_cycles WHERE id = ?", cycleId);
    }

    private User user(UUID id) {
        return userRepository.findById(id).orElseThrow();
    }

    private void loginAs(UUID userId) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user(userId).getEmail(), "x", List.of()));
    }

    private Set<UUID> inbox(UUID userId) {
        return new HashSet<>(flowRepository.findInbox(userId, ApprovalSubjectType.CRITERIA).stream().map(f -> f.getId()).toList());
    }

    @Test
    @DisplayName("Test 1 (truy vấn thật): cấp trên chỉ thấy KPI trong hộp chờ sau khi cấp dưới duyệt")
    void inboxShowsOnlyCurrentHolder() {
        assertThat(inbox(approverA)).contains(flowId);
        assertThat(inbox(approverB)).contains(flowId);
        assertThat(inbox(approverC)).doesNotContain(flowId);

        User a = user(approverA);
        tx.executeWithoutResult(s -> chainService.approve(chainService.authorize(flowId, a, step1), a, null));

        assertThat(inbox(approverA)).doesNotContain(flowId);
        assertThat(inbox(approverC)).contains(flowId);
    }

    @Test
    @DisplayName("Test 10: hai người cùng giữ bước bấm duyệt cùng lúc ⇒ đúng một người thành công, người kia 409")
    void concurrentApproval() throws Exception {
        User a = user(approverA), b = user(approverB);
        CountDownLatch firstLocked = new CountDownLatch(1), releaseFirst = new CountDownLatch(1);

        Future<Object> first = pool.submit(() -> {
            try {
                tx.executeWithoutResult(s -> {
                    var d = chainService.authorize(flowId, a, step1);
                    firstLocked.countDown();
                    await(releaseFirst);
                    chainService.approve(d, a, null);
                });
                return "ok";
            } catch (Exception e) {
                return e;
            }
        });
        assertThat(firstLocked.await(10, TimeUnit.SECONDS)).isTrue();

        Future<Object> second = pool.submit(() -> {
            try {
                tx.executeWithoutResult(s -> chainService.approve(chainService.authorize(flowId, b, step1), b, null));
                return "ok";
            } catch (Exception e) {
                return e;
            }
        });
        // Người thứ hai phải CHỜ khoá của người thứ nhất, không được đọc song song.
        assertThatThrownBy(() -> second.get(700, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
        releaseFirst.countDown();

        assertThat(first.get(10, TimeUnit.SECONDS)).isEqualTo("ok");
        assertThat(second.get(10, TimeUnit.SECONDS)).isInstanceOf(StaleStateException.class);

        assertThat(jdbc.queryForObject("SELECT status FROM kpi_approval_steps WHERE id = ?", String.class, step1))
                .isEqualTo("APPROVED_FORWARDED");
        assertThat(jdbc.queryForObject("SELECT acted_by_id FROM kpi_approval_steps WHERE id = ?", UUID.class, step1))
                .isEqualTo(approverA);
        assertThat(jdbc.queryForObject("SELECT status FROM kpi_approval_steps WHERE id = ?", String.class, step2))
                .isEqualTo("PENDING");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM kpi_approval_events WHERE flow_id = ? AND action = 'APPROVED_FORWARD'",
                Integer.class, flowId)).isEqualTo(1);
    }

    @Test
    @DisplayName("Test 8: kỳ đã khoá ⇒ không duyệt, không từ chối, không gán lại được")
    void lockedCycleBlocksEverything() {
        jdbc.update("UPDATE kpi_cycles SET status = 'LOCKED' WHERE id = ?", cycleId);
        loginAs(approverA);

        assertThatThrownBy(() -> kpiCriteriaService.approveKpiWithOutcome(kpiId,
                ApproveKpiRequest.builder().expectedStepId(step1).build()))
                .isInstanceOf(BusinessException.class).extracting("errorCode").isIn(ErrorCode.CYCLE_LOCKED, ErrorCode.CYCLE_LOCKED_2, ErrorCode.KPI_CLOSED_CYCLE_LOCK, ErrorCode.PERIOD_CLOSED_WHEN_CYCLE_LOCKED);
        assertThatThrownBy(() -> kpiCriteriaService.rejectKpi(kpiId,
                RejectKpiRequest.builder().reason("x").expectedStepId(step1).build()))
                .isInstanceOf(BusinessException.class).extracting("errorCode").isIn(ErrorCode.CYCLE_LOCKED, ErrorCode.CYCLE_LOCKED_2, ErrorCode.KPI_CLOSED_CYCLE_LOCK, ErrorCode.PERIOD_CLOSED_WHEN_CYCLE_LOCKED);

        when(permissionChecker.isGlobalAdminIn(any(), any())).thenReturn(true);
        User admin = user(approverC);
        assertThatThrownBy(() -> chainService.reassign(step1, admin, approverB, "x"))
                .isInstanceOf(BusinessException.class).extracting("errorCode").isIn(ErrorCode.CYCLE_LOCKED, ErrorCode.CYCLE_LOCKED_2, ErrorCode.KPI_CLOSED_CYCLE_LOCK, ErrorCode.PERIOD_CLOSED_WHEN_CYCLE_LOCKED);

        assertThat(jdbc.queryForObject("SELECT status FROM kpi_approval_steps WHERE id = ?", String.class, step1))
                .isEqualTo("PENDING");
    }

    private static void await(CountDownLatch latch) {
        try {
            latch.await(10, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
