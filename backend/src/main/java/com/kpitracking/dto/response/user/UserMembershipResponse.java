package com.kpitracking.dto.response.user;

import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UserMembershipResponse {
    private UUID orgUnitId;
    private UUID organizationId;
    private String orgUnitName;
    private String organizationName;
    private String roleName;
    private String roleDisplayName;
    private Integer roleRank;
    private String unitTypeLabel;
    private Integer levelOrder;
    private Integer roleLevel;
}
