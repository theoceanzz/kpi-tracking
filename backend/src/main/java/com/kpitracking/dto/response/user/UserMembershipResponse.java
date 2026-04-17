package com.kpitracking.dto.response.user;

import com.kpitracking.enums.DeptMemberPosition;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UserMembershipResponse {
    private UUID departmentId;
    private String departmentName;
    private DeptMemberPosition position;
}
