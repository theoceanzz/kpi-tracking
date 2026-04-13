package com.kpitracking.dto.request.department;

import com.kpitracking.enums.DeptMemberPosition;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AddMemberRequest {

    @NotNull(message = "User ID is required")
    private UUID userId;

    @NotNull(message = "Position is required")
    private DeptMemberPosition position;
}
