package com.kpitracking.config;

import com.kpitracking.logging.MdcThreadLocalAccessor;
import io.micrometer.context.ContextRegistry;
import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Configuration;
import reactor.core.publisher.Hooks;

/**
 * Bật propagate MDC qua reactor (Spring AI {@code chatModel.stream()} chạy trên reactor-netty).
 *
 * <p>{@code Hooks.enableAutomaticContextPropagation()} là cấu hình toàn cục của reactor; gọi một lần lúc
 * khởi động. {@link MdcThreadLocalAccessor} đăng ký idempotent (cùng key thì ghi đè).
 */
@Configuration
public class ReactorContextPropagationConfig {

    @PostConstruct
    void enable() {
        ContextRegistry.getInstance().registerThreadLocalAccessor(new MdcThreadLocalAccessor());
        Hooks.enableAutomaticContextPropagation();
    }
}
