package com.kpitracking.dto.request.evaluation;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CreateEvaluationRequest {

    @NotNull(message = "User ID is required")
    private UUID userId;

    @NotNull(message = "KPI Period ID is required")
    private UUID kpiPeriodId;

    @NotNull(message = "Score is required")
    @Min(value = 0, message = "Score must be at least 0")
    private Double score;

    private String comment;

    /**
     * Quản trị BSC chủ động chốt dù thẻ nguồn của dòng "Kết quả cấp trên" chưa chốt — điểm dòng đó
     * được lưu theo số tạm tính và đánh dấu lại. Người khác gửi cờ này thì bị từ chối.
     */
    private Boolean allowProvisionalBsc;
}
