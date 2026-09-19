package com.kpitracking.logging;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.core.task.TaskDecorator;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** MDC phải đi theo task sang thread khác (streamExecutor của AI, @Async) và không rò sang task sau. */
class MdcPropagationTest {

    private ExecutorService pool;

    @BeforeEach
    void setUp() {
        pool = Executors.newSingleThreadExecutor();   // 1 thread để chắc chắn task sau tái dùng thread trước
        MDC.clear();
    }

    @AfterEach
    void tearDown() {
        pool.shutdownNow();
        MDC.clear();
    }

    @Test
    @DisplayName("MdcPropagatingExecutor: task đọc đúng requestId của thread submit; xong thì thread sạch")
    void executorPropagatesAndCleans() throws Exception {
        MdcPropagatingExecutor executor = new MdcPropagatingExecutor(pool);

        MDC.put(MdcKeys.REQUEST_ID, "req-1");
        CompletableFuture<String> inTask = new CompletableFuture<>();
        executor.execute(() -> inTask.complete(MDC.get(MdcKeys.REQUEST_ID)));
        assertThat(inTask.get(2, TimeUnit.SECONDS)).isEqualTo("req-1");

        // Task thứ hai submit KHÔNG có MDC: phải thấy null, không kế thừa "req-1" từ thread pool.
        MDC.clear();
        CompletableFuture<String> leak = new CompletableFuture<>();
        executor.execute(() -> leak.complete(String.valueOf(MDC.get(MdcKeys.REQUEST_ID))));
        assertThat(leak.get(2, TimeUnit.SECONDS)).isEqualTo("null");
    }

    @Test
    @DisplayName("MdcTaskDecorator (dùng cho @Async) hoạt động như executor")
    void taskDecoratorPropagates() throws Exception {
        TaskDecorator decorator = new MdcTaskDecorator();
        MDC.put(MdcKeys.REQUEST_ID, "req-async");
        CompletableFuture<String> seen = new CompletableFuture<>();
        Runnable decorated = decorator.decorate(() -> seen.complete(MDC.get(MdcKeys.REQUEST_ID)));
        MDC.clear();                                   // submit xong, thread gốc đã đổi ngữ cảnh
        pool.execute(decorated);
        assertThat(seen.get(2, TimeUnit.SECONDS)).isEqualTo("req-async");
    }
}
