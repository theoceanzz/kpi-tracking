package com.kpitracking.service;

import com.kpitracking.dto.response.submission.SubmissionEvaluatorScoreResponse;
import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.entity.KpiSubmissionScore;
import com.kpitracking.entity.QualitativeLevel;
import com.kpitracking.entity.User;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.Terms;
import com.kpitracking.repository.KpiSubmissionRepository;
import com.kpitracking.repository.KpiSubmissionScoreRepository;
import com.kpitracking.repository.QualitativeLevelRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.security.PermissionChecker;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Sổ điểm từng chỉ tiêu theo TỪNG người chấm (V37). {@link KpiSubmissionService} vẫn ghi điểm của người chấm cuối vào
 * {@code kpi_submissions} như cũ; sổ này giữ lại điểm của mọi cấp để màn chấm hiện "Quản lý chấm" và "Sếp chấm" cạnh
 * nhau thay vì cấp sau đè mất cấp trước.
 */
@Service
@RequiredArgsConstructor
public class SubmissionScoreLedger {

    private final KpiSubmissionScoreRepository scoreRepository;
    private final KpiSubmissionRepository submissionRepository;
    private final UserRepository userRepository;
    private final QualitativeLevelRepository qualitativeLevelRepository;
    private final PermissionChecker permissionChecker;

    /**
     * Ghi điểm của {@code evaluator} cho bài này, SAU khi đã đặt điểm / mức lên bài. Gọi trong transaction của luồng
     * duyệt. Không có điểm lẫn mức (duyệt không chấm) thì không ghi.
     */
    @Transactional
    public void record(KpiSubmission submission, User evaluator) {
        if (submission.getId() == null || evaluator == null) return;
        if (submission.getManagerScore() == null && submission.getQualitativeLevel() == null) return;
        KpiSubmissionScore row = scoreRepository
                .findBySubmissionIdAndEvaluatorId(submission.getId(), evaluator.getId())
                .orElseGet(() -> KpiSubmissionScore.builder()
                        .submissionId(submission.getId()).evaluatorId(evaluator.getId()).build());
        row.setManagerScore(submission.getManagerScore());
        row.setQualitativeLevelId(submission.getQualitativeLevel() == null ? null : submission.getQualitativeLevel().getId());
        row.setUpdatedAt(Instant.now());
        scoreRepository.save(row);
    }

    /**
     * Điểm theo người chấm của mọi bài một người nộp trong một đợt, sắp theo lần chấm đầu. Bài nào người xem không được
     * xem thì bỏ qua — cùng luật với duyệt bài: chính người đó, quản trị, hoặc người duyệt được và là cấp trên của họ.
     */
    @Transactional(readOnly = true)
    public List<SubmissionEvaluatorScoreResponse> forUserPeriod(UUID userId, UUID kpiPeriodId) {
        User me = currentUser();
        List<KpiSubmission> submissions = submissionRepository.findByUserAndKpiPeriod(userId, kpiPeriodId).stream()
                .filter(s -> canView(me, s))
                .toList();
        if (submissions.isEmpty()) return List.of();
        Map<UUID, KpiSubmission> byId = new HashMap<>();
        submissions.forEach(s -> byId.put(s.getId(), s));

        List<KpiSubmissionScore> rows = scoreRepository.findBySubmissionIdInOrderByCreatedAtAsc(byId.keySet());
        Map<UUID, User> users = new HashMap<>();
        userRepository.findAllById(rows.stream().map(KpiSubmissionScore::getEvaluatorId).distinct().toList())
                .forEach(u -> users.put(u.getId(), u));
        Map<UUID, String> levels = new HashMap<>();
        qualitativeLevelRepository.findAllById(rows.stream().map(KpiSubmissionScore::getQualitativeLevelId)
                        .filter(java.util.Objects::nonNull).distinct().toList())
                .forEach((QualitativeLevel l) -> levels.put(l.getId(), l.getName()));
        Map<String, String> roleNames = new HashMap<>();

        return rows.stream().map(r -> {
            KpiSubmission s = byId.get(r.getSubmissionId());
            User u = users.get(r.getEvaluatorId());
            UUID unitId = s.getOrgUnit() == null ? null : s.getOrgUnit().getId();
            String role = unitId == null ? null : roleNames.computeIfAbsent(r.getEvaluatorId() + ":" + unitId,
                    k -> permissionChecker.getBestRoleNameInOrgUnit(r.getEvaluatorId(), unitId));
            return new SubmissionEvaluatorScoreResponse(r.getSubmissionId(), r.getEvaluatorId(),
                    u == null ? null : u.getFullName(), role, r.getManagerScore(), r.getQualitativeLevelId(),
                    r.getQualitativeLevelId() == null ? null : levels.get(r.getQualitativeLevelId()),
                    r.getCreatedAt(), r.getUpdatedAt());
        }).toList();
    }

    private boolean canView(User me, KpiSubmission s) {
        if (s.getSubmittedBy() != null && me.getId().equals(s.getSubmittedBy().getId())) return true;
        if (s.getOrgUnit() == null || s.getSubmittedBy() == null) return false;
        UUID unitId = s.getOrgUnit().getId();
        if (permissionChecker.isGlobalAdminIn(me.getId(), unitId)) return true;
        return permissionChecker.hasAnyPermissionInOrgUnit(me.getId(), unitId, "SUBMISSION:REVIEW", "SUBMISSION:VIEW")
                && permissionChecker.isSuperiorTo(me.getId(), s.getSubmittedBy().getId(), unitId);
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "email", email));
    }
}
