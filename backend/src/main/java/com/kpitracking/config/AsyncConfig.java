package com.kpitracking.config;

import com.kpitracking.logging.MdcTaskDecorator;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Executor cho {@code @Async} (listener thông báo / BSC). Trước đây dùng executor mặc định của Spring;
 * khai riêng để gắn {@link MdcTaskDecorator} — log trong listener mang requestId của request gây ra sự kiện.
 *
 * <p>Kích thước: listener chủ yếu chờ DB/SMTP, 4 core / 16 max / hàng đợi 500 là đủ cho tải hiện tại
 * và có trần rõ ràng thay vì đẻ thread vô hạn.
 */
@Configuration
public class AsyncConfig implements AsyncConfigurer {

    @Override
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setThreadNamePrefix("async-");
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(16);
        executor.setQueueCapacity(500);
        executor.setTaskDecorator(new MdcTaskDecorator());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(20);
        executor.initialize();
        return executor;
    }

    /**
     * Luồng riêng cho AI đánh giá bài nộp. Mỗi lượt gọi mô hình nhiều lần và chạy hàng chục giây; dùng chung
     * pool @Async thì một lần chạy theo lô cả đơn vị chặn luôn thông báo và email. Hai luồng: đủ để lô chạy
     * dần, không dồn nhà cung cấp mô hình quá giới hạn tốc độ.
     */
    @org.springframework.context.annotation.Bean("aiReviewExecutor")
    public Executor aiReviewExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setThreadNamePrefix("ai-review-");
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(2);
        executor.setQueueCapacity(1000);
        executor.setTaskDecorator(new MdcTaskDecorator());
        executor.setWaitForTasksToCompleteOnShutdown(false);
        executor.initialize();
        return executor;
    }
}
