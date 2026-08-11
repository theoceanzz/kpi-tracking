package com.kpitracking.dto.response.organization;

import lombok.*;

/**
 * Kết quả bước quản trị viên đăng nhập Lark để liên kết tổ chức.
 *
 * <p>{@code tenant_key} thật không trả về trình duyệt — nó được gói trong {@code pendingToken}
 * (JWT ký ngắn hạn) và chỉ được mở ra ở backend khi quản trị viên bấm xác nhận.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class LarkConnectResultResponse {

    /** Tên tổ chức trên Lark để quản trị viên đối chiếu bằng mắt. */
    private String tenantName;

    /** Logo doanh nghiệp trên Lark. Null khi ứng dụng chưa có quyền tenant:tenant:readonly. */
    private String tenantAvatarUrl;

    /**
     * Tên/logo phía trên là giá trị đang lưu chứ không phải vừa lấy từ Lark — xảy ra khi quyền
     * tenant:tenant:readonly mất hiệu lực nhưng vẫn liên kết đúng tổ chức cũ.
     */
    private Boolean usingSavedProfile;

    private String userName;
    private String userEmail;
    private String userAvatarUrl;

    private String pendingToken;

    /** Tổ chức Lark này đã được một công ty khác trong KeyGo liên kết. */
    private Boolean alreadyLinked;
    private String alreadyLinkedOrganizationName;
}
