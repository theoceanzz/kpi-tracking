package com.kpitracking.config;

import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.SchedulingConfigurer;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.config.ScheduledTaskRegistrar;

/**
 * Bộ lập lịch RIÊNG cho {@code @Scheduled}.
 *
 * <p>Có WebSocket message broker thì Spring Boot không tự tạo scheduler cho {@code @Scheduled} nữa mà dùng luôn
 * scheduler của broker ({@code MessageBroker-*}, 2 luồng). Log prod cho thấy mọi job chạy trên
 * {@code MessageBroker-1/2}; job nhắc hạn chạy 7–9s là chiếm một nửa luồng của broker — heartbeat và thông báo
 * realtime bị trễ theo. Tách ra pool riêng, tên luồng {@code app-sched-*} để log nhận ra ngay.
 *
 * <p>Là một bean có tên riêng (không phải bean {@code TaskScheduler} "chính") để không chen vào chỗ WebSocket
 * tự chọn scheduler của nó, và để Spring tắt nó đúng cách lúc dừng app (chờ job đang chạy dở).
 */
@Configuration
public class SchedulingConfig implements SchedulingConfigurer {

    public static final String THREAD_PREFIX = "app-sched-";

    private final ThreadPoolTaskScheduler appTaskScheduler;

    public SchedulingConfig(@Value("${app.scheduling.pool-size:4}") int poolSize) {
        this.appTaskScheduler = newScheduler(poolSize);
    }

    static ThreadPoolTaskScheduler newScheduler(int poolSize) {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(Math.max(1, poolSize));
        scheduler.setThreadNamePrefix(THREAD_PREFIX);
        // Tắt máy: chờ job đang chạy dở tối đa 30s thay vì cắt ngang giữa lúc đang ghi DB.
        scheduler.setWaitForTasksToCompleteOnShutdown(true);
        scheduler.setAwaitTerminationSeconds(30);
        // ...nhưng KHÔNG chờ các lượt đã hẹn giờ mà chưa tới (cron của Spring là tác vụ trễ một lần, tự hẹn lại):
        // mặc định của JDK vẫn chạy chúng sau shutdown, nên tắt app luôn treo đủ 30s chờ lượt cron kế tiếp.
        scheduler.setExecuteExistingDelayedTasksAfterShutdownPolicy(false);
        scheduler.setRemoveOnCancelPolicy(true);
        scheduler.setErrorHandler(t -> LoggerFactory.getLogger(SchedulingConfig.class)
                .error("Job định kỳ ném lỗi chưa bắt: {}", t.toString(), t));
        return scheduler;
    }

    /** Đăng ký làm bean để Spring gọi initialize()/shutdown() theo vòng đời context. */
    @Bean(name = "appTaskScheduler")
    public ThreadPoolTaskScheduler appTaskScheduler() {
        return appTaskScheduler;
    }

    @Override
    public void configureTasks(ScheduledTaskRegistrar registrar) {
        registrar.setTaskScheduler(appTaskScheduler);
    }
}
