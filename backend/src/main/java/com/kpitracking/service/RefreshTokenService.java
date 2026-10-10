package com.kpitracking.service;

import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.config.JwtConfig;
import com.kpitracking.entity.RefreshToken;
import com.kpitracking.entity.User;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.Terms;
import com.kpitracking.repository.RefreshTokenRepository;
import com.kpitracking.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private final RefreshTokenRepository refreshTokenRepository;
    private final UserRepository userRepository;
    private final JwtConfig jwtConfig;

    /**
     * Ân hạn của token vừa bị xoay. Đủ cho các tab đang chờ cùng một lượt làm mới (vài trăm ms → vài giây trên mạng
     * chậm), đủ ngắn để token lộ ra không dùng lại được lâu.
     */
    public static final java.time.Duration GRACE = java.time.Duration.ofSeconds(30);

    /** Kết quả xác minh: dòng token + có phải khớp qua token TRƯỚC (đang trong ân hạn) không. */
    public record Verified(RefreshToken token, boolean viaGrace, String matchedToken) {}

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    /**
     * Khoá dòng token (SELECT … FOR UPDATE) và đọc lại từ DB trước khi xoay. Hai tab gửi làm mới ĐÚNG cùng lúc: tab
     * sau phải chờ tab trước ghi xong, đọc lại thấy token đã đổi ⇒ đi nhánh ân hạn, nhận đúng phiên mới — không thì
     * cả hai cùng xoay và cookie của tab về sau có thể là token đã bị thay (hết ân hạn là văng ra).
     * Phải gọi trong transaction ghi của nơi xoay.
     */
    public RefreshToken lockForRotation(RefreshToken token) {
        entityManager.refresh(token, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        return token;
    }

    @Transactional
    public RefreshToken createOrUpdateRefreshToken(UUID userId, String deviceInfo) {
        String device = (deviceInfo != null && !deviceInfo.isBlank()) ? deviceInfo : ErrorMessages.text("session.unknownDevice", "");
        if (device.length() > 255) {
            device = device.substring(0, 255);
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "id", userId));

        java.util.Optional<RefreshToken> existingTokenOpt = refreshTokenRepository.findByUserIdAndDeviceInfo(userId, device);
        
        RefreshToken refreshToken;
        if (existingTokenOpt.isPresent()) {
            refreshToken = existingTokenOpt.get();
            // Giữ token cũ thêm một chút (ân hạn) — chỉ khi nó còn hiệu lực, không "hồi sinh" token đã thu hồi.
            if (!Boolean.TRUE.equals(refreshToken.getRevoked()) && refreshToken.getExpiresAt().isAfter(Instant.now())) {
                refreshToken.setPreviousToken(refreshToken.getToken());
                refreshToken.setPreviousValidUntil(Instant.now().plus(GRACE));
            } else {
                refreshToken.setPreviousToken(null);
                refreshToken.setPreviousValidUntil(null);
            }
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

    /**
     * Duyệt lần lượt các ứng viên và nhận cái đầu tiên còn hiệu lực.
     *
     * Trình duyệt có thể gửi nhiều cookie kg_rt trùng tên (một bản host-only cũ, một bản mang
     * Domain gốc). Mỗi lần đăng nhập hay làm mới, createOrUpdateRefreshToken ghi đè token cũ trên
     * cùng một dòng DB, nên bản cũ lập tức vô hiệu. Nếu chỉ thử đúng ứng viên đầu tiên thì người
     * dùng bị đăng xuất vòng lặp: refresh hỏng -> về trang login -> đăng nhập -> lại hỏng.
     */
    /**
     * Như {@link #verifyRefreshToken(List)} nhưng nhận cả token TRƯỚC còn trong ân hạn — cho lượt làm mới phiên.
     * Khớp qua ân hạn thì {@code viaGrace = true}: nơi gọi trả phiên hiện tại, KHÔNG xoay thêm.
     */
    @Transactional(readOnly = true)
    public Verified verifyForRefresh(List<String> candidateTokens) {
        BusinessException lastError = null;
        for (String token : candidateTokens) {
            try {
                return new Verified(verifyRefreshToken(token), false, token);
            } catch (BusinessException e) {
                lastError = e;
            }
        }
        Instant now = Instant.now();
        for (String token : candidateTokens) {
            if (token == null || token.isBlank()) continue;
            var inGrace = refreshTokenRepository.findByPreviousTokenAndPreviousValidUntilAfterAndRevokedFalse(token, now);
            if (inGrace.isPresent() && inGrace.get().getExpiresAt().isAfter(now)) return new Verified(inGrace.get(), true, token);
        }
        throw lastError != null ? lastError : new BusinessException(ErrorCode.REFRESH_TOKEN_MISSING);
    }

    @Transactional(readOnly = true)
    public RefreshToken verifyRefreshToken(List<String> candidateTokens) {
        BusinessException lastError = null;

        for (String token : candidateTokens) {
            try {
                return verifyRefreshToken(token);
            } catch (BusinessException e) {
                lastError = e;
            }
        }

        throw lastError != null ? lastError : new BusinessException(ErrorCode.REFRESH_TOKEN_MISSING);
    }

    @Transactional(readOnly = true)
    public RefreshToken verifyRefreshToken(String token) {
        RefreshToken refreshToken = refreshTokenRepository.findByTokenAndRevokedFalse(token)
                .orElseThrow(() -> new BusinessException(ErrorCode.REFRESH_TOKEN_INVALID_REVOKED));

        if (refreshToken.getExpiresAt().isBefore(Instant.now())) {
            refreshTokenRepository.delete(refreshToken);
            throw new BusinessException(ErrorCode.REFRESH_TOKEN_EXPIRED);
        }

        return refreshToken;
    }

    @Transactional
    public void revokeAllUserTokens(UUID userId) {
        refreshTokenRepository.revokeAllByUserId(userId);
    }

    /**
     * Thu hồi token nếu còn hiệu lực; token lạ / đã thu hồi thì không làm gì. Không ném lỗi — dùng
     * cho đăng xuất, nơi token hỏng là chuyện bình thường. Trả email chủ token để ghi audit.
     */
    @Transactional
    public java.util.Optional<String> revokeIfActive(String token) {
        if (token == null || token.isBlank()) return java.util.Optional.empty();
        // Đăng xuất bằng token vừa bị xoay (tab chưa kịp nhận cookie mới) vẫn phải thu hồi đúng phiên.
        return refreshTokenRepository.findByTokenAndRevokedFalse(token)
                .or(() -> refreshTokenRepository.findByPreviousTokenAndPreviousValidUntilAfterAndRevokedFalse(token, Instant.now()))
                .map(rt -> {
            rt.setRevoked(true);
            refreshTokenRepository.save(rt);
            return rt.getUser().getEmail();
        });
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
