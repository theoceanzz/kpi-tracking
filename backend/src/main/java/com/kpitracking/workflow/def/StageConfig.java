package com.kpitracking.workflow.def;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.kpitracking.workflow.WorkflowStage;
import lombok.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Phần cấu hình được của một bước — đây là thứ nằm trong cột {@code definition} jsonb.
 *
 * <p>{@code options} để dạng Map mở có chủ đích: thêm một tuỳ chọn mới KHÔNG cần migration,
 * tránh đúng cái bẫy mà {@code WidgetType} đang mắc (enum Java + CHECK constraint SQL + union TS,
 * ba nơi phải sửa cùng lúc nên frontend phải nói dối DB để lách).
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class StageConfig {

    private WorkflowStage code;

    @Builder.Default
    private boolean enabled = true;

    private int order;

    @Builder.Default
    private Map<String, Object> options = new LinkedHashMap<>();

    public Object option(String key) {
        return options == null ? null : options.get(key);
    }

    public boolean booleanOption(String key, boolean fallback) {
        Object v = option(key);
        if (v instanceof Boolean b) return b;
        if (v instanceof String s) return Boolean.parseBoolean(s);
        return fallback;
    }

    public int intOption(String key, int fallback) {
        Object v = option(key);
        if (v instanceof Number n) return n.intValue();
        if (v instanceof String s) {
            try { return Integer.parseInt(s.trim()); } catch (NumberFormatException ignored) { /* dùng mặc định */ }
        }
        return fallback;
    }

    public String stringOption(String key, String fallback) {
        Object v = option(key);
        return v == null ? fallback : String.valueOf(v);
    }
}
