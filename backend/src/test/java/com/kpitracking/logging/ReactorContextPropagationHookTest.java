package com.kpitracking.logging;

import io.micrometer.context.ContextRegistry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.slf4j.MDC;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Hooks;
import reactor.core.scheduler.Schedulers;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code Hooks.enableAutomaticContextPropagation()} là state TOÀN CỤC của reactor — test này bật/tắt nó,
 * nên phải chạy cô lập (@Isolated) và khôi phục đúng state ban đầu, không giả định mặc định là "tắt"
 * (ReactorContextPropagationConfig có thể đã bật trong context Spring của test khác).
 * Surefire của dự án hiện chạy tuần tự (không parallel, forkCount mặc định) — nếu đổi sang song song,
 * @Isolated vẫn giữ test này không chạy đồng thời với test khác.
 */
@Isolated
class ReactorContextPropagationHookTest {

    private boolean hookWasEnabled;

    @BeforeEach
    void saveState() {
        ContextRegistry.getInstance().registerThreadLocalAccessor(new MdcThreadLocalAccessor());
        // reactor-core không có getter cho hook -> dò bằng chính hành vi: MDC có theo sang thread parallel không.
        MDC.put(MdcKeys.REQUEST_ID, "probe");
        hookWasEnabled = "probe".equals(mdcSeenOnParallelThread());
        MDC.clear();
    }

    @AfterEach
    void restoreState() {
        if (hookWasEnabled) {
            Hooks.enableAutomaticContextPropagation();
        } else {
            Hooks.disableAutomaticContextPropagation();
        }
        MDC.clear();
    }

    private static String mdcSeenOnParallelThread() {
        return Flux.just(1)
                .publishOn(Schedulers.parallel())
                .map(i -> String.valueOf(MDC.get(MdcKeys.REQUEST_ID)))
                .blockLast(Duration.ofSeconds(5));
    }

    @Test
    @DisplayName("Hook TẮT: thread parallel của reactor không thấy MDC (test âm chứng minh hook có tác dụng)")
    void withoutHook_mdcIsLost() {
        Hooks.disableAutomaticContextPropagation();
        MDC.put(MdcKeys.REQUEST_ID, "req-neg");
        assertThat(mdcSeenOnParallelThread()).isEqualTo("null");
    }

    @Test
    @DisplayName("Hook BẬT + MdcThreadLocalAccessor: thread parallel thấy đúng requestId")
    void withHook_mdcFollowsTheStream() {
        Hooks.enableAutomaticContextPropagation();
        MDC.put(MdcKeys.REQUEST_ID, "req-pos");
        assertThat(mdcSeenOnParallelThread()).isEqualTo("req-pos");
    }
}
