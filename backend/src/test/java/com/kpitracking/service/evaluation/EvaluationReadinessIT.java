package com.kpitracking.service.evaluation;

import com.kpitracking.dto.response.evaluation.ScoringReadinessResponse;
import com.kpitracking.entity.kpi.KpiCriteria;
import com.kpitracking.entity.kpi.KpiPeriod;
import com.kpitracking.entity.submission.KpiSubmission;
import com.kpitracking.entity.user.User;
import com.kpitracking.enums.kpi.KpiParentRelationType;
import com.kpitracking.enums.kpi.KpiStatus;
import com.kpitracking.repository.evaluation.EvaluationRepository;
import com.kpitracking.repository.kpi.KpiCriteriaRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Ba truy vấn gộp của {@link EvaluationReadinessService} phải ra ĐÚNG số KPI phải nộp / đã nộp / đã
 * tự đánh giá như khi đếm tay từng người qua entity. So trên dữ liệu thật của DB local, chỉ đọc.
 * Chạy tay: {@code ./mvnw test -Dtest=EvaluationReadinessIT}.
 */
@SpringBootTest
@Transactional(readOnly = true)
class EvaluationReadinessIT {

    private static final List<KpiStatus> RUNNING = List.of(KpiStatus.APPROVED, KpiStatus.EDIT, KpiStatus.EDITED);

    @Autowired EvaluationReadinessService service;
    @Autowired KpiCriteriaRepository kpiCriteriaRepository;
    @Autowired EvaluationRepository evaluationRepository;
    @Autowired EntityManager em;

    private boolean required(KpiCriteria k) {
        if (Boolean.TRUE.equals(k.getIsBonusKpi())) return false;
        return k.getChildren() == null || k.getChildren().stream()
                .noneMatch(c -> c.getParentRelationType() == KpiParentRelationType.DECOMPOSITION);
    }

    private boolean counts(KpiSubmission s, Instant now) {
        return switch (s.getStatus()) {
            case PENDING, APPROVED, REJECTED -> true;
            case RETURNED -> s.getResubmission() == null && s.getResubmitDeadline() != null && s.getResubmitDeadline().isBefore(now);
            default -> false;
        };
    }

    @Test
    void batchedQueriesMatchPerUserCount() {
        Instant now = Instant.now();
        List<KpiCriteria> running = em.createQuery(
                "SELECT k FROM KpiCriteria k WHERE k.status IN :s AND k.kpiPeriod IS NOT NULL", KpiCriteria.class)
                .setParameter("s", RUNNING).getResultList();
        Map<KpiPeriod, Set<UUID>> usersByPeriod = new LinkedHashMap<>();
        for (KpiCriteria k : running) {
            for (User u : k.getAssignees()) usersByPeriod.computeIfAbsent(k.getKpiPeriod(), p -> new LinkedHashSet<>()).add(u.getId());
        }
        assertThat(usersByPeriod).as("DB local phải có KPI đang chạy để phép so có nghĩa").isNotEmpty();

        int compared = 0, withMissing = 0;
        for (var e : usersByPeriod.entrySet().stream().limit(6).toList()) {
            KpiPeriod period = e.getKey();
            Map<UUID, ScoringReadinessResponse> batched = service.compute(period, e.getValue());
            for (UUID userId : e.getValue()) {
                List<KpiCriteria> kpis = kpiCriteriaRepository.findByUserIdInAssigneesAndKpiPeriodId(
                        userId, period.getId(), RUNNING, org.springframework.data.domain.Pageable.unpaged()).getContent()
                        .stream().filter(this::required).toList();
                int submitted = 0;
                for (KpiCriteria k : kpis) {
                    List<KpiSubmission> subs = em.createQuery(
                            "SELECT s FROM KpiSubmission s WHERE s.kpiCriteria.id = :k AND s.submittedBy.id = :u AND s.deletedAt IS NULL",
                            KpiSubmission.class).setParameter("k", k.getId()).setParameter("u", userId).getResultList();
                    if (subs.stream().anyMatch(s -> counts(s, now))) submitted++;
                }
                boolean self = evaluationRepository.findByUserIdAndKpiPeriodIdAndEvaluatorId(userId, period.getId(), userId).isPresent();

                ScoringReadinessResponse r = batched.get(userId);
                assertThat(r.getRequiredKpiCount()).as("KPI phải nộp của %s / đợt %s", userId, period.getId()).isEqualTo(kpis.size());
                assertThat(r.getSubmittedKpiCount()).as("KPI đã nộp của %s / đợt %s", userId, period.getId()).isEqualTo(submitted);
                if (r.isSelfEvaluationRequired()) assertThat(r.isSelfEvaluated()).isEqualTo(self);
                compared++;
                if (submitted < kpis.size()) withMissing++;
            }
        }
        assertThat(compared).isPositive();
        System.out.printf("EvaluationReadinessIT: so %d người, %d người còn thiếu bài nộp%n", compared, withMissing);
    }
}
