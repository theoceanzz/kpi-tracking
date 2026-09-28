package com.kpitracking.dto.request.user;

import lombok.*;

/**
 * Tuỳ chọn cá nhân của người đang đăng nhập.
 *
 * <p>{@code language}: mã trong {@code SupportedLanguages} ("vi", "en"), hoặc null để bỏ lựa chọn riêng và
 * theo ngôn ngữ mặc định của tổ chức.
 */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class UpdateUserPreferencesRequest {

    private String language;
}
