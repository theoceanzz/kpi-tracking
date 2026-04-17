package com.kpitracking.dto.response.orgunit;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class OrgUnitResponse {

    private UUID id;
    private String name;
    private UUID parentId;
    private UUID organizationId;
    private String type;
    private String path;
    private Integer level;
    private String email;
    private String phone;
    private String address;
    private UUID provinceId;
    private String provinceName;
    private UUID districtId;
    private String districtName;
    private String logoUrl;
    private String status;
    private Instant createdAt;
    private Instant updatedAt;
}
