package com.kpitracking.dto.request.kpi;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RejectKpiRequest {

    @NotBlank(message = "Reject reason is required")
    private String reason;

    /** Bước người dùng đang thấy (chuỗi duyệt); lệch với bước hiện tại thì trả 409. */
    private java.util.UUID expectedStepId;
}
