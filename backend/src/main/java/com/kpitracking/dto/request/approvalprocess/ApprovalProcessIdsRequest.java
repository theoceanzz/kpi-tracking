package com.kpitracking.dto.request.approvalprocess;

import jakarta.validation.constraints.NotEmpty;
import lombok.*;

import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ApprovalProcessIdsRequest {
    @NotEmpty(message = "Select at least one process")
    private List<UUID> ids;
}
