package com.kpitracking.dto.response.auth;
import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AuthResponse {

    private String accessToken;
    private String refreshToken;
    private Boolean requirePasswordChange;
    private Boolean hasSeenOnboarding;
    @Builder.Default
    private String tokenType = "Bearer";
    private UserInfoResponse user;
}
