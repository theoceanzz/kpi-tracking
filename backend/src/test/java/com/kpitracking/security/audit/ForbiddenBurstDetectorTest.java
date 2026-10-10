package com.kpitracking.security.audit;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/** Cảnh báo 403 dồn dập: ngưỡng 10 lần / 60s, chờ 600s giữa hai lần cảnh báo cùng một người. */
class ForbiddenBurstDetectorTest {

    /** Đồng hồ chỉnh tay được. */
    private static final class MutableClock extends Clock {
        long now = Instant.parse("2026-10-06T15:22:47Z").toEpochMilli();
        void plusSeconds(long s) { now += s * 1000; }
        @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public long millis() { return now; }
        @Override public Instant instant() { return Instant.ofEpochMilli(now); }
    }

    private MutableClock clock;
    private SimpleMeterRegistry meters;
    private ForbiddenBurstDetector detector;

    @BeforeEach
    void setUp() {
        clock = new MutableClock();
        meters = new SimpleMeterRegistry();
        detector = new ForbiddenBurstDetector(10, 60, 600, clock, Optional.of(meters));
    }

    private ForbiddenBurstDetector.Burst hit(String user, String target) {
        clock.plusSeconds(1);
        return detector.record(user, target);
    }

    @Test
    void underThreshold_noAlert() {
        for (int i = 0; i < 9; i++) assertThat(hit("nv@co.vn", "GET /api/v1/submissions")).isNull();
        assertThat(meters.counter("security.forbidden").count()).isEqualTo(9);
        assertThat(meters.counter("security.forbidden.burst").count()).isZero();
    }

    @Test
    void reachingThreshold_alertsOnce_withEndpointsSortedByCount() {
        ForbiddenBurstDetector.Burst burst = null;
        for (int i = 0; i < 7; i++) burst = hit("nv@co.vn", "GET /api/v1/organizations/61c12dc0-17de-4eed-b01a-c1c79b9e9670/units/tree");
        for (int i = 0; i < 3; i++) burst = hit("nv@co.vn", "GET /api/v1/submissions?page=0");

        assertThat(burst).isNotNull();
        assertThat(burst.count()).isEqualTo(10);
        assertThat(burst.endpoints())
                .isEqualTo("GET /api/v1/organizations/{id}/units/tree x7, GET /api/v1/submissions x3");
        assertThat(meters.counter("security.forbidden.burst").count()).isEqualTo(1);
    }

    @Test
    void duringCooldown_noRepeatedAlert_afterCooldown_alertsAgain() {
        for (int i = 0; i < 10; i++) hit("nv@co.vn", "GET /api/v1/submissions");
        for (int i = 0; i < 30; i++) assertThat(hit("nv@co.vn", "GET /api/v1/submissions")).isNull();

        clock.plusSeconds(600);
        ForbiddenBurstDetector.Burst again = null;
        for (int i = 0; i < 10; i++) again = hit("nv@co.vn", "GET /api/v1/submissions");
        assertThat(again).isNotNull();
        assertThat(meters.counter("security.forbidden.burst").count()).isEqualTo(2);
    }

    @Test
    void slowTrickle_outsideWindow_neverAlerts() {
        for (int i = 0; i < 30; i++) {
            clock.plusSeconds(10); // 1 lần / 11s ⇒ tối đa 6 lần trong cửa sổ 60s
            assertThat(detector.record("nv@co.vn", "GET /api/v1/users")).isNull();
        }
    }

    @Test
    void countsArePerUser() {
        for (int i = 0; i < 5; i++) {
            assertThat(hit("a@co.vn", "GET /api/v1/users")).isNull();
            assertThat(hit("b@co.vn", "GET /api/v1/users")).isNull();
        }
    }

    @Test
    void anonymous_isIgnored() {
        for (int i = 0; i < 20; i++) assertThat(hit(null, "GET /api/v1/users")).isNull();
        assertThat(detector.trackedUsers()).isZero();
    }

    @Test
    void normalize_collapsesIdsAndQuery() {
        assertThat(ForbiddenBurstDetector.normalize("GET /api/v1/kpi/123/tasks/4f88a5f0-cc9f-4601-ba11-4db143a8d24f?x=1"))
                .isEqualTo("GET /api/v1/kpi/{id}/tasks/{id}");
        assertThat(ForbiddenBurstDetector.normalize(null)).isEqualTo("(unknown)");
    }

    @Test
    void evictIdle_dropsQuietUsers() {
        hit("nv@co.vn", "GET /api/v1/users");
        assertThat(detector.trackedUsers()).isEqualTo(1);
        clock.plusSeconds(60 + 600 + 1);
        detector.evictIdle();
        assertThat(detector.trackedUsers()).isZero();
    }
}
