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

    @Getter
    @Builder
    @AllArgsConstructor
    public static class DefaultQualitativeLevel {
        private String name;
        private Double value;
        private Integer position;
        private String color;
    }

    // Reference: "Điểm đánh giá Hành vi" (Performance Matrix). value = reference score, position = column in sheet.
    public static final List<DefaultQualitativeLevel> DEFAULT_QUALITATIVE_LEVELS = List.of(
        new DefaultQualitativeLevel("KÉM", 0.0, 1, "#ef4444"),
        new DefaultQualitativeLevel("YẾU", 2.0, 2, "#f59e0b"),
        new DefaultQualitativeLevel("TRUNG BÌNH", 3.0, 3, "#6366f1"),
        new DefaultQualitativeLevel("KHÁ", 3.5, 4, "#3b82f6"),
        new DefaultQualitativeLevel("TỐT", 4.5, 5, "#10b981")
    );
}
