package com.kpitracking.dto.request.feedback360;

import com.kpitracking.enums.F360Relationship;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import lombok.*;

import java.util.List;
import java.util.UUID;

/**
 * Tạo hoặc lưu MỘT bộ câu hỏi 360. Khi lưu, {@link #competencies} và {@link #openQuestions}
 * THAY THẾ toàn bộ nội dung cũ — cùng cách với bộ tiêu chí hạnh kiểm.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360TemplateRequest {

    @NotBlank(message = "{validation.questionSetNameCannotEmpty}")
    private String name;

    private String description;

    @Min(value = 3, message = "{validation.scaleMustLeast3}")
    @Max(value = 10, message = "{validation.scaleCanMost10}")
    private Integer scaleMax;

    /** Chỉ dùng khi TẠO mà không gửi nội dung: chép từ bộ này (mặc định: bộ mặc định). */
    private UUID copyFromId;

    /** Năng lực kèm câu chấm điểm; tổng trọng số phải bằng 100%. */
    @Valid
    private List<Competency> competencies;

    /** Câu nhận xét mở chung, không thuộc năng lực nào. */
    @Valid
    private List<Question> openQuestions;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Competency {
        @NotBlank(message = "{validation.competencyNameCannotEmpty}")
        private String name;
        private String description;
        @Positive(message = "{validation.competencyWeightMustGreaterThan0}")
        private Double weight;
        @Valid
        private List<Question> questions;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Question {
        @NotBlank(message = "{validation.questionContentCannotEmpty}")
        private String text;
        /** Nhóm quan hệ được hỏi; rỗng = hỏi mọi nhóm. */
        private List<F360Relationship> relationships;
        private Boolean required;
        private Boolean allowNa;
    }
}
