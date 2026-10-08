package com.kpitracking.service;

import com.kpitracking.entity.RefreshToken;
import com.kpitracking.entity.User;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.repository.RefreshTokenRepository;
import com.kpitracking.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.UnexpectedRollbackException;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Đăng xuất qua proxy {@code @Transactional} THẬT — lỗi "Transaction silently rolled back because it
 * has been marked as rollback-only" chỉ hiện khi có proxy, unit test với mock không bắt được.
 *
 * <p>Cần DB local. Tên kết thúc bằng {@code IT} nên {@code mvn test} mặc định không chạy; chạy tay:
 * {@code ./mvnw test -Dtest=AuthLogoutIT}. Token tạo ra bị xoá ở {@code @AfterEach}.
 */
@SpringBootTest
class AuthLogoutIT {

    @Autowired AuthService authService;
    @Autowired RefreshTokenService refreshTokenService;
    @Autowired RefreshTokenRepository refreshTokenRepository;
    @Autowired UserRepository userRepository;
    @Autowired PlatformTransactionManager txManager;
    @Autowired JdbcTemplate jdbc;

    private final List<String> created = new ArrayList<>();

    @AfterEach
    void cleanUp() {
        created.forEach(t -> jdbc.update("DELETE FROM refresh_tokens WHERE token = ?", t));
    }

    @Test
    void logout_withAlreadyRevokedToken_doesNotThrow() {
        String token = newToken(true, Instant.now().plusSeconds(3600));

        assertThatCode(() -> authService.logout(token)).doesNotThrowAnyException();
    }

    @Test
    void logout_withExpiredToken_doesNotThrow() {
        String token = newToken(false, Instant.now().minusSeconds(60));

        assertThatCode(() -> authService.logout(token)).doesNotThrowAnyException();
    }

    @Test
    void logout_withUnknownToken_doesNotThrow() {
        assertThatCode(() -> authService.logout("not-a-token-" + UUID.randomUUID())).doesNotThrowAnyException();
    }

    @Test
    void logout_withActiveToken_revokesIt() {
        String token = newToken(false, Instant.now().plusSeconds(3600));

        authService.logout(token);

        assertThat(jdbc.queryForObject("SELECT revoked FROM refresh_tokens WHERE token = ?", Boolean.class, token))
                .isTrue();
    }

    /**
     * Nguyên nhân gốc, giữ lại làm tài liệu: gọi {@code verifyRefreshToken} (ném lỗi) qua proxy bên
     * trong một transaction rồi bắt lỗi lại — đúng như {@code logout} cũ — thì commit vẫn nổ.
     */
    @Test
    void rootCause_catchingVerifyErrorInsideOuterTransaction_stillFailsOnCommit() {
        String token = newToken(true, Instant.now().plusSeconds(3600));
        TransactionTemplate tx = new TransactionTemplate(txManager);

        assertThatThrownBy(() -> tx.executeWithoutResult(s -> {
            try {
                refreshTokenService.verifyRefreshToken(token);
            } catch (BusinessException ignored) {
                // logout cũ nuốt lỗi ở đây
            }
        })).isInstanceOf(UnexpectedRollbackException.class);
    }

    private String newToken(boolean revoked, Instant expiresAt) {
        User user = userRepository.findAll(PageRequest.of(0, 1)).stream().findFirst()
                .orElseThrow(() -> new IllegalStateException("DB local chưa có user nào"));
        String token = "it-logout-" + UUID.randomUUID();
        refreshTokenRepository.save(RefreshToken.builder()
                .token(token).user(user).revoked(revoked).expiresAt(expiresAt)
                .deviceInfo("AuthLogoutIT " + token).build());
        created.add(token);
        return token;
    }
}
