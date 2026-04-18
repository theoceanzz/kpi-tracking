package com.kpitracking.dto.request.auth;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class HierarchyLevelDTO {
    @NotBlank(message = "Unit type name is required")
    private String unitTypeName;
    
    private String managerRoleLabel;
}
