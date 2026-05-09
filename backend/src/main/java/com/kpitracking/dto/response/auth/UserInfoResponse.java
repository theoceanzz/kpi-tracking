package com.kpitracking.dto.response.auth;

import com.kpitracking.enums.UserStatus;
import lombok.*;

import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UserInfoResponse {

    private UUID id;
    private String email;
    private String fullName;
    private String employeeCode;
    private String phone;
    private String avatarUrl;
    private UserStatus status;
    private java.util.List<com.kpitracking.dto.response.user.UserMembershipResponse> memberships;
    private List<String> roles;
    private List<String> permissions;
    private Boolean requirePasswordChange;
    private Boolean hasSeenOnboarding;
}
