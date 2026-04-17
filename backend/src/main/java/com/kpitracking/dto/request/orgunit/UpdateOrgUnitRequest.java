package com.kpitracking.dto.request.orgunit;

import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UpdateOrgUnitRequest {

    @Size(max = 255, message = "Org unit name must not exceed 255 characters")
    private String name;

    private String type;
    private String email;
    private String phone;
    private String address;
    private UUID provinceId;
    private UUID districtId;
}
