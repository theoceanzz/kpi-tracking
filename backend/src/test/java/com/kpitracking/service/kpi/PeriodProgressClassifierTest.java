package com.kpitracking.service.kpi;

import com.kpitracking.entity.*;
import com.kpitracking.enums.*;
import com.kpitracking.mapper.KpiCriteriaMapper;
import com.kpitracking.repository.EvaluationRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Định nghĩa "KPI ở trạng thái cuối" và tiến độ đợt dùng khi khoá kỳ. */
class PeriodProgressClassifierTest {

    private final KpiCriteriaRepository kpis = mock(KpiCriteriaRepository.class);
    private final EvaluationRepository evaluations = mock(EvaluationRepository.class);
    private final KpiCriteriaMapper mapper = mock(KpiCriteriaMapper.class);
    private final PeriodProgressClassifier classifier = new PeriodProgressClassifier(kpis, evaluations, mapper);

    private final Instant now = Instant.now();
    private User emp;
    private User manager;
    private KpiPeriod period;

    @BeforeEach
    void setUp() {
        emp = User.builder().id(UUID.randomUUID()).build();
        manager = User.builder().id(UUID.randomUUID()).build();
        period = KpiPeriod.builder().id(UUID.randomUUID()).name("T9")
                .startDate(now.minus(Duration.ofDays(20))).endDate(now.plus(Duration.ofDays(5))).build();
        when(mapper.calculateExpected(any(KpiCriteria.class))).thenReturn(1);
    }

    private KpiCriteria approved() {
        return KpiCriteria.builder().id(UUID.randomUUID()).name("K").kpiPeriod(period).status(KpiStatus.APPROVED)
                .frequency(KpiFrequency.MONTHLY).assignees(new ArrayList<>(List.of(emp))).build();
    }

    private void submit(KpiCriteria k, SubmissionStatus st, int minutesAgo) {
        k.getSubmissions().add(KpiSubmission.builder().id(UUID.randomUUID()).submittedBy(emp).status(st)
                .periodStart(Instant.parse("2026-09-01T00:00:00Z")).periodEnd(Instant.parse("2026-09-30T00:00:00Z"))
                .createdAt(now.minus(Duration.ofMinutes(minutesAgo))).build());
    }

    @Test
    @DisplayName("bị từ chối rồi nộp lại (được duyệt) ⇒ chỉ xét lần mới nhất")
    void resubmissionCountsLatestOnly() {
        KpiCriteria k = approved();
        submit(k, SubmissionStatus.REJECTED, 30);
        submit(k, SubmissionStatus.APPROVED, 5);
        assertThat(classifier.bucketOf(k, Set.of(emp.getId()))).isEqualTo(KpiProgressBucket.COMPLETED);
    }

    @Test
    @DisplayName("lần nộp mới nhất bị từ chối ⇒ coi như chưa nộp")
    void latestRejectedIsNotSubmitted() {
        KpiCriteria k = approved();
        submit(k, SubmissionStatus.APPROVED, 30);
        submit(k, SubmissionStatus.REJECTED, 5);
        assertThat(classifier.bucketOf(k, Set.of(emp.getId()))).isEqualTo(KpiProgressBucket.NOT_SUBMITTED);
    }

    @Test
    @DisplayName("nộp đủ, đã duyệt nhưng chưa được quản lý đánh giá ⇒ nhóm riêng 'Chờ đánh giá'")
    void awaitingEvaluation() {
        KpiCriteria k = approved();
        submit(k, SubmissionStatus.APPROVED, 5);
        assertThat(classifier.bucketOf(k, Set.of())).isEqualTo(KpiProgressBucket.AWAITING_EVALUATION);
    }

    @Test
    @DisplayName("bài nộp còn chờ duyệt ⇒ SUBMISSION_PENDING")
    void submissionPending() {
        KpiCriteria k = approved();
        submit(k, SubmissionStatus.PENDING, 5);
        assertThat(classifier.bucketOf(k, Set.of(emp.getId()))).isEqualTo(KpiProgressBucket.SUBMISSION_PENDING);
    }

    @Test
    @DisplayName("bản tự đánh giá không thay được đánh giá của quản lý")
    void selfEvaluationDoesNotCount() {
        KpiCriteria k = approved();
        submit(k, SubmissionStatus.APPROVED, 5);
        when(kpis.findByKpiPeriodIdIn(any())).thenReturn(List.of(k));
        when(evaluations.findByKpiPeriodIdIn(any())).thenReturn(List.of(
                Evaluation.builder().kpiPeriod(period).user(emp).evaluator(emp).build()));
        var snap = classifier.classify(List.of(period), now).get(0);
        assertThat(snap.buckets().get(k.getId())).isEqualTo(KpiProgressBucket.AWAITING_EVALUATION);
        assertThat(snap.progress()).isEqualTo(PeriodProgress.IN_PROGRESS);

        when(evaluations.findByKpiPeriodIdIn(any())).thenReturn(List.of(
                Evaluation.builder().kpiPeriod(period).user(emp).evaluator(manager).build()));
        assertThat(classifier.classify(List.of(period), now).get(0).progress()).isEqualTo(PeriodProgress.COMPLETED);
    }

    @Test
    @DisplayName("đợt: không KPI + quá hạn ⇒ hoàn thành; không KPI chưa quá hạn hoặc chỉ nháp ⇒ chưa bắt đầu")
    void periodProgress() {
        when(evaluations.findByKpiPeriodIdIn(any())).thenReturn(List.of());
        when(kpis.findByKpiPeriodIdIn(any())).thenReturn(List.of());
        assertThat(classifier.classify(List.of(period), now).get(0).progress()).isEqualTo(PeriodProgress.NOT_STARTED);

        period.setEndDate(now.minus(Duration.ofDays(1)));
        assertThat(classifier.classify(List.of(period), now).get(0).progress()).isEqualTo(PeriodProgress.COMPLETED);

        KpiCriteria draft = approved();
        draft.setStatus(KpiStatus.DRAFT);
        when(kpis.findByKpiPeriodIdIn(any())).thenReturn(List.of(draft));
        assertThat(classifier.classify(List.of(period), now).get(0).progress()).isEqualTo(PeriodProgress.NOT_STARTED);
    }

    @Test
    @DisplayName("KPI dừng / bị thay thế / đã chốt do khoá kỳ ⇒ đã ở trạng thái cuối")
    void terminalStatuses() {
        for (KpiStatus st : List.of(KpiStatus.INACTIVE, KpiStatus.REPLACED, KpiStatus.CLOSED_BY_LOCK)) {
            KpiCriteria k = approved();
            k.setStatus(st);
            assertThat(classifier.bucketOf(k, Set.of()).isFinal()).as(st.name()).isTrue();
        }
    }
}
