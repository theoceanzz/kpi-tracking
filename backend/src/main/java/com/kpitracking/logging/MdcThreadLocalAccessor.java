package com.kpitracking.logging;

import io.micrometer.context.ThreadLocalAccessor;
import org.slf4j.MDC;

import java.util.Map;

/**
 * Cho reactor-core biết cách chụp/khôi phục MDC khi đổi thread (event-loop của reactor-netty trong
 * Spring AI streaming). Đăng ký ở {@code ReactorContextPropagationConfig}.
 */
public final class MdcThreadLocalAccessor implements ThreadLocalAccessor<Map<String, String>> {

    public static final String KEY = "keygo.mdc";

    @Override
    public Object key() {
        return KEY;
    }

    @Override
    public Map<String, String> getValue() {
        return MDC.getCopyOfContextMap();
    }

    @Override
    public void setValue(Map<String, String> value) {
        if (value == null) {
            MDC.clear();
        } else {
            MDC.setContextMap(value);
        }
    }

    @Override
    public void setValue() {
        MDC.clear();
    }
}
