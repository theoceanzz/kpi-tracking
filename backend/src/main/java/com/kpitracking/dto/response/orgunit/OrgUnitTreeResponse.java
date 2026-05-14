package com.kpitracking.dto.response.orgunit;

import lombok.*;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class OrgUnitTreeResponse {

    private UUID id;
    private String name;
    private String code;
    private UUID parentId;
    private String type;
    private String path;
    private Integer level;
    private String status;
    private String logoUrl;

    @Builder.Default
    private List<com.kpitracking.dto.response.role.RoleResponse> allowedRoles = new ArrayList<>();

    @Builder.Default
    private List<OrgUnitTreeResponse> children = new ArrayList<>();
}
