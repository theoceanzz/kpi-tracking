package com.kpitracking.dto.response.user;

import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UserMembershipResponse {
    private UUID orgUnitId;
    private String orgUnitName;
    private String organizationName;
    private String roleName;
    private String roleLabel;
    private String unitTypeLabel;
}
