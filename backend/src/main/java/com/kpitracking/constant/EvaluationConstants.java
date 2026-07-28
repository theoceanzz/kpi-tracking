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
        private Double scorePercent;
        private String color;
    }

    // Reference: "Điểm đánh giá Hành vi" (Performance Matrix). value = reference score, position = column in sheet.
    // scorePercent = quy đổi sang % hoàn thành cho điểm BSC (mốc tròn, dễ giải thích) — HR chỉnh được.
    public static final List<DefaultQualitativeLevel> DEFAULT_QUALITATIVE_LEVELS = List.of(
        new DefaultQualitativeLevel("KÉM", 0.0, 1, 0.0, "#ef4444"),
        new DefaultQualitativeLevel("YẾU", 2.0, 2, 40.0, "#f59e0b"),
        new DefaultQualitativeLevel("TRUNG BÌNH", 3.0, 3, 60.0, "#6366f1"),
        new DefaultQualitativeLevel("KHÁ", 3.5, 4, 80.0, "#3b82f6"),
        new DefaultQualitativeLevel("TỐT", 4.5, 5, 100.0, "#10b981")
    );

    // ── Preset LUẬT XẾP LOẠI ĐƠN VỊ theo phân bố % (fallback khi org chưa cấu hình) ─────────────
    // conditions: { level: tên mức thành viên, scope: this|orAbove|orBelow, op: gte|lte|gt|lt|eq, percent }
    // Duyệt cao→thấp, đơn vị nhận mức đầu tiên mà TẤT CẢ điều kiện đúng (AND); mức cuối = fallback.

    /** Preset khi KHÔNG dùng matrix (thang XUẤT SẮC/TỐT/KHÁ/TRUNG BÌNH/YẾU). */
    public static final String DEFAULT_UNIT_RULES_SCORE = """
        {"rules":[
          {"levelName":"XUẤT SẮC","color":"#10b981","conditions":[
             {"level":"TỐT","scope":"orAbove","op":"gte","percent":60},
             {"level":"YẾU","scope":"this","op":"lte","percent":5}]},
          {"levelName":"TỐT","color":"#3b82f6","conditions":[
             {"level":"KHÁ","scope":"orAbove","op":"gte","percent":70},
             {"level":"YẾU","scope":"this","op":"lte","percent":10}]},
          {"levelName":"KHÁ","color":"#f59e0b","conditions":[
             {"level":"TRUNG BÌNH","scope":"orAbove","op":"gte","percent":70}]},
          {"levelName":"TRUNG BÌNH","color":"#6366f1","conditions":[
             {"level":"YẾU","scope":"this","op":"lte","percent":40}]},
          {"levelName":"YẾU","color":"#ef4444","conditions":[]}
        ]}""";

    /** Preset khi CÓ matrix (thang định tính KÉM/YẾU/TRUNG BÌNH/KHÁ/TỐT). */
    public static final String DEFAULT_UNIT_RULES_MATRIX = """
        {"rules":[
          {"levelName":"TỐT","color":"#10b981","conditions":[
             {"level":"KHÁ","scope":"orAbove","op":"gte","percent":60},
             {"level":"YẾU","scope":"orBelow","op":"lte","percent":5}]},
          {"levelName":"KHÁ","color":"#3b82f6","conditions":[
             {"level":"TRUNG BÌNH","scope":"orAbove","op":"gte","percent":70},
             {"level":"KÉM","scope":"this","op":"lte","percent":10}]},
          {"levelName":"TRUNG BÌNH","color":"#6366f1","conditions":[
             {"level":"TRUNG BÌNH","scope":"orAbove","op":"gte","percent":50}]},
          {"levelName":"YẾU","color":"#f59e0b","conditions":[
             {"level":"KÉM","scope":"this","op":"lte","percent":40}]},
          {"levelName":"KÉM","color":"#ef4444","conditions":[]}
        ]}""";
}
