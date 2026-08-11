package com.kpitracking.dto.response.auth;

import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class LarkAuthorizeUrlResponse {

    /** URL màn hình đồng ý của Lark, frontend redirect thẳng tới đây. */
    private String authorizeUrl;

    /** State đã ký, frontend lưu tạm để đối chiếu khi Lark gọi lại. */
    private String state;
}
