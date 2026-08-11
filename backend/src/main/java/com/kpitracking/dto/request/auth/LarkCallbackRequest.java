package com.kpitracking.dto.request.auth;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class LarkCallbackRequest {

    @NotBlank(message = "Thiếu mã uỷ quyền từ Lark")
    private String code;

    @NotBlank(message = "Thiếu tham số state")
    private String state;
}
