package com.kpitracking.dto.response.auth;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Các kiểu dữ liệu Lark Open API trả về.
 * <p>
 * Lưu ý: Lark luôn trả HTTP 200, lỗi nằm ở field {@code code != 0} trong body.
 */
public final class LarkApiResponses {

    private LarkApiResponses() {
    }

    /**
     * POST /open-apis/authen/v2/oauth/token — các field nằm ở top-level (không bọc trong "data").
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TokenResponse(
            int code,
            @JsonProperty("error") String error,
            @JsonProperty("error_description") String errorDescription,
            @JsonProperty("access_token") String accessToken,
            @JsonProperty("token_type") String tokenType,
            @JsonProperty("expires_in") Integer expiresIn,
            @JsonProperty("refresh_token") String refreshToken
    ) {
        public String errorMessage() {
            if (errorDescription != null && !errorDescription.isBlank()) return errorDescription;
            if (error != null && !error.isBlank()) return error;
            return "mã lỗi " + code;
        }
    }

    /**
     * GET /open-apis/authen/v1/user_info — dữ liệu nằm trong "data".
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UserInfoResponse(
            int code,
            String msg,
            UserInfoData data
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UserInfoData(
            String name,
            @JsonProperty("en_name") String enName,
            @JsonProperty("avatar_url") String avatarUrl,
            @JsonProperty("open_id") String openId,
            @JsonProperty("union_id") String unionId,
            String email,
            @JsonProperty("enterprise_email") String enterpriseEmail,
            @JsonProperty("user_id") String userId,
            String mobile,
            @JsonProperty("tenant_key") String tenantKey,
            @JsonProperty("employee_no") String employeeNo
    ) {
        /** Email công ty được ưu tiên vì đó là email khớp với tài khoản KeyGo. */
        public String resolveEmail() {
            if (enterpriseEmail != null && !enterpriseEmail.isBlank()) return enterpriseEmail;
            if (email != null && !email.isBlank()) return email;
            return null;
        }
    }
}
