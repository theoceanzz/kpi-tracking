package com.kpitracking.service;

import com.kpitracking.entity.RefreshToken;
import com.kpitracking.entity.User;
import com.kpitracking.repository.RefreshTokenRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** {@code revokeIfActive}: thao tác đăng xuất KHÔNG ném lỗi, kể cả với token lạ / đã thu hồi. */
@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceRevokeTest {

    @Mock RefreshTokenRepository refreshTokenRepository;
    @InjectMocks RefreshTokenService refreshTokenService;

    @Test
    void activeToken_isRevokedAndOwnerEmailReturned() {
        RefreshToken token = RefreshToken.builder().token("t1").revoked(false)
                .expiresAt(Instant.now().plusSeconds(3600))
                .user(User.builder().email("a@zam.vn").build()).build();
        when(refreshTokenRepository.findByTokenAndRevokedFalse("t1")).thenReturn(Optional.of(token));

        Optional<String> email = refreshTokenService.revokeIfActive("t1");

        assertThat(email).contains("a@zam.vn");
        assertThat(token.getRevoked()).isTrue();
        verify(refreshTokenRepository).save(token);
    }

    @Test
    void revokedOrUnknownToken_returnsEmptyWithoutSaving() {
        when(refreshTokenRepository.findByTokenAndRevokedFalse("gone")).thenReturn(Optional.empty());

        assertThat(refreshTokenService.revokeIfActive("gone")).isEmpty();
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    void blankToken_doesNotTouchRepository() {
        assertThat(refreshTokenService.revokeIfActive(null)).isEmpty();
        assertThat(refreshTokenService.revokeIfActive("  ")).isEmpty();
        verifyNoInteractions(refreshTokenRepository);
    }
}
