package com.kpitracking.config;

import org.junit.jupiter.api.Test;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.support.CronTrigger;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;

/** Tắt app: chờ job ĐANG chạy xong, nhưng không ngồi chờ lượt cron kế tiếp (từng làm mỗi lần tắt treo đủ 30s). */
class SchedulingConfigTest {

    @Test
    void shutdown_doesNotWaitForNextCronFiring() {
        ThreadPoolTaskScheduler scheduler = SchedulingConfig.newScheduler(1);
        scheduler.initialize();
        scheduler.schedule(() -> { }, new CronTrigger("0 0 * * * *")); // lượt kế: tới đầu giờ sau

        long t = System.nanoTime();
        scheduler.shutdown();
        assertThat(Duration.ofNanos(System.nanoTime() - t)).isLessThan(Duration.ofSeconds(5));
    }

    @Test
    void shutdown_waitsForRunningJobToFinish() throws Exception {
        ThreadPoolTaskScheduler scheduler = SchedulingConfig.newScheduler(1);
        scheduler.initialize();
        CountDownLatch started = new CountDownLatch(1);
        AtomicBoolean finished = new AtomicBoolean();
        scheduler.schedule(() -> {
            started.countDown();
            try { Thread.sleep(500); } catch (InterruptedException e) { return; }
            finished.set(true);
        }, Instant.now());
        assertThat(started.await(5, TimeUnit.SECONDS)).isTrue();

        scheduler.shutdown();
        assertThat(finished).as("job đang chạy dở không bị cắt ngang").isTrue();
        assertThat(scheduler.getThreadNamePrefix()).isEqualTo(SchedulingConfig.THREAD_PREFIX);
    }
}
