package com.kpitracking.dto.response.auth;

import com.kpitracking.enums.UserRole;
import com.kpitracking.enums.UserStatus;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UserInfoResponse {

    private UUID id;
    private String email;
    private String fullName;
    private String phone;
    private String avatarUrl;
    private UserRole role;
    private UserStatus status;
    private UUID companyId;
    private String companyName;
    private java.util.List<com.kpitracking.dto.response.user.UserMembershipResponse> memberships;
}
