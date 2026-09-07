package com.kpitracking.controller;

import com.kpitracking.dto.request.auth.*;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.auth.AuthResponse;
import com.kpitracking.dto.response.auth.LarkAuthorizeUrlResponse;
import com.kpitracking.dto.response.auth.UserInfoResponse;
import com.kpitracking.security.AuthCookieService;
import com.kpitracking.service.AuthService;
import com.kpitracking.service.LarkAuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Authentication", description = "Auth endpoints")
public class AuthController {

    private final AuthService authService;
    private final LarkAuthService larkAuthService;
    private final AuthCookieService authCookieService;

    @PostMapping("/register")
    @Operation(summary = "Register a new organization and director account")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest request,
                                                              HttpServletRequest httpRequest,
                                                              HttpServletResponse httpResponse) {
        String userAgent = httpRequest.getHeader("User-Agent");
        AuthResponse response = authService.register(request, userAgent);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Registration successful", issueSession(response, httpResponse)));
    }

    @PostMapping("/login")
    @Operation(summary = "Login with email and password")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request,
                                                           HttpServletRequest httpRequest,
                                                           HttpServletResponse httpResponse) {
        String userAgent = httpRequest.getHeader("User-Agent");
        AuthResponse response = authService.login(request, userAgent);
        return ResponseEntity.ok(ApiResponse.success("Login successful", issueSession(response, httpResponse)));
    }

    @PostMapping("/refresh-token")
    @Operation(summary = "Refresh access token")
    public ResponseEntity<ApiResponse<AuthResponse>> refreshToken(
            @RequestBody(required = false) RefreshTokenRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        AuthResponse response = authService.refreshToken(resolveRefreshTokens(request, httpRequest));
        return ResponseEntity.ok(ApiResponse.success("Token refreshed", issueSession(response, httpResponse)));
    }

    @GetMapping("/lark/authorize-url")
    @Operation(summary = "Get the Lark OAuth authorize URL for a specific organization")
    public ResponseEntity<ApiResponse<LarkAuthorizeUrlResponse>> larkAuthorizeUrl(
            @RequestParam java.util.UUID organizationId) {
        return ResponseEntity.ok(ApiResponse.success("Lark authorize URL generated",
                larkAuthService.getAuthorizeUrl(organizationId)));
    }

    @PostMapping("/lark/callback")
    @Operation(summary = "Exchange a Lark authorization code for KeyGo tokens")
    public ResponseEntity<ApiResponse<AuthResponse>> larkCallback(@Valid @RequestBody LarkCallbackRequest request,
                                                                  HttpServletRequest httpRequest,
                                                                  HttpServletResponse httpResponse) {
        String userAgent = httpRequest.getHeader("User-Agent");
        AuthResponse response = larkAuthService.loginWithLark(request.getCode(), request.getState(), userAgent);
        return ResponseEntity.ok(ApiResponse.success("Login successful", issueSession(response, httpResponse)));
    }

    @PostMapping("/change-password")
    @Operation(summary = "Change current user password")
    public ResponseEntity<ApiResponse<Void>> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(request);
        return ResponseEntity.ok(ApiResponse.success("Password changed successfully"));
    }

    @PostMapping("/forgot-password")
    @Operation(summary = "Request password reset email")
    public ResponseEntity<ApiResponse<Void>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        authService.forgotPassword(request);
        return ResponseEntity.ok(ApiResponse.success("Password reset email sent"));
    }

    @PostMapping("/reset-password")
    @Operation(summary = "Reset password with token")
    public ResponseEntity<ApiResponse<Void>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ResponseEntity.ok(ApiResponse.success("Password reset successfully"));
    }

    @GetMapping("/verify-email")
    @Operation(summary = "Verify user email with token")
    public ResponseEntity<ApiResponse<Void>> verifyEmail(@RequestParam String token) {
        authService.verifyEmail(token);
        return ResponseEntity.ok(ApiResponse.success("Email verified successfully"));
    }

    @PostMapping("/resend-verification")
    @Operation(summary = "Resend verification email")
    public ResponseEntity<ApiResponse<Void>> resendVerification(@Valid @RequestBody ForgotPasswordRequest request) {
        authService.resendVerificationToken(request.getEmail());
        return ResponseEntity.ok(ApiResponse.success("Verification email resent successfully"));
    }

    @PostMapping("/logout")
    @Operation(summary = "Logout and revoke token")
    public ResponseEntity<ApiResponse<Void>> logout(@RequestBody(required = false) RefreshTokenRequest request,
                                                    HttpServletRequest httpRequest,
                                                    HttpServletResponse httpResponse) {
        // Cookie phải được xoá kể cả khi refresh token đã hết hạn/không hợp lệ, nếu không
        // trình duyệt còn giữ một cookie chết và người dùng kẹt ở trạng thái nửa vời.
        // Thu hồi mọi ứng viên: khi có cookie kg_rt trùng tên, token thật có thể đứng sau bản cũ.
        for (String refreshToken : resolveRefreshTokens(request, httpRequest)) {
            try {
                authService.logout(refreshToken);
            } catch (Exception e) {
                log.warn("Logout could not revoke refresh token: {}", e.getMessage());
            }
        }

        authCookieService.clearAuthCookies(httpResponse);
        return ResponseEntity.ok(ApiResponse.success("Logged out successfully"));
    }

    @GetMapping("/me")
    @Operation(summary = "Get current user info")
    public ResponseEntity<ApiResponse<UserInfoResponse>> getCurrentUser() {
        UserInfoResponse response = authService.getCurrentUser();
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping(value = "/me/avatar", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload user avatar")
    public ResponseEntity<ApiResponse<UserInfoResponse>> uploadAvatar(@RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        UserInfoResponse response = authService.uploadAvatar(file);
        return ResponseEntity.ok(ApiResponse.success("Avatar uploaded successfully", response));
    }

    @PostMapping("/me/onboarding")
    @Operation(summary = "Mark onboarding as completed")
    public ResponseEntity<ApiResponse<Void>> completeOnboarding() {
        authService.completeOnboarding();
        return ResponseEntity.ok(ApiResponse.success("Onboarding marked as completed"));
    }

    /**
     * Đưa token vào cookie HttpOnly và gỡ khỏi body: trình duyệt không được phép nhìn thấy
     * token ở tầng JavaScript nữa.
     */
    private AuthResponse issueSession(AuthResponse response, HttpServletResponse httpResponse) {
        authCookieService.writeAuthCookies(httpResponse, response);
        response.setAccessToken(null);
        response.setRefreshToken(null);
        return response;
    }

    /**
     * Cookie là nguồn chính; body chỉ còn để tương thích với client không phải trình duyệt.
     *
     * Trả về mọi ứng viên thay vì một giá trị: trình duyệt có thể gửi nhiều cookie kg_rt trùng tên
     * và cái đứng đầu thường là bản cũ đã bị ghi đè trong DB.
     */
    private java.util.List<String> resolveRefreshTokens(RefreshTokenRequest request, HttpServletRequest httpRequest) {
        java.util.List<String> candidates =
                new java.util.ArrayList<>(authCookieService.readRefreshTokens(httpRequest));

        if (request != null && StringUtils.hasText(request.getRefreshToken())) {
            candidates.add(request.getRefreshToken());
        }

        return candidates;
    }
}
