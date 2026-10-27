package com.kpitracking.service.evaluation;

import com.kpitracking.service.kpi.KpiEffortShares;

import com.kpitracking.dto.response.evaluation.ScoringReadinessResponse;
import com.kpitracking.entity.kpi.KpiPeriod;
import com.kpitracking.entity.organization.Organization;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.repository.evaluation.EvaluationRepository;
import com.kpitracking.repository.kpi.KpiCriteriaRepository;
import com.kpitracking.repository.submission.KpiSubmissionRepository;
import com.kpitracking.workflow.KpiWorkflowConfigService;
import com.kpitracking.workflow.WorkflowStage;
import com.kpitracking.workflow.def.WorkflowDefinition;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** Luật "khi nào quản lý được chấm đợt" — xem {@link EvaluationReadinessService}. */
class EvaluationReadinessServiceTest {

    private final UUID userId = UUID.randomUUID();
    private final UUID kpiA = UUID.randomUUID();
    private final UUID kpiB = UUID.randomUUID();

    private KpiCriteriaRepository kpiCriteriaRepository;
    private KpiSubmissionRepository kpiSubmissionRepository;
    private EvaluationRepository evaluationRepository;
    private WorkflowDefinition workflow;
    private EvaluationReadinessService service;
    private KpiPeriod period;

    @BeforeEach
    void setUp() {
        kpiCriteriaRepository = mock(KpiCriteriaRepository.class);
        kpiSubmissionRepository = mock(KpiSubmissionRepository.class);
        evaluationRepository = mock(EvaluationRepository.class);
        workflow = mock(WorkflowDefinition.class);
        when(workflow.isStageEnabled(any())).thenReturn(true);
        KpiWorkflowConfigService workflowConfig = mock(KpiWorkflowConfigService.class);
        when(workflowConfig.definitionFor(any())).thenReturn(workflow);
        service = new EvaluationReadinessService(kpiCriteriaRepository, kpiSubmissionRepository,
                evaluationRepository, workflowConfig, mock(KpiEffortShares.class));

        period = KpiPeriod.builder()
                .id(UUID.randomUUID())
                .organization(Organization.builder().id(UUID.randomUUID()).build())
                .startDate(Instant.now().minus(Duration.ofDays(3)))
                .endDate(Instant.now().plus(Duration.ofDays(3)))
                .build();
        // Hai KPI phải nộp: "Chỉnh sửa tài liệu" (A) và "Làm slide" (B).
        when(kpiCriteriaRepository.findRequiredSubmissionKpis(eq(period.getId()), any(), any())).thenReturn(List.of(
                new Object[]{kpiA, "Chỉnh sửa tài liệu", userId},
                new Object[]{kpiB, "Làm slide", userId}));
    }

    private void submitted(UUID... kpis) {
        List<Object[]> rows = new java.util.ArrayList<>();
        for (UUID k : kpis) rows.add(new Object[]{k, userId});
        when(kpiSubmissionRepository.findSubmittedKpiPairs(eq(period.getId()), any(), any())).thenReturn(rows);
    }

    private void selfEvaluated(boolean done) {
        when(evaluationRepository.findSelfEvaluatedUserIds(eq(period.getId()), any()))
                .thenReturn(done ? List.of(userId) : List.of());
    }

    @Test
    @DisplayName("Nộp đủ KPI + đã tự đánh giá ⇒ chấm được")
    void readyWhenAllSubmittedAndSelfEvaluated() {
        submitted(kpiA, kpiB);
        selfEvaluated(true);
        ScoringReadinessResponse r = service.compute(period, userId);
        assertThat(r.isReady()).isTrue();
        assertThat(r.getSubmittedKpiCount()).isEqualTo(2);
        assertThat(r.getMissingKpiNames()).isEmpty();
        service.assertReady(period, userId, "Đức");
    }

    @Test
    @DisplayName("Còn KPI chưa nộp ⇒ chưa chấm được, báo đúng KPI thiếu")
    void notReadyWhenSubmissionMissing() {
        submitted(kpiA);
        selfEvaluated(true);
        ScoringReadinessResponse r = service.compute(period, userId);
        assertThat(r.isReady()).isFalse();
        assertThat(r.getRequiredKpiCount()).isEqualTo(2);
        assertThat(r.getSubmittedKpiCount()).isEqualTo(1);
        assertThat(r.getMissingKpiNames()).containsExactly("Làm slide");
        assertThatThrownBy(() -> service.assertReady(period, userId, "Đức"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.EVALUATION_WAITING_SUBMISSIONS);
    }

    @Test
    @DisplayName("Nộp đủ nhưng chưa tự đánh giá ⇒ chưa chấm được")
    void notReadyWithoutSelfEvaluation() {
        submitted(kpiA, kpiB);
        selfEvaluated(false);
        assertThat(service.compute(period, userId).isReady()).isFalse();
        assertThatThrownBy(() -> service.assertReady(period, userId, "Đức"))
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.EVALUATION_WAITING_SELF_EVALUATION);
    }

    @Test
    @DisplayName("Tổ chức tắt bước tự đánh giá ⇒ chỉ cần nộp đủ")
    void selfEvaluationNotRequiredWhenStageDisabled() {
        when(workflow.isStageEnabled(WorkflowStage.SELF_EVALUATION)).thenReturn(false);
        submitted(kpiA, kpiB);
        ScoringReadinessResponse r = service.compute(period, userId);
        assertThat(r.isSelfEvaluationRequired()).isFalse();
        assertThat(r.isReady()).isTrue();
    }

    @Test
    @DisplayName("Tổ chức tắt bước nộp bài ⇒ không bắt nộp, chỉ cần tự đánh giá")
    void submissionsNotRequiredWhenStageDisabled() {
        when(workflow.isStageEnabled(WorkflowStage.SUBMISSION)).thenReturn(false);
        submitted();
        selfEvaluated(true);
        ScoringReadinessResponse r = service.compute(period, userId);
        assertThat(r.getMissingKpiNames()).isEmpty();
        assertThat(r.isReady()).isTrue();
    }

    @Test
    @DisplayName("Chưa có KPI nào trong đợt ⇒ chưa chấm được trước khi đợt kết thúc")
    void notReadyWithoutKpis() {
        when(kpiCriteriaRepository.findRequiredSubmissionKpis(eq(period.getId()), any(), any())).thenReturn(List.of());
        submitted();
        selfEvaluated(true);
        assertThat(service.compute(period, userId).isReady()).isFalse();
        assertThatThrownBy(() -> service.assertReady(period, userId, "Đức"))
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.EVALUATION_WAITING_NO_KPI);
    }

    @Test
    @DisplayName("Đợt đã kết thúc ⇒ chấm được dù chưa nộp, chưa tự đánh giá")
    void readyAfterPeriodEnds() {
        period.setEndDate(Instant.now().minus(Duration.ofHours(1)));
        submitted();
        selfEvaluated(false);
        ScoringReadinessResponse r = service.compute(period, userId);
        assertThat(r.isPeriodEnded()).isTrue();
        assertThat(r.isReady()).isTrue();
        assertThat(r.getMissingKpiNames()).containsExactly("Chỉnh sửa tài liệu", "Làm slide");
        service.assertReady(period, userId, "Đức");
    }
}
