package com.kpitracking.service;

import com.kpitracking.exception.AiRateLimitException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Giới hạn tần suất gọi AI theo TỪNG user (cửa sổ cố định /phút + /ngày), in-memory.
 * Đây là chốt DETERMINISTIC ở server: dù prompt injection/jailbreak có làm model trả lời
 * lạc đề thì cũng không thể vượt giới hạn số request (không phải prompt nên không jailbreak được).
 * App chạy 1 instance backend ⇒ in-memory là đủ (không cần Redis).
 */
@Component
public class AiRateLimiter {

    private static final long MINUTE_MS = 60_000L;
    private static final long DAY_MS = 86_400_000L;

    private final int perMinute;
    private final int perDay;
    private final Map<String, Window> minute = new ConcurrentHashMap<>();
    private final Map<String, Window> day = new ConcurrentHashMap<>();

    public AiRateLimiter(@Value("${app.rate-limit.ai-per-minute:15}") int perMinute,
                         @Value("${app.rate-limit.ai-per-day:200}") int perDay) {
        this.perMinute = perMinute;
        this.perDay = perDay;
    }

    /** Tăng bộ đếm và ném {@link AiRateLimitException} nếu vượt giới hạn phút hoặc ngày. */
    public void check(String userKey) {
        if (userKey == null || userKey.isBlank()) return;
        long now = System.currentTimeMillis();
        if (!allow(minute, userKey, MINUTE_MS, perMinute, now)) {
            throw new AiRateLimitException("Bạn gửi yêu cầu AI quá nhanh. Vui lòng thử lại sau ít phút.");
        }
        if (!allow(day, userKey, DAY_MS, perDay, now)) {
            throw new AiRateLimitException("Bạn đã đạt giới hạn số yêu cầu AI trong ngày. Vui lòng thử lại vào ngày mai.");
        }
    }

    private boolean allow(Map<String, Window> map, String key, long windowMs, int limit, long now) {
        Window w = map.computeIfAbsent(key, k -> new Window(now));
        synchronized (w) {
            if (now - w.start >= windowMs) { // hết cửa sổ -> reset
                w.start = now;
                w.count = 0;
            }
            if (w.count >= limit) return false;
            w.count++;
            return true;
        }
    }

    private static final class Window {
        long start;
        int count;
        Window(long start) { this.start = start; }
    }
}
