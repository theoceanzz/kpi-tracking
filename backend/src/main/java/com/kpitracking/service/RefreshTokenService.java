package com.kpitracking.service;

import com.kpitracking.config.JwtConfig;
import com.kpitracking.entity.RefreshToken;
import com.kpitracking.entity.User;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.RefreshTokenRepository;
import com.kpitracking.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private final RefreshTokenRepository refreshTokenRepository;
    private final UserRepository userRepository;
    private final JwtConfig jwtConfig;

    @Transactional
    public RefreshToken createOrUpdateRefreshToken(UUID userId, String deviceInfo) {
        String device = (deviceInfo != null && !deviceInfo.isBlank()) ? deviceInfo : "Thiết bị không xác định";
        if (device.length() > 255) {
            device = device.substring(0, 255);
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "id", userId));

        java.util.Optional<RefreshToken> existingTokenOpt = refreshTokenRepository.findByUserIdAndDeviceInfo(userId, device);
        
        RefreshToken refreshToken;
        if (existingTokenOpt.isPresent()) {
            refreshToken = existingTokenOpt.get();
            refreshToken.setToken(UUID.randomUUID().toString());
            refreshToken.setExpiresAt(Instant.now().plusMillis(jwtConfig.getRefreshTokenExpiry()));
            refreshToken.setRevoked(false);
        } else {
            refreshToken = RefreshToken.builder()
                    .user(user)
                    .token(UUID.randomUUID().toString())
                    .expiresAt(Instant.now().plusMillis(jwtConfig.getRefreshTokenExpiry()))
                    .deviceInfo(device)
                    .revoked(false)
                    .build();
        }

        return refreshTokenRepository.save(refreshToken);
    }

    @Transactional(readOnly = true)
    public RefreshToken verifyRefreshToken(String token) {
        RefreshToken refreshToken = refreshTokenRepository.findByTokenAndRevokedFalse(token)
                .orElseThrow(() -> new BusinessException("Mã làm mới không hợp lệ hoặc đã bị thu hồi"));

        if (refreshToken.getExpiresAt().isBefore(Instant.now())) {
            refreshTokenRepository.delete(refreshToken);
            throw new BusinessException("Mã làm mới đã hết hạn. Vui lòng đăng nhập lại.");
        }

        return refreshToken;
    }

    @Transactional
    public void revokeAllUserTokens(UUID userId) {
        refreshTokenRepository.revokeAllByUserId(userId);
    }

    @Transactional
    public void revokeToken(RefreshToken token) {
        token.setRevoked(true);
        refreshTokenRepository.save(token);
    }

    @Transactional
    public void deleteExpiredTokens() {
        refreshTokenRepository.deleteExpiredTokens(Instant.now());
    }
}
