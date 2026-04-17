package com.kpitracking.dto.response.user;

import com.kpitracking.enums.UserStatus;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UserResponse {

    private UUID id;
    private String email;
    private String fullName;
    private String phone;
    private String avatarUrl;
    private List<String> roles;
    private UserStatus status;
    private Instant createdAt;
    private Instant updatedAt;
}
