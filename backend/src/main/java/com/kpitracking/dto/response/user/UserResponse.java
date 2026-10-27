package com.kpitracking.dto.response.user;

import com.kpitracking.enums.user.UserStatus;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UserResponse {

    private UUID id;
    private String email;
    private String fullName;
    private String employeeCode;
    private String phone;
    private String avatarUrl;
    private List<String> roles;
    private UserStatus status;
    private UUID organizationId;
    private java.util.List<UserMembershipResponse> memberships;
    /** Chỉ có khi người này thuộc ≥ 2 nhánh: "% công sức" từng nhánh (đơn vị chính đứng đầu). */
    private java.util.List<UserEffortShareResponse> effortShares;
    private Boolean isEmailVerified;
    private Instant createdAt;
    private Instant updatedAt;
    private Boolean requirePasswordChange;
}
