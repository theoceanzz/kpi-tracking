package com.kpitracking.security;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Bộ đếm cửa sổ cố định trong bộ nhớ, dùng chung cho rate limit theo IP và khoá đăng nhập theo email.
 *
 * <p>Không phụ thuộc thư viện ngoài. Mỗi khoá giữ một cửa sổ {@code (bắt đầu, số lần)}; hết cửa sổ
 * thì đếm lại từ đầu. Bản đồ được dọn định kỳ để không phình vô hạn khi bị quét IP.
 */
public class SlidingWindowCounter {

    private static final class Window {
        final Instant startedAt;
        final AtomicInteger hits = new AtomicInteger();

        Window(Instant startedAt) {
            this.startedAt = startedAt;
        }
    }

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final Duration windowLength;
    private volatile Instant lastSweep = Instant.now();

    public SlidingWindowCounter(Duration windowLength) {
        this.windowLength = windowLength;
    }

    /** Ghi nhận một lượt và trả về số lượt trong cửa sổ hiện tại (kể cả lượt này). */
    public int increment(String key) {
        Instant now = Instant.now();
        sweepIfDue(now);
        Window w = windows.compute(key, (k, existing) ->
                existing == null || existing.startedAt.plus(windowLength).isBefore(now)
                        ? new Window(now)
                        : existing);
        return w.hits.incrementAndGet();
    }

    /** Số lượt hiện có trong cửa sổ, không ghi nhận thêm. */
    public int current(String key) {
        Window w = windows.get(key);
        if (w == null || w.startedAt.plus(windowLength).isBefore(Instant.now())) {
            return 0;
        }
        return w.hits.get();
    }

    /** Số giây còn lại tới khi cửa sổ của khoá này hết hạn (0 nếu không có cửa sổ). */
    public long secondsUntilReset(String key) {
        Window w = windows.get(key);
        if (w == null) return 0;
        long remaining = Duration.between(Instant.now(), w.startedAt.plus(windowLength)).getSeconds();
        return Math.max(remaining, 0);
    }

    public void reset(String key) {
        windows.remove(key);
    }

    private void sweepIfDue(Instant now) {
        // Dọn tối đa một lần mỗi cửa sổ, tránh khoá bản đồ liên tục dưới tải cao.
        if (lastSweep.plus(windowLength).isAfter(now)) return;
        lastSweep = now;
        windows.entrySet().removeIf(e -> e.getValue().startedAt.plus(windowLength).isBefore(now));
    }
}
