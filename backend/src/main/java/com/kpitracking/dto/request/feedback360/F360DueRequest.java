package com.kpitracking.dto.request.feedback360;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.Instant;

/** Gia hạn chiến dịch. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360DueRequest {
    @NotNull(message = "{validation.chooseNewDeadline}")
    private Instant dueAt;
}
