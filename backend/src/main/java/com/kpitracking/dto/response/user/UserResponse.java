package com.kpitracking.dto.response.user;

import com.kpitracking.enums.UserRole;
import com.kpitracking.enums.UserStatus;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UserResponse {

    private UUID id;
    private String email;
    private String fullName;
    private String phone;
    private String avatarUrl;
    private UserRole role;
    private UserStatus status;
    private UUID companyId;
    private Instant createdAt;
    private Instant updatedAt;
}
