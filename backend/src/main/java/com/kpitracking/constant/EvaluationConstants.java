package com.kpitracking.constant;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

public class EvaluationConstants {
    
    @Getter
    @Builder
    @AllArgsConstructor
    public static class DefaultLevel {
        private String name;
        private Double threshold;
        private String color;
    }

    public static final List<DefaultLevel> DEFAULT_LEVELS = List.of(
        new DefaultLevel("XUẤT SẮC", 90.0, "#10b981"),
        new DefaultLevel("TỐT", 80.0, "#3b82f6"),
        new DefaultLevel("KHÁ", 70.0, "#f59e0b"),
        new DefaultLevel("TRUNG BÌNH", 50.0, "#6366f1"),
        new DefaultLevel("YẾU", 0.0, "#ef4444")
    );
}
