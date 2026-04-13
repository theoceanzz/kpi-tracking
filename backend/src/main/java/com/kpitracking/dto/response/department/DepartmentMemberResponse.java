package com.kpitracking.dto.response.department;

import com.kpitracking.enums.DeptMemberPosition;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DepartmentMemberResponse {

    private UUID id;
    private UUID userId;
    private String userFullName;
    private String userEmail;
    private DeptMemberPosition position;
    private Instant createdAt;
}
