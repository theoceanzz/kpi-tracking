package com.kpitracking.logging;

import org.slf4j.MDC;

import java.util.Map;
import java.util.concurrent.Executor;

/**
 * Bọc một {@link Executor} để task chạy ở thread khác vẫn mang MDC của thread submit.
 *
 * <p>Capture {@code MDC.getCopyOfContextMap()} lúc submit, đặt lại trong task, và {@code MDC.clear()} ở
 * {@code finally} — thread pool tái dùng, không dọn là task sau kế thừa nhầm requestId của task trước.
 */
public final class MdcPropagatingExecutor implements Executor {

    private final Executor delegate;

    public MdcPropagatingExecutor(Executor delegate) {
        this.delegate = delegate;
    }

    @Override
    public void execute(Runnable task) {
        delegate.execute(wrap(task));
    }

    /** Dùng chung cho TaskDecorator của @Async và cho executor streaming. */
    public static Runnable wrap(Runnable task) {
        Map<String, String> context = MDC.getCopyOfContextMap();
        return () -> {
            Map<String, String> previous = MDC.getCopyOfContextMap();
            if (context != null) {
                MDC.setContextMap(context);
            } else {
                MDC.clear();
            }
            try {
                task.run();
            } finally {
                if (previous != null) {
                    MDC.setContextMap(previous);
                } else {
                    MDC.clear();
                }
            }
        };
    }
}
