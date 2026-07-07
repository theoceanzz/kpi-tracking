package com.kpitracking.dto.request.admin;

import com.kpitracking.enums.OrganizationStatus;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class UpdateOrgStatusRequest {

    @NotNull
    private OrganizationStatus status;
}
