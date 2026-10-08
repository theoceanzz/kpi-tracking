package com.kpitracking.security.audit;

import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Cảnh báo sớm khi MỘT người dùng ăn 403 dồn dập.
 *
 * <p>Người dùng bình thường gần như không bao giờ chạm 403: giao diện chỉ hiện thứ họ được làm. Nhiều 403 liên
 * tiếp từ một người gần như luôn là frontend gọi API vượt quyền (lỗi prod 2026-10-06: nhân viên mở "Tự đánh
 * giá" gọi {@code GET /submissions} và cây đơn vị, ~30 lần 403 trong 36 giây mà không ai biết cho tới khi người
 * dùng báo) — hoặc ai đó dò id (IDOR). Cả hai đều cần người xem NGAY.
 *
 * <p>Đếm theo cửa sổ trượt; chạm ngưỡng thì:
 * <ul>
 *   <li>một dòng log mức ERROR mang nhãn cố định {@code ALERT FORBIDDEN_BURST} — gắn cảnh báo theo log vào nhãn này;</li>
 *   <li>một dòng {@link SecurityAuditEvent#FORBIDDEN_BURST} trong {@code security_audit_logs} (kèm endpoint);</li>
 *   <li>tăng metric {@code security.forbidden.burst} (Actuator/Micrometer).</li>
 * </ul>
 * Mỗi người cảnh báo tối đa một lần trong {@code cooldown} để chính cảnh báo không thành spam. Chỉ giữ trong
 * bộ nhớ một instance — đủ để phát hiện (mỗi người thường dính một instance), không phải số liệu thống kê.
 */
@Slf4j
@Component
public class ForbiddenBurstDetector {

    /** id trong đường dẫn (UUID hoặc số) gộp về {id} để "cùng một endpoint" đếm chung. */
    private static final Pattern ID_SEGMENT = Pattern.compile(
            "/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|\\d+)(?=/|$)");

    private final int threshold;
    private final long windowMillis;
    private final long cooldownMillis;
    private final Clock clock;
    private final Optional<MeterRegistry> meters;

    private final Map<String, UserWindow> windows = new ConcurrentHashMap<>();

    /** Một lần 403: thời điểm + endpoint đã chuẩn hoá. */
    private record Hit(long at, String endpoint) {}

    private static final class UserWindow {
        final Deque<Hit> hits = new ArrayDeque<>();
        long lastAlertAt = Long.MIN_VALUE;
    }

    /** Kết quả khi chạm ngưỡng — để ghi audit; {@code null} = chưa chạm / đang trong thời gian chờ. */
    public record Burst(String user, int count, long windowSeconds, String endpoints) {}

    /** Constructor Spring dùng (có hai constructor nên phải chỉ rõ — thiếu là app không khởi động được). */
    @Autowired
    public ForbiddenBurstDetector(
            @Value("${app.security.forbidden-burst.threshold:10}") int threshold,
            @Value("${app.security.forbidden-burst.window-seconds:60}") long windowSeconds,
            @Value("${app.security.forbidden-burst.cooldown-seconds:600}") long cooldownSeconds,
            ObjectProvider<MeterRegistry> meters) {
        this(threshold, windowSeconds, cooldownSeconds, Clock.systemUTC(), Optional.ofNullable(meters.getIfAvailable()));
    }

    ForbiddenBurstDetector(int threshold, long windowSeconds, long cooldownSeconds, Clock clock, Optional<MeterRegistry> meters) {
        this.threshold = Math.max(1, threshold);
        this.windowMillis = windowSeconds * 1000;
        this.cooldownMillis = cooldownSeconds * 1000;
        this.clock = clock;
        this.meters = meters;
    }

    static String normalize(String target) {
        if (target == null || target.isBlank()) return "(unknown)";
        String noQuery = target.split("\\?", 2)[0];
        return ID_SEGMENT.matcher(noQuery).replaceAll("/{id}");
    }

    /**
     * Ghi nhận một lần 403 của {@code user} vào {@code target} ("GET /api/v1/..."). Trả {@link Burst} đúng lần
     * chạm ngưỡng (đã log ERROR + tăng metric); người gọi tự ghi audit.
     */
    public Burst record(String user, String target) {
        if (user == null || user.isBlank()) return null; // ẩn danh: 401 là việc của rate limit, không phải ở đây
        meters.ifPresent(m -> m.counter("security.forbidden").increment());
        long now = clock.millis();
        UserWindow w = windows.computeIfAbsent(user, k -> new UserWindow());
        synchronized (w) {
            w.hits.addLast(new Hit(now, normalize(target)));
            while (!w.hits.isEmpty() && w.hits.peekFirst().at() <= now - windowMillis) w.hits.removeFirst();
            if (w.hits.size() < threshold) return null;
            if (w.lastAlertAt != Long.MIN_VALUE && now - w.lastAlertAt < cooldownMillis) return null;
            w.lastAlertAt = now;

            Map<String, Long> byEndpoint = w.hits.stream().collect(
                    Collectors.groupingBy(Hit::endpoint, LinkedHashMap::new, Collectors.counting()));
            String endpoints = byEndpoint.entrySet().stream()
                    .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                    .map(e -> e.getKey() + " x" + e.getValue())
                    .collect(Collectors.joining(", "));
            Burst burst = new Burst(user, w.hits.size(), windowMillis / 1000, endpoints);
            log.error("ALERT FORBIDDEN_BURST user={} count={} windowSeconds={} endpoints=[{}] — thường là frontend gọi API "
                    + "vượt quyền của người dùng (hoặc dò id). Xem security_audit_logs event=ACCESS_DENIED của người này.",
                    SecurityAuditService.maskEmail(burst.user()), burst.count(), burst.windowSeconds(), burst.endpoints());
            meters.ifPresent(m -> m.counter("security.forbidden.burst").increment());
            return burst;
        }
    }

    /** Dọn người đã im lặng quá cửa sổ + thời gian chờ — map không phình theo số người từng dính 403. */
    @Scheduled(fixedDelay = 300_000)
    public void evictIdle() {
        long cutoff = clock.millis() - windowMillis - cooldownMillis;
        windows.entrySet().removeIf(e -> {
            synchronized (e.getValue()) {
                Hit last = e.getValue().hits.peekLast();
                return last == null || last.at() < cutoff;
            }
        });
    }

    int trackedUsers() {
        return windows.size();
    }
}
