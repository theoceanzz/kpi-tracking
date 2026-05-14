package com.kpitracking.dto.request.user;

import com.kpitracking.enums.UserStatus;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UpdateUserRequest {

    @Size(max = 255, message = "Full name must not exceed 255 characters")
    private String fullName;

    private String employeeCode;

    @Email(message = "Invalid email format")
    private String email;

    private String phone;

    private UserStatus status;

    private String role;

    private java.util.UUID orgUnitId;
}
