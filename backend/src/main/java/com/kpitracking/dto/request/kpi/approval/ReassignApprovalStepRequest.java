package com.kpitracking.dto.request.kpi.approval;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ReassignApprovalStepRequest {

    @NotNull(message = "{validation.noNewApproverSelected}")
    private UUID approverId;

    @NotBlank(message = "{validation.enterReasonReassignment}")
    private String reason;
}
