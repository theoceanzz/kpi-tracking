package com.kpitracking.dto.response.feedback360;

import com.kpitracking.enums.F360QuestionType;
import com.kpitracking.enums.F360Relationship;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Một bộ câu hỏi 360 kèm năng lực, câu chấm điểm và câu nhận xét mở. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360TemplateResponse {
    private UUID id;
    private String name;
    private String description;
    private Integer scaleMax;
    private Boolean isDefault;
    /** Tổng trọng số năng lực — UI cảnh báo khi khác 100. */
    private Double totalWeight;
    private Instant updatedAt;
    private List<Competency> competencies;
    private List<Question> openQuestions;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Competency {
        private UUID id;
        private String name;
        private String description;
        private Double weight;
        private Integer position;
        private List<Question> questions;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Question {
        private UUID id;
        private F360QuestionType questionType;
        private String text;
        /** Rỗng = hỏi mọi nhóm. */
        private List<F360Relationship> relationships;
        private Boolean required;
        private Boolean allowNa;
        private Integer position;
    }
}
