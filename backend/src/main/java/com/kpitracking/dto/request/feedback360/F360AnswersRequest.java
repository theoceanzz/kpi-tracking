package com.kpitracking.dto.request.feedback360;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;
import java.util.UUID;

/** Câu trả lời gửi lên khi lưu nháp hoặc nộp phiếu. Chỉ cần gửi những câu vừa sửa. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360AnswersRequest {

    @Valid
    private List<Item> answers;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Item {
        @NotNull(message = "{validation.questionMissing}")
        private UUID questionId;
        private Double score;
        private Boolean na;
        private String comment;
    }
}
