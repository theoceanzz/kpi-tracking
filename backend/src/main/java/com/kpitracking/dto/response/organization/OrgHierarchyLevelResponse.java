package com.kpitracking.dto.response.organization;

import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class OrgHierarchyLevelResponse {
    private UUID id;
    private Integer levelOrder;
    private String unitTypeName;
    private String managerRoleLabel;
}
