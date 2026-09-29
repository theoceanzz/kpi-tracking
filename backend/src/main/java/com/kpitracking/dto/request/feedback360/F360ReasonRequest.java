package com.kpitracking.dto.request.feedback360;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.time.Instant;

/** Thao tác bắt buộc có lý do (mở lại, từ chối, ẩn nhận xét); {@link #dueAt} chỉ dùng khi mở lại chiến dịch. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360ReasonRequest {
    @NotBlank(message = "{validation.enterReason}")
    private String reason;
    private Instant dueAt;
}
