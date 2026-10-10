package com.kpitracking.service;

import com.kpitracking.dto.response.auth.AuthResponse;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Ân hạn của refresh token vừa bị xoay (V40) trên PostgreSQL thật: nhiều tab cùng làm mới phiên một lúc không đá
 * nhau ra trang đăng nhập. Cần DB local. Dọn token đã tạo. Chạy tay: {@code ./mvnw test -Dtest=RefreshTokenGraceIT}.
 */
@SpringBootTest
class RefreshTokenGraceIT {

    @Autowired AuthService authService;
    @Autowired RefreshTokenService refreshTokenService;
    @Autowired UserRepository userRepository;
    @Autowired JdbcTemplate jdbc;

    private UUID userId;
    private String device;

    @BeforeEach
    void setUp() {
        userId = userRepository.findByEmail("staff@demo.com").orElseThrow().getId();
        device = "RefreshTokenGraceIT " + UUID.randomUUID();
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM refresh_tokens WHERE device_info = ?", device);
    }

    private String login() {
        return refreshTokenService.createOrUpdateRefreshToken(userId, device).getToken();
    }

    private String currentToken() {
        return jdbc.queryForObject("SELECT token FROM refresh_tokens WHERE device_info = ?", String.class, device);
    }

    @Test
    void normalRefresh_rotatesToken() {
        String t1 = login();
        AuthResponse r = authService.refreshToken(List.of(t1));
        assertThat(r.getRefreshToken()).isNotEqualTo(t1).isEqualTo(currentToken());
    }

    @Test
    void tokenJustRotated_isAcceptedWithinGrace_andGetsCurrentSession_withoutRotatingAgain() {
        String t1 = login();
        String t2 = authService.refreshToken(List.of(t1)).getRefreshToken(); // tab A làm mới xong

        AuthResponse b = authService.refreshToken(List.of(t1)); // tab B tới chậm, vẫn cầm t1

        assertThat(b.getRefreshToken()).as("tab B nhận đúng phiên hiện tại").isEqualTo(t2);
        assertThat(currentToken()).as("không xoay thêm").isEqualTo(t2);
        assertThat(b.getAccessToken()).isNotBlank();
    }

    @Test
    void tokenRotatedLongAgo_isRejected() {
        String t1 = login();
        authService.refreshToken(List.of(t1));
        jdbc.update("UPDATE refresh_tokens SET previous_valid_until = now() - interval '1 second' WHERE device_info = ?", device);

        assertThatThrownBy(() -> authService.refreshToken(List.of(t1))).isInstanceOf(BusinessException.class);
    }

    @Test
    void tokenTwoRotationsBack_isRejected() {
        String t1 = login();
        String t2 = authService.refreshToken(List.of(t1)).getRefreshToken();
        authService.refreshToken(List.of(t2)); // xoay lần nữa: t1 không còn là "token trước"

        assertThatThrownBy(() -> authService.refreshToken(List.of(t1))).isInstanceOf(BusinessException.class);
    }

    @Test
    void logoutWithJustRotatedToken_revokesSession_andGraceNoLongerWorks() {
        String t1 = login();
        String t2 = authService.refreshToken(List.of(t1)).getRefreshToken();

        authService.logout(t1); // tab chưa kịp nhận cookie mới bấm Đăng xuất

        assertThatThrownBy(() -> authService.refreshToken(List.of(t2))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> authService.refreshToken(List.of(t1))).isInstanceOf(BusinessException.class);
    }

    @Test
    void twoTabsRefreshingAtTheSameMoment_bothSucceed_andEndOnTheSameSession() throws Exception {
        String t1 = login();
        CountDownLatch go = new CountDownLatch(1);
        Callable<String> tab = () -> {
            go.await();
            return authService.refreshToken(List.of(t1)).getRefreshToken();
        };
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<String> a = pool.submit(tab);
            Future<String> b = pool.submit(tab);
            go.countDown();
            String ra = a.get();
            String rb = b.get();
            assertThat(ra).as("hai tab cùng một phiên — cookie về sau cùng vẫn là token hiện hành").isEqualTo(rb);
            assertThat(ra).isEqualTo(currentToken());
        } finally {
            pool.shutdownNow();
        }
    }
}
