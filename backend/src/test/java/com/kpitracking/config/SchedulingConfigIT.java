package com.kpitracking.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Job {@code @Scheduled} phải chạy trên pool riêng {@code app-sched-*}, KHÔNG trên luồng của WebSocket broker
 * ({@code MessageBroker-*}) như log prod 2026-10-06 — và broker vẫn giữ scheduler của chính nó.
 * Cần DB local (khởi động app thật). Chạy tay: {@code ./mvnw test -Dtest=SchedulingConfigIT}.
 */
@SpringBootTest
class SchedulingConfigIT {

    static final Set<String> THREADS = ConcurrentHashMap.newKeySet();
    static final CountDownLatch RAN = new CountDownLatch(3);

    @TestConfiguration
    static class ProbeJob {
        @Bean
        Probe probe() { return new Probe(); }
    }

    static class Probe {
        @Scheduled(fixedDelay = 50)
        public void tick() {
            THREADS.add(Thread.currentThread().getName());
            RAN.countDown();
        }
    }

    @Autowired ApplicationContext context;

    @Test
    void scheduledJobs_runOnAppSchedPool_notOnBrokerThreads() throws Exception {
        assertThat(RAN.await(10, TimeUnit.SECONDS)).as("job thử phải chạy").isTrue();
        assertThat(THREADS).isNotEmpty()
                .allSatisfy(t -> assertThat(t).startsWith(SchedulingConfig.THREAD_PREFIX))
                .noneSatisfy(t -> assertThat(t).startsWith("MessageBroker"));
    }

    @Test
    void brokerKeepsItsOwnScheduler() {
        assertThat(context.containsBean("messageBrokerTaskScheduler")).isTrue();
        assertThat(context.getBean("appTaskScheduler", ThreadPoolTaskScheduler.class))
                .isNotSameAs(context.getBean("messageBrokerTaskScheduler"));
    }
}
