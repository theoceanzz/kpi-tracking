package com.kpitracking.dto.response.feedback360;

import lombok.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Kết quả 360 của một người, đã qua ngưỡng ẩn danh — CHỤP vào {@code f360_subjects.result_snapshot}
 * lúc đóng chiến dịch và trả thẳng cho màn hình báo cáo.
 *
 * <p>Mọi con số ở đây chỉ được tính từ các ô (nhóm × câu hỏi) được phép hiện. Dữ liệu của nhóm
 * bị ẩn không đi vào BẤT KỲ con số nào, kể cả điểm tổng — nên không có phép trừ ngược nào lấy
 * lại được nó (§6.1). Không chứa nhận xét: nhận xét đọc live để "Ẩn nhận xét" có hiệu lực ngay.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360ResultSnapshot {

    private Integer scaleMax;
    private Integer anonymityThreshold;
    private Double overallScore;
    /** Trung bình tự đánh giá (có trọng số năng lực). */
    private Double selfScore;
    /** Trung bình của người khác (mọi nhóm hiện, trừ tự đánh giá). */
    private Double othersScore;
    /** Số người (ngoài bản thân) đã nộp phiếu. */
    private Integer responseCount;
    /** Không có nhóm nào ngoài tự đánh giá đủ điều kiện hiện. */
    private Boolean insufficient;

    @Builder.Default
    private List<Group> groups = new ArrayList<>();
    @Builder.Default
    private List<CompetencyScore> competencies = new ArrayList<>();
    @Builder.Default
    private List<QuestionScore> questions = new ArrayList<>();
    @Builder.Default
    private List<Gap> blindSpots = new ArrayList<>();
    @Builder.Default
    private List<Gap> hiddenStrengths = new ArrayList<>();
    @Builder.Default
    private List<Highlight> top = new ArrayList<>();
    @Builder.Default
    private List<Highlight> bottom = new ArrayList<>();

    /** Một nhóm hiển thị: một quan hệ, hoặc nhóm "Người khác" gộp từ các nhóm dưới ngưỡng. */
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Group {
        private String key;
        private String label;
        @Builder.Default
        private List<String> relationships = new ArrayList<>();
        private Integer raterCount;
        /** False = bị ẩn vì dưới ngưỡng k; không số nào của nhóm này được hiện. */
        private Boolean visible;
        private Boolean anonymous;
        private Double weight;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CompetencyScore {
        private UUID key;
        private String name;
        private Double weight;
        private Integer position;
        /** Điểm theo khoá nhóm; nhóm không có dữ liệu hoặc bị ẩn thì không có mặt. */
        @Builder.Default
        private Map<String, Double> byGroup = new LinkedHashMap<>();
        private Double self;
        private Double others;
        /** self − others. */
        private Double gap;
        /** Ý kiến phân tán (độ lệch chuẩn vượt ngưỡng). */
        private Boolean divergent;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class QuestionScore {
        private UUID id;
        private UUID competencyKey;
        private String competencyName;
        private String text;
        private Integer position;
        @Builder.Default
        private Map<String, Double> byGroup = new LinkedHashMap<>();
        /** Nhóm có dữ liệu cho câu này nhưng bị ẩn vì ít hơn k câu trả lời. */
        @Builder.Default
        private List<String> hiddenGroups = new ArrayList<>();
        private Double self;
        private Double others;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Gap {
        private String name;
        private Double self;
        private Double others;
        private Double gap;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Highlight {
        private String competencyName;
        private String text;
        private Double score;
    }
}
