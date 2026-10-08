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
    private Boolean isPlatformAdmin;
    /**
     * Đăng nhập được nhưng chưa thuộc tổ chức nào (không có membership, không phải quản trị nền tảng):
     * frontend không được gọi API theo tổ chức mà đưa người dùng sang màn hình hướng dẫn.
     */
    private Boolean needsOrganization;
    /** Ngôn ngữ người dùng tự chọn; null = chưa chọn. */
    private String preferredLanguage;
    /** Ngôn ngữ thực dùng: tự chọn → mặc định của tổ chức → vi. */
    private String effectiveLanguage;
}
