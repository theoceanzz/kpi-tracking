package com.kpitracking.service;

import com.kpitracking.dto.response.submission.SubmissionEvaluatorScoreResponse;
import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.entity.KpiSubmissionScore;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.QualitativeLevel;
import com.kpitracking.entity.User;
import com.kpitracking.repository.KpiSubmissionRepository;
import com.kpitracking.repository.KpiSubmissionScoreRepository;
import com.kpitracking.repository.QualitativeLevelRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.security.PermissionChecker;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Sổ điểm theo người chấm (V37): mỗi cấp chấm giữ dòng riêng thay vì cấp sau đè cấp trước, và chỉ người được xem bài
 * mới đọc được điểm.
 */
class SubmissionScoreLedgerTest {

    private KpiSubmissionScoreRepository scoreRepository;
    private KpiSubmissionRepository submissionRepository;
    private UserRepository userRepository;
    private QualitativeLevelRepository levelRepository;
    private PermissionChecker permissionChecker;
    private SubmissionScoreLedger ledger;

    private final UUID unitId = UUID.randomUUID();
    private final UUID periodId = UUID.randomUUID();
    private User manager;
    private User boss;
    private User staff;

    @BeforeEach
    void setUp() {
        scoreRepository = mock(KpiSubmissionScoreRepository.class);
        submissionRepository = mock(KpiSubmissionRepository.class);
        userRepository = mock(UserRepository.class);
        levelRepository = mock(QualitativeLevelRepository.class);
        permissionChecker = mock(PermissionChecker.class);
        ledger = new SubmissionScoreLedger(scoreRepository, submissionRepository, userRepository, levelRepository,
                permissionChecker);
        when(scoreRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        manager = user("Trưởng nhóm");
        boss = user("Giám đốc");
        staff = user("Nhân viên");
    }

    @AfterEach
    void clearLogin() {
        SecurityContextHolder.clearContext();
    }

    private static User user(String name) {
        User u = new User();
        u.setId(UUID.randomUUID());
        u.setFullName(name);
        u.setEmail(UUID.randomUUID() + "@demo.com");
        return u;
    }

    private void login(User u) {
        when(userRepository.findByEmail(u.getEmail())).thenReturn(Optional.of(u));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(u.getEmail(), "n/a", List.of()));
    }

    private KpiSubmission submission(Double score) {
        OrgUnit unit = new OrgUnit();
        unit.setId(unitId);
        KpiSubmission s = new KpiSubmission();
        s.setId(UUID.randomUUID());
        s.setOrgUnit(unit);
        s.setSubmittedBy(staff);
        s.setManagerScore(score);
        return s;
    }

    private KpiSubmissionScore row(KpiSubmission s, User evaluator, Double score, Instant at) {
        return KpiSubmissionScore.builder().id(UUID.randomUUID()).submissionId(s.getId())
                .evaluatorId(evaluator.getId()).managerScore(score).createdAt(at).updatedAt(at).build();
    }

    // ════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("Ghi: người chấm lần đầu thì thêm dòng mới mang điểm của bài")
    void recordInsertsFirstScore() {
        KpiSubmission s = submission(32.0);
        when(scoreRepository.findBySubmissionIdAndEvaluatorId(s.getId(), manager.getId())).thenReturn(Optional.empty());

        ledger.record(s, manager);

        ArgumentCaptor<KpiSubmissionScore> saved = ArgumentCaptor.forClass(KpiSubmissionScore.class);
        verify(scoreRepository).save(saved.capture());
        assertThat(saved.getValue().getSubmissionId()).isEqualTo(s.getId());
        assertThat(saved.getValue().getEvaluatorId()).isEqualTo(manager.getId());
        assertThat(saved.getValue().getManagerScore()).isEqualTo(32.0);
    }

    @Test
    @DisplayName("Ghi: chấm lại thì sửa đúng dòng của mình, giữ nguyên lần chấm đầu (thứ tự cấp)")
    void recordUpdatesOwnRowKeepingCreatedAt() {
        KpiSubmission s = submission(28.0);
        Instant first = Instant.parse("2026-09-01T00:00:00Z");
        KpiSubmissionScore existing = row(s, manager, 32.0, first);
        when(scoreRepository.findBySubmissionIdAndEvaluatorId(s.getId(), manager.getId()))
                .thenReturn(Optional.of(existing));

        ledger.record(s, manager);

        verify(scoreRepository).save(existing);
        assertThat(existing.getManagerScore()).isEqualTo(28.0);
        assertThat(existing.getCreatedAt()).isEqualTo(first);
        assertThat(existing.getUpdatedAt()).isAfter(first);
    }

    @Test
    @DisplayName("Ghi: duyệt mà không chấm điểm lẫn mức thì không ghi gì")
    void recordSkipsWhenNothingScored() {
        ledger.record(submission(null), manager);

        verify(scoreRepository, never()).save(any());
    }

    @Test
    @DisplayName("Đọc: trả cả quản lý lẫn sếp theo thứ tự chấm, kèm tên người và tên mức định tính")
    void readsEveryEvaluatorInOrder() {
        login(staff);
        KpiSubmission quant = submission(30.0);
        KpiSubmission qual = submission(null);
        QualitativeLevel good = new QualitativeLevel();
        good.setId(UUID.randomUUID());
        good.setName("Tốt");
        when(submissionRepository.findByUserAndKpiPeriod(staff.getId(), periodId)).thenReturn(List.of(quant, qual));

        KpiSubmissionScore m = row(quant, manager, 32.0, Instant.parse("2026-09-01T00:00:00Z"));
        KpiSubmissionScore b = row(quant, boss, 30.0, Instant.parse("2026-09-02T00:00:00Z"));
        KpiSubmissionScore q = row(qual, manager, null, Instant.parse("2026-09-01T00:00:00Z"));
        q.setQualitativeLevelId(good.getId());
        when(scoreRepository.findBySubmissionIdInOrderByCreatedAtAsc(anyCollection())).thenReturn(List.of(m, q, b));
        when(userRepository.findAllById(any())).thenReturn(List.of(manager, boss));
        when(levelRepository.findAllById(any())).thenReturn(List.of(good));
        when(permissionChecker.getBestRoleNameInOrgUnit(manager.getId(), unitId)).thenReturn("Trưởng phòng");
        when(permissionChecker.getBestRoleNameInOrgUnit(boss.getId(), unitId)).thenReturn("Giám đốc");

        List<SubmissionEvaluatorScoreResponse> out = ledger.forUserPeriod(staff.getId(), periodId);

        assertThat(out).extracting(SubmissionEvaluatorScoreResponse::evaluatorName)
                .containsExactly("Trưởng nhóm", "Trưởng nhóm", "Giám đốc");
        assertThat(out).extracting(SubmissionEvaluatorScoreResponse::managerScore).containsExactly(32.0, null, 30.0);
        assertThat(out.get(1).qualitativeLevelName()).isEqualTo("Tốt");
        assertThat(out.get(2).evaluatorRoleName()).isEqualTo("Giám đốc");
    }

    @Test
    @DisplayName("Đọc: người không phải cấp trên của người nộp thì không thấy điểm")
    void hidesScoresFromNonSuperiors() {
        User peer = user("Đồng nghiệp");
        login(peer);
        KpiSubmission s = submission(30.0);
        when(submissionRepository.findByUserAndKpiPeriod(staff.getId(), periodId)).thenReturn(List.of(s));
        when(permissionChecker.isGlobalAdminIn(peer.getId(), unitId)).thenReturn(false);
        when(permissionChecker.hasAnyPermissionInOrgUnit(eq(peer.getId()), eq(unitId), any())).thenReturn(true);
        when(permissionChecker.isSuperiorTo(peer.getId(), staff.getId(), unitId)).thenReturn(false);

        assertThat(ledger.forUserPeriod(staff.getId(), periodId)).isEmpty();
        verify(scoreRepository, never()).findBySubmissionIdInOrderByCreatedAtAsc(anyCollection());
    }
}
