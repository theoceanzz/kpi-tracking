package com.kpitracking.dto.response.organization;

import com.kpitracking.enums.LarkConnectionMode;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Trạng thái kết nối Lark của một tổ chức.
 *
 * <p>Cố tình KHÔNG có {@code appSecret} và {@code tenantKey}: giá trị thật không bao giờ rời
 * khỏi backend. Quản trị viên chỉ cần biết đã có secret hay chưa và tên tổ chức Lark đã liên kết.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class LarkSettingsResponse {

    private LarkConnectionMode connectionMode;
    private Boolean larkEnabled;

    private String appId;
    private Boolean hasAppSecret;

    private String tenantName;
    private String tenantAvatarUrl;
    private Instant verifiedAt;

    private UUID defaultOrgUnitId;
    private UUID defaultRoleId;

    /** URL callback để quản trị viên copy sang Lark Console. */
    private String redirectUri;

    /** Các quyền cần bật trên ứng dụng Lark, để giao diện hiện nút copy. */
    private String[] requiredScopes;

    /** Còn thiếu gì trước khi bật được đăng nhập Lark. Rỗng nghĩa là sẵn sàng. */
    private String[] missingRequirements;
}
