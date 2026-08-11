package com.kpitracking.service;

import com.kpitracking.config.LarkProperties;
import com.kpitracking.dto.response.auth.LarkApiResponses.TokenResponse;
import com.kpitracking.dto.response.auth.LarkApiResponses.UserInfoData;
import com.kpitracking.dto.response.auth.LarkApiResponses.UserInfoResponse;
import com.kpitracking.exception.BusinessException;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;

/**
 * Gọi Lark Open API cho luồng OAuth (Custom App nội bộ).
 * <p>
 * Dùng {@code authen/v2/oauth/token} nên không cần lấy app_access_token trước như luồng v1 cũ.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class LarkOAuthClient {

    private static final String SCOPE = "contact:user.base:readonly contact:user.email:readonly";

    private final LarkProperties larkProperties;
    private RestClient restClient;

    @PostConstruct
    void init() {
        this.restClient = RestClient.builder()
                .baseUrl(larkProperties.getOpenBaseUrl())
                .build();
    }

    /** Ghép URL màn hình đồng ý của Lark cho một app cụ thể. */
    public String buildAuthorizeUrl(String appId, String state) {
        // Tự percent-encode thay vì dùng UriComponentsBuilder.encode(): builder coi ':' và '/'
        // là ký tự hợp lệ trong query nên sẽ để nguyên redirect_uri, trong khi Lark đòi mã hoá.
        return larkProperties.getAuthBaseUrl() + "/open-apis/authen/v1/authorize"
                + "?client_id=" + encode(appId)
                + "&redirect_uri=" + encode(larkProperties.getRedirectUri())
                + "&response_type=code"
                + "&state=" + encode(state)
                + "&scope=" + encode(SCOPE);
    }

    private static String encode(String value) {
        // URLEncoder dùng chuẩn form (space -> '+'), query string cần '%20'
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    /** Đổi authorization code lấy user_access_token bằng credential của một app cụ thể. */
    public TokenResponse exchangeCodeForToken(String appId, String appSecret, String code) {
        Map<String, String> body = Map.of(
                "grant_type", "authorization_code",
                "client_id", appId,
                "client_secret", appSecret,
                "code", code,
                "redirect_uri", larkProperties.getRedirectUri()
        );

        TokenResponse response;
        try {
            response = restClient.post()
                    .uri("/open-apis/authen/v2/oauth/token")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(TokenResponse.class);
        } catch (RestClientException e) {
            log.error("Không gọi được Lark oauth/token: {}", e.getMessage());
            throw new BusinessException("Không kết nối được tới Lark. Vui lòng thử lại sau.");
        }

        // Lark trả HTTP 200 kể cả khi lỗi -> phải kiểm tra field code
        if (response == null || response.code() != 0) {
            String detail = response == null ? "không có phản hồi" : response.errorMessage();
            log.error("Lark oauth/token trả lỗi: {}", detail);
            throw new BusinessException("Lark từ chối yêu cầu đăng nhập (" + detail + ").");
        }
        if (response.accessToken() == null || response.accessToken().isBlank()) {
            throw new BusinessException("Lark không trả về access token.");
        }
        return response;
    }

    /** Lấy thông tin người dùng bằng user_access_token vừa đổi được. */
    public UserInfoData fetchUserInfo(String userAccessToken) {
        UserInfoResponse response;
        try {
            response = restClient.get()
                    .uri("/open-apis/authen/v1/user_info")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + userAccessToken)
                    .retrieve()
                    .body(UserInfoResponse.class);
        } catch (RestClientException e) {
            log.error("Không gọi được Lark user_info: {}", e.getMessage());
            throw new BusinessException("Không kết nối được tới Lark. Vui lòng thử lại sau.");
        }

        if (response == null || response.code() != 0) {
            String detail = response == null ? "không có phản hồi" : response.msg();
            log.error("Lark user_info trả lỗi: {}", detail);
            throw new BusinessException("Không lấy được thông tin tài khoản Lark (" + detail + ").");
        }
        if (response.data() == null || response.data().openId() == null) {
            throw new BusinessException("Lark không trả về định danh người dùng.");
        }
        return response.data();
    }

    /**
     * Kiểm tra cặp App ID / App Secret có hợp lệ không, không cần người dùng thao tác gì.
     * Trả về kết quả thay vì ném lỗi để giao diện hiển thị được thông báo cụ thể.
     */
    public TestResult testCredentials(String appId, String appSecret) {
        Map<String, String> body = Map.of("app_id", appId, "app_secret", appSecret);

        AppTokenResponse response;
        try {
            response = restClient.post()
                    .uri("/open-apis/auth/v3/app_access_token/internal")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(AppTokenResponse.class);
        } catch (RestClientException e) {
            log.error("Không gọi được Lark app_access_token: {}", e.getMessage());
            return new TestResult(false, "Không kết nối được tới Lark. Kiểm tra lại mạng của máy chủ.");
        }

        if (response == null) {
            return new TestResult(false, "Lark không phản hồi.");
        }
        if (response.code() != 0) {
            log.warn("Lark từ chối credential: code={} msg={}", response.code(), response.msg());
            return new TestResult(false, describeError(response.code(), response.msg()));
        }
        return new TestResult(true, "Kết nối thành công. App ID và App Secret hợp lệ.");
    }

    /**
     * Dịch mã lỗi của Lark sang lời khuyên cụ thể. Các mã dưới đây đã kiểm chứng bằng cách
     * gọi thật: 10003 khi App ID sai, 10014 khi App Secret sai.
     */
    private static String describeError(int code, String msg) {
        return switch (code) {
            case 10003 -> "App ID không đúng. Kiểm tra lại giá trị copy từ trang "
                    + "Credentials & Basic Info trên Lark Console.";
            case 10014 -> "App Secret không đúng. Copy lại từ trang Credentials & Basic Info.";
            case 99991672 -> "Ứng dụng Lark chưa được phát hành. Vào mục Version Management "
                    + "để tạo phiên bản và publish trước.";
            default -> "Lark báo lỗi: " + (msg == null || msg.isBlank() ? "mã " + code : msg);
        };
    }

    /**
     * Lấy tên và logo doanh nghiệp trên Lark để quản trị viên đối chiếu bằng mắt khi liên kết,
     * và để hiển thị ở màn chọn công ty.
     *
     * <p>Cần quyền {@code tenant:tenant:readonly} trên ứng dụng Lark. Đây là quyền tuỳ chọn nên
     * trả về {@link Optional#empty()} thay vì ném lỗi — thiếu tên công ty không đáng để chặn cả
     * luồng kết nối, giao diện vẫn còn tên và email của quản trị viên để xác nhận.
     */
    public Optional<TenantProfile> fetchTenantProfile(String appId, String appSecret) {
        try {
            TenantTokenResponse tokenResponse = restClient.post()
                    .uri("/open-apis/auth/v3/tenant_access_token/internal")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("app_id", appId, "app_secret", appSecret))
                    .retrieve()
                    .body(TenantTokenResponse.class);

            if (tokenResponse == null || tokenResponse.code() != 0
                    || tokenResponse.tenantAccessToken() == null) {
                log.warn("Không lấy được tenant_access_token để đọc tên doanh nghiệp");
                return Optional.empty();
            }

            TenantQueryResponse query = restClient.get()
                    .uri("/open-apis/tenant/v2/tenant/query")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenResponse.tenantAccessToken())
                    .retrieve()
                    .body(TenantQueryResponse.class);

            if (query == null || query.code() != 0 || query.data() == null
                    || query.data().tenant() == null) {
                log.info("Ứng dụng Lark chưa được cấp quyền tenant:tenant:readonly, "
                        + "bỏ qua tên và logo doanh nghiệp");
                return Optional.empty();
            }

            TenantInfo tenant = query.data().tenant();
            return Optional.of(new TenantProfile(
                    tenant.name(),
                    tenant.avatar() != null ? tenant.avatar().best() : null));
        } catch (RestClientException e) {
            log.warn("Không đọc được thông tin doanh nghiệp Lark: {}", e.getMessage());
            return Optional.empty();
        }
    }

    /** Tên và logo doanh nghiệp trên Lark. Cả hai trường đều có thể null. */
    public record TenantProfile(String name, String avatarUrl) {
    }

    public record TestResult(boolean ok, String message) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record AppTokenResponse(int code, String msg) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record TenantTokenResponse(
            int code,
            @JsonProperty("tenant_access_token") String tenantAccessToken) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record TenantQueryResponse(int code, TenantQueryData data) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record TenantQueryData(TenantInfo tenant) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record TenantInfo(
            String name,
            @JsonProperty("tenant_key") String tenantKey,
            TenantAvatar avatar) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record TenantAvatar(
            @JsonProperty("avatar_240") String avatar240,
            @JsonProperty("avatar_640") String avatar640,
            @JsonProperty("avatar_origin") String avatarOrigin) {

        /** 240px vừa cho danh sách; hai cỡ còn lại dự phòng nếu Lark bỏ trống. */
        String best() {
            if (avatar240 != null && !avatar240.isBlank()) return avatar240;
            if (avatar640 != null && !avatar640.isBlank()) return avatar640;
            if (avatarOrigin != null && !avatarOrigin.isBlank()) return avatarOrigin;
            return null;
        }
    }
}
