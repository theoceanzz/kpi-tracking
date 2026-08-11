package com.kpitracking.dto.response.organization;

import lombok.*;

import java.util.UUID;

/**
 * Thông tin công ty hiển thị ở màn chọn công ty trước khi đăng nhập Lark.
 *
 * <p>Endpoint trả DTO này là <b>công khai</b> nên chỉ chứa đúng những gì cần để người dùng nhận ra
 * công ty mình. Không kèm feature flag, số người dùng, trạng thái hay bất kỳ thông tin Lark nào.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class PublicOrganizationResponse {

    private UUID id;

    /** Tên hiển thị: ưu tiên tên trên Lark vì nhân viên nhận ra công ty mình theo tên đó. */
    private String name;

    private String code;

    /** Logo doanh nghiệp trên Lark. Null thì giao diện hiện avatar chữ cái đầu. */
    private String avatarUrl;
}
