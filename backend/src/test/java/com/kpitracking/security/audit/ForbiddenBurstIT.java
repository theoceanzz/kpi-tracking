package com.kpitracking.security.audit;

import com.kpitracking.security.JwtTokenProvider;
import com.kpitracking.service.EmailService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Lớp 3 chống lỗi gọi API vượt quyền, đi đúng đường thật: nhân viên gọi API của quản lý qua HTTP → 403 từ
 * {@code @PreAuthorize} → GlobalExceptionHandler ghi ACCESS_DENIED → {@link ForbiddenBurstDetector} → lần thứ 10
 * trong 60s sinh một dòng FORBIDDEN_BURST trong security_audit_logs (đúng kịch bản log prod 2026-10-06).
 *
 * <p>Cần DB local (tài khoản mẫu staff@demo.com). Dọn dòng audit đã ghi sau khi chạy.
 * Chạy tay: {@code ./mvnw test -Dtest=ForbiddenBurstIT}.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ForbiddenBurstIT {

    private static final String STAFF = "staff@demo.com";

    @Autowired MockMvc mvc;
    @Autowired JwtTokenProvider jwt;
    @Autowired JdbcTemplate jdbc;
    /** Giả lập: kiểm thư cảnh báo được gửi mà không gửi thư thật. */
    @MockBean EmailService emailService;

    private final Timestamp startedAt = Timestamp.from(Instant.now().minusSeconds(1));

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM security_audit_logs WHERE user_email = ? AND created_at >= ? AND event IN ('ACCESS_DENIED', 'FORBIDDEN_BURST')",
                STAFF, startedAt);
    }

    @Test
    void staffHittingManagerApiTenTimes_raisesOneForbiddenBurst() throws Exception {
        String token = jwt.generateAccessToken(STAFF, List.of());

        for (int i = 0; i < 12; i++) {
            mvc.perform(get("/api/v1/submissions").header("Authorization", "Bearer " + token))
                    .andExpect(status().isForbidden());
        }

        List<String> details = jdbc.queryForList(
                "SELECT detail FROM security_audit_logs WHERE user_email = ? AND event = 'FORBIDDEN_BURST' AND created_at >= ?",
                String.class, STAFF, startedAt);
        assertThat(details).as("đúng MỘT cảnh báo dù 12 lần 403 (lần 11, 12 nằm trong thời gian chờ)").hasSize(1);
        assertThat(details.get(0)).contains("GET /api/v1/submissions x10");
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM security_audit_logs WHERE user_email = ? AND event = 'ACCESS_DENIED' AND created_at >= ?",
                Long.class, STAFF, startedAt)).isEqualTo(12L);
        // Prod không gom log ⇒ cảnh báo đi bằng email (mặc định tới quản trị nền tảng đang hoạt động).
        org.mockito.Mockito.verify(emailService, org.mockito.Mockito.atLeastOnce()).sendEmail(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.contains(STAFF),
                org.mockito.ArgumentMatchers.contains("GET /api/v1/submissions x10"));
    }
}
