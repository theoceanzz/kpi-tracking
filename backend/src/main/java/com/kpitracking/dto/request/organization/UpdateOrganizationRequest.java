package com.kpitracking.dto.request.organization;

import com.kpitracking.dto.request.auth.HierarchyLevelDTO;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.List;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UpdateOrganizationRequest {

    @Size(max = 255, message = "Organization name must not exceed 255 characters")
    private String name;

    @Size(max = 100, message = "Organization code must not exceed 100 characters")
    private String code;

    private String status;

    private List<HierarchyLevelDTO> hierarchyLevels;
}
