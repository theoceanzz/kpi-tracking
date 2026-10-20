package com.kpitracking.service;

import com.kpitracking.dto.request.userrole.AssignRoleRequest;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * GET /evaluations/score-preview và /system-score: xem điểm tạm tính của NGƯỜI KHÁC phải có
 * EVALUATION:VIEW / EVALUATION:CREATE ở một đơn vị người đó thuộc (hoặc quản trị tổ chức). Trước đây
 * chỉ cần đăng nhập. Dữ liệu demo: staff@demo.com ở Team Backend, cont.staff@demo.com ở Team Content.
 *
 * <p>Cần DB local (org demo DEMO1). Mỗi test rollback. Chạy tay: {@code ./mvnw test -Dtest=ScorePreviewAccessIT}.
 */
@SpringBootTest
@Transactional
class ScorePreviewAccessIT {

    private static final UUID TEAM_CONTENT = UUID.fromString("ffffffff-ffff-ffff-ffff-ffffffffffff");
    private static final UUID DEMO1 = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID PERIOD = UUID.fromString("44444444-0000-0000-0000-000020260100");

    @Autowired EvaluationService evaluationService;
    @Autowired UserRoleService userRoleService;
    @Autowired JdbcTemplate jdbc;
    @Autowired jakarta.persistence.EntityManager em;

    private UUID staff;

    @BeforeEach
    void setUp() {
        staff = jdbc.queryForObject("SELECT id FROM users WHERE email = 'staff@demo.com'", UUID.class);
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void self_headOfUnit_andDirector_canView() {
        login("staff@demo.com");
        assertThat(evaluationService.getScorePreview(PERIOD, null)).isNotNull();
        assertThat(evaluationService.getScorePreview(PERIOD, staff)).isNotNull();
        login("teamlead@demo.com");
        assertThat(evaluationService.getScorePreview(PERIOD, staff)).isNotNull();
        login("director@demo.com");
        assertThat(evaluationService.getScorePreview(PERIOD, staff)).isNotNull();
        assertThat(evaluationService.getSystemScore(PERIOD, staff)).isNotNull();
    }

    @Test
    void someoneFromAnotherUnit_isRejected() {
        login("cont.staff@demo.com");
        assertThatThrownBy(() -> evaluationService.getScorePreview(PERIOD, staff))
                .isInstanceOf(ForbiddenException.class)
                .extracting(e -> ((ForbiddenException) e).getErrorCode()).isEqualTo(ErrorCode.NO_PERMISSION_VIEW_USER_SCORES);
        assertThatThrownBy(() -> evaluationService.getSystemScore(PERIOD, staff))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void unitWhereThePersonIsSecondary_canView() {
        // staff kiêm nhiệm Team Content ⇒ người có quyền xem đánh giá ở Team Content xem được.
        login("director@demo.com");
        UUID staffRole = jdbc.queryForObject(
                "SELECT id FROM roles WHERE organization_id = ? AND rank = 2 AND deleted_at IS NULL LIMIT 1", UUID.class, DEMO1);
        userRoleService.assignRole(AssignRoleRequest.builder().userId(staff).roleId(staffRole).orgUnitId(TEAM_CONTENT).build());
        em.flush();

        login("cont.staff@demo.com");
        assertThat(evaluationService.getScorePreview(PERIOD, staff)).isNotNull();
    }

    private static void login(String email) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(email, null, List.of()));
    }
}
