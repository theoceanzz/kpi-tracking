package com.kpitracking.dto.response.department;

import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DepartmentResponse {

    private UUID id;
    private String name;
    private String description;
    private UUID headId;
    private String headName;
    private UUID deputyId;
    private String deputyName;
    private int memberCount;
    private List<DepartmentMemberResponse> members;
    private Instant createdAt;
    private Instant updatedAt;
}
