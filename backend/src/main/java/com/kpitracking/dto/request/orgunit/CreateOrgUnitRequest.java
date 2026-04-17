package com.kpitracking.dto.request.orgunit;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CreateOrgUnitRequest {

    @NotBlank(message = "Org unit name is required")
    @Size(max = 255, message = "Org unit name must not exceed 255 characters")
    private String name;

    private UUID parentId;

    @NotBlank(message = "Type is required")
    private String type;

    private String email;
    private String phone;
    private String address;
    private UUID provinceId;
    private UUID districtId;
}
