package com.kpitracking.service;

import com.kpitracking.exception.ErrorCode;
import com.kpitracking.dto.request.kpi.lock.LockCycleRequest;
import com.kpitracking.dto.request.kpi.lock.LockCycleRequest.PeriodDecision;
import com.kpitracking.enums.PeriodLockAction;
import com.kpitracking.event.KpiCycleLockNotificationListener;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.repository.KpiCycleRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.kpi.CycleStatusGuard;
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
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Khoá kỳ trên PostgreSQL THẬT — trường hợp 9 (đồng thời) và 11 (rollback toàn bộ).
 *
 * <p>Cần DB local đã chạy Flyway tới V18 (như {@code KpiTrackingApplicationTests}); tên kết thúc bằng
 * {@code IT} nên {@code mvn test} mặc định không chạy. Chạy tay:
 * {@code ./mvnw test -Dtest=CycleLockConcurrencyIT}. Dữ liệu tạo ra nằm ở năm 2099 và bị xoá sau mỗi test.
 */
@SpringBootTest
class CycleLockConcurrencyIT {

    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager txManager;
    @Autowired KpiCycleRepository cycles;
    @Autowired CycleStatusGuard guard;
    @Autowired KpiCycleLockService lockService;

    @MockBean PermissionChecker permissionChecker;
    /** Không phát chuông/email thật vào DB dev. */
    @MockBean KpiCycleLockNotificationListener notificationListener;

    private TransactionTemplate tx;
    private final ExecutorService pool = Executors.newFixedThreadPool(2);

    private UUID orgId, unitId, userId, cycleId, targetId, p1, p2, k1, k2;
    private String userEmail;

    @BeforeEach
    void fixture() {
        tx = new TransactionTemplate(txManager);
        Map<String, Object> row = jdbc.queryForMap("""
                SELECT uro.user_id, uro.org_unit_id, u.email, h.organization_id
                  FROM user_role_org_units uro
                  JOIN users u ON u.id = uro.user_id
                  JOIN org_units ou ON ou.id = uro.org_unit_id
                  JOIN org_hierarchy_levels h ON h.id = ou.org_hierarchy_id
                 LIMIT 1""");
        userId = (UUID) row.get("user_id");
        unitId = (UUID) row.get("org_unit_id");
        userEmail = (String) row.get("email");
        orgId = (UUID) row.get("organization_id");

        cycleId = insertCycle("IT khoá kỳ 2099", "2099-01-01", "2099-06-30", "OPEN");
        targetId = insertCycle("IT kỳ đích 2099", "2099-07-01", "2099-12-31", "OPEN");
        p1 = insertPeriod(cycleId, "IT đợt 1", "2099-01-01", "2099-03-31");
        p2 = insertPeriod(cycleId, "IT đợt 2", "2099-04-01", "2099-06-30");
        k1 = insertKpi(p1, "IT KPI 1");
        k2 = insertKpi(p2, "IT KPI 2");

        when(permissionChecker.hasPermissionInOrganization(any(), any(), any())).thenReturn(true);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(userEmail, "x", List.of()));
    }

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
        pool.shutdownNow();
        List<UUID> cs = List.of(cycleId, targetId);
        jdbc.update("DELETE FROM kpi_cycle_events WHERE kpi_cycle_id = ANY(?)", (Object) cs.toArray(new UUID[0]));
        jdbc.update("DELETE FROM quantitative_kpi_details WHERE kpi_criteria_id IN (?, ?)", k1, k2);
        jdbc.update("DELETE FROM kpi_criteria WHERE id IN (?, ?)", k1, k2);
        jdbc.update("UPDATE kpi_periods SET source_period_id = NULL WHERE kpi_cycle_id = ANY(?)", (Object) cs.toArray(new UUID[0]));
        jdbc.update("DELETE FROM kpi_periods WHERE kpi_cycle_id = ANY(?) OR id IN (?, ?)", cs.toArray(new UUID[0]), p1, p2);
        jdbc.update("DELETE FROM kpi_cycles WHERE id = ANY(?)", (Object) cs.toArray(new UUID[0]));
    }

    // ── fixture SQL ────────────────────────────────────────────────────────

    private UUID insertCycle(String name, String start, String end, String status) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO kpi_cycles (id, organization_id, name, cycle_type, start_date, end_date, status) "
                + "VALUES (?, ?, ?, 'SEMI_ANNUALLY', ?::timestamptz, ?::timestamptz, ?)", id, orgId, name, start, end + " 23:59:59+07", status);
        return id;
    }

    private UUID insertPeriod(UUID cycle, String name, String start, String end) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO kpi_periods (id, organization_id, kpi_cycle_id, name, period_type, start_date, end_date) "
                + "VALUES (?, ?, ?, ?, 'QUARTERLY', ?::timestamptz, ?::timestamptz)", id, orgId, cycle, name, start, end + " 23:59:59+07");
        return id;
    }

    private UUID insertKpi(UUID period, String name) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO kpi_criteria (id, org_unit_id, kpi_period_id, name, frequency, status, created_by, weight) "
                + "VALUES (?, ?, ?, ?, 'QUARTERLY', 'APPROVED', ?, 100)", id, unitId, period, name, userId);
        jdbc.update("INSERT INTO quantitative_kpi_details (kpi_criteria_id, target_value, is_reverse_kpi) VALUES (?, 10, false)", id);
        return id;
    }

    private String cycleStatus(UUID id) {
        return jdbc.queryForObject("SELECT status FROM kpi_cycles WHERE id = ?", String.class, id);
    }

    private static boolean stillRunning(Future<?> f) throws Exception {
        try {
            f.get(700, TimeUnit.MILLISECONDS);
            return false;
        } catch (TimeoutException e) {
            return true;
        }
    }

    // ── 9 ──────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("9a. Thao tác ghi lấy khoá trước ⇒ khoá kỳ phải CHỜ nó commit, và thấy dữ liệu của nó")
    void writerFirstMakesLockWait() throws Exception {
        CountDownLatch guardPassed = new CountDownLatch(1), release = new CountDownLatch(1);
        Future<?> writer = pool.submit(() -> tx.executeWithoutResult(s -> {
            guard.assertWritable(cycles.findById(cycleId).orElseThrow());
            jdbc.update("UPDATE kpi_criteria SET name = 'đã ghi trước khi khoá' WHERE id = ?", k1);
            guardPassed.countDown();
            await(release);
        }));
        assertThat(guardPassed.await(5, TimeUnit.SECONDS)).isTrue();

        AtomicReference<String> seenByLocker = new AtomicReference<>();
        Future<?> locker = pool.submit(() -> tx.executeWithoutResult(s -> {
            cycles.lockForUpdate(cycleId);
            seenByLocker.set(jdbc.queryForObject("SELECT name FROM kpi_criteria WHERE id = ?", String.class, k1));
            jdbc.update("UPDATE kpi_cycles SET status = 'LOCKED' WHERE id = ?", cycleId);
        }));

        assertThat(stillRunning(locker)).as("khoá kỳ phải chờ thao tác đang giữ FOR SHARE").isTrue();
        release.countDown();
        writer.get(5, TimeUnit.SECONDS);
        locker.get(5, TimeUnit.SECONDS);

        assertThat(seenByLocker.get()).isEqualTo("đã ghi trước khi khoá");
        assertThat(cycleStatus(cycleId)).isEqualTo("LOCKED");
    }

    @Test
    @DisplayName("9b. Khoá kỳ lấy khoá trước ⇒ thao tác ghi chờ, rồi bị từ chối — kể cả khi đã nạp kỳ (OPEN) từ trước")
    void lockFirstRejectsLateWriter() throws Exception {
        CountDownLatch writerLoaded = new CountDownLatch(1), lockerHolding = new CountDownLatch(1),
                releaseLocker = new CountDownLatch(1), goWriter = new CountDownLatch(1);

        AtomicReference<Throwable> writerError = new AtomicReference<>();
        Future<?> writer = pool.submit(() -> {
            try {
                tx.executeWithoutResult(s -> {
                    // Nạp kỳ khi còn OPEN — bản này nằm lại trong persistence context.
                    var stale = cycles.findById(cycleId).orElseThrow();
                    writerLoaded.countDown();
                    await(goWriter);
                    guard.assertWritable(stale);
                    jdbc.update("UPDATE kpi_criteria SET name = 'không được ghi' WHERE id = ?", k1);
                });
            } catch (Throwable t) {
                writerError.set(t);
            }
        });
        assertThat(writerLoaded.await(5, TimeUnit.SECONDS)).isTrue();

        Future<?> locker = pool.submit(() -> tx.executeWithoutResult(s -> {
            cycles.lockForUpdate(cycleId);
            jdbc.update("UPDATE kpi_cycles SET status = 'LOCKED' WHERE id = ?", cycleId);
            lockerHolding.countDown();
            await(releaseLocker);
        }));
        assertThat(lockerHolding.await(5, TimeUnit.SECONDS)).isTrue();

        goWriter.countDown();
        assertThat(stillRunning(writer)).as("thao tác ghi phải chờ thủ tục khoá").isTrue();
        releaseLocker.countDown();
        locker.get(5, TimeUnit.SECONDS);
        writer.get(5, TimeUnit.SECONDS);

        assertThat(writerError.get()).isInstanceOf(BusinessException.class).extracting("errorCode").isIn(ErrorCode.CYCLE_LOCKED, ErrorCode.CYCLE_LOCKED_2, ErrorCode.KPI_CLOSED_CYCLE_LOCK, ErrorCode.PERIOD_CLOSED_WHEN_CYCLE_LOCKED);
        assertThat(jdbc.queryForObject("SELECT name FROM kpi_criteria WHERE id = ?", String.class, k1)).isEqualTo("IT KPI 1");
    }

    // ── 11 ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("11. Đợt thứ hai lỗi khi khoá ⇒ rollback cả đợt thứ nhất đã chốt, kỳ vẫn mở, không có lịch sử")
    void failureRollsBackEverything() {
        String token = lockService.preview(cycleId).getPreviewToken();
        jdbc.update("UPDATE kpi_cycles SET status = 'LOCKED' WHERE id = ?", targetId); // kỳ đích bị khoá sau bước kiểm tra

        PeriodDecision close1 = PeriodDecision.builder().periodId(p1).action(PeriodLockAction.CLOSE).build();
        PeriodDecision move2 = PeriodDecision.builder().periodId(p2).action(PeriodLockAction.TRANSFER).targetCycleId(targetId)
                .newStartDate(java.time.Instant.parse("2099-07-01T00:00:00Z"))
                .newEndDate(java.time.Instant.parse("2099-09-30T00:00:00Z")).build();

        assertThatThrownBy(() -> lockService.lock(cycleId, LockCycleRequest.builder().previewToken(token)
                .decisions(new ArrayList<>(List.of(close1, move2))).build()))
                .isInstanceOf(BusinessException.class).extracting("errorCode").isIn(ErrorCode.CYCLE_LOCKED, ErrorCode.CYCLE_LOCKED_2, ErrorCode.KPI_CLOSED_CYCLE_LOCK, ErrorCode.PERIOD_CLOSED_WHEN_CYCLE_LOCKED);

        assertThat(cycleStatus(cycleId)).isEqualTo("OPEN");
        assertThat(jdbc.queryForObject("SELECT status FROM kpi_criteria WHERE id = ?", String.class, k1)).isEqualTo("APPROVED");
        assertThat(jdbc.queryForObject("SELECT status FROM kpi_periods WHERE id = ?", String.class, p1)).isEqualTo("ACTIVE");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM kpi_cycle_events WHERE kpi_cycle_id = ?", Long.class, cycleId)).isZero();
    }

    @Test
    @DisplayName("Khoá thật trên DB: chốt + chuyển nguyên đợt, ghi lịch sử, rồi mọi ghi vào kỳ bị chặn (8)")
    void lockPersistsAndBlocksWrites() {
        String token = lockService.preview(cycleId).getPreviewToken();
        PeriodDecision close1 = PeriodDecision.builder().periodId(p1).action(PeriodLockAction.CLOSE).build();
        PeriodDecision move2 = PeriodDecision.builder().periodId(p2).action(PeriodLockAction.TRANSFER).targetCycleId(targetId)
                .newStartDate(java.time.Instant.parse("2099-07-01T00:00:00Z"))
                .newEndDate(java.time.Instant.parse("2099-09-30T00:00:00Z")).build();

        var result = lockService.lock(cycleId, LockCycleRequest.builder().previewToken(token)
                .decisions(new ArrayList<>(List.of(close1, move2))).build());

        assertThat(result.getClosedKpis()).isEqualTo(1);
        assertThat(result.getTransferredPeriods()).isEqualTo(1);
        assertThat(cycleStatus(cycleId)).isEqualTo("LOCKED");
        assertThat(jdbc.queryForObject("SELECT status FROM kpi_criteria WHERE id = ?", String.class, k1)).isEqualTo("CLOSED_BY_LOCK");
        assertThat(jdbc.queryForObject("SELECT kpi_cycle_id FROM kpi_periods WHERE id = ?", UUID.class, p2)).isEqualTo(targetId);
        assertThat(jdbc.queryForObject("SELECT original_cycle_id FROM kpi_periods WHERE id = ?", UUID.class, p2)).isEqualTo(cycleId);
        assertThat(jdbc.queryForList("SELECT action FROM kpi_cycle_events WHERE kpi_cycle_id = ? ORDER BY action", String.class, cycleId))
                .containsExactly("LOCK", "PERIOD_CLOSE", "PERIOD_TRANSFER");
        assertThat(lockService.events(cycleId)).anyMatch(e -> targetId.equals(e.getTargetCycleId()));

        // Chuyển đợt vào/ghi vào kỳ đã khoá bị chặn ở guard.
        assertThatThrownBy(() -> tx.executeWithoutResult(s -> guard.assertWritable(cycles.findById(cycleId).orElseThrow())))
                .hasMessageContaining("IT khoá kỳ 2099").extracting("errorCode").isEqualTo(ErrorCode.CYCLE_LOCKED);
    }

    private static void await(CountDownLatch l) {
        try {
            if (!l.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("timeout");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }
}
