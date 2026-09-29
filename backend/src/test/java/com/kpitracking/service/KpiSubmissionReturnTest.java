package com.kpitracking.service;

import com.kpitracking.dto.request.submission.BulkReviewRequest;
import com.kpitracking.dto.request.submission.CreateSubmissionRequest;
import com.kpitracking.dto.request.submission.ReturnSubmissionRequest;
import com.kpitracking.dto.response.submission.SubmissionResponse;
import com.kpitracking.entity.*;
import com.kpitracking.enums.KpiFrequency;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.event.KpiEvents.SubmissionReturnedEvent;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.mapper.SubmissionMapper;
import com.kpitracking.repository.EvaluationRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiSubmissionRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.kpi.CycleStatusGuard;
import com.kpitracking.workflow.KpiWorkflowConfigService;
import com.kpitracking.workflow.StageRegistry;
import com.kpitracking.workflow.def.WorkflowDefinitionFactory;
import com.kpitracking.workflow.engine.WorkflowEngine;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Hoàn duyệt bài nộp: người chấm trả bài về để nhân viên làm lại bằng bài nộp mới trước hạn nộp lại.
 * Máy trạng thái là thật (không mock) để kiểm đúng luật chuyển trạng thái.
 */
class KpiSubmissionReturnTest {

    private static final Instant NOW = Instant.now();

    private KpiSubmissionRepository submissionRepository;
    private KpiCriteriaRepository kpiCriteriaRepository;
    private UserRepository userRepository;
    private PermissionChecker permissionChecker;
    private EvaluationRepository evaluationRepository;
    private ApplicationEventPublisher events;
    private KpiSubmissionService service;

    private final UUID unitId = UUID.randomUUID();
    private User reviewer;
    private User submitter;
    private KpiPeriod period;
    private KpiCriteria kpi;

    @BeforeEach
    void setUp() {
        submissionRepository = mock(KpiSubmissionRepository.class);
        kpiCriteriaRepository = mock(KpiCriteriaRepository.class);
        userRepository = mock(UserRepository.class);
        permissionChecker = mock(PermissionChecker.class);
        evaluationRepository = mock(EvaluationRepository.class);
        events = mock(ApplicationEventPublisher.class);
        SubmissionMapper mapper = mock(SubmissionMapper.class);

        StageRegistry registry = new StageRegistry();
        KpiWorkflowConfigService workflowConfig = mock(KpiWorkflowConfigService.class);
        when(workflowConfig.definitionFor(any())).thenReturn(new WorkflowDefinitionFactory(registry).buildDefault());

        service = new KpiSubmissionService(submissionRepository, kpiCriteriaRepository, null, userRepository, null,
                mapper, events, permissionChecker, null, workflowConfig, new WorkflowEngine(registry),
                mock(CycleStatusGuard.class), evaluationRepository);

        when(submissionRepository.save(any())).thenAnswer(inv -> {
            KpiSubmission s = inv.getArgument(0);
            if (s.getId() == null) s.setId(UUID.randomUUID());
            return s;
        });
        when(mapper.toResponse(any())).thenAnswer(inv -> new SubmissionResponse());

        reviewer = user("truong@demo.com", "Trưởng phòng");
        submitter = user("nhanvien@demo.com", "Nhân viên");
        when(userRepository.findByEmail(reviewer.getEmail())).thenReturn(Optional.of(reviewer));
        when(userRepository.findByEmail(submitter.getEmail())).thenReturn(Optional.of(submitter));
        login(reviewer);

        when(permissionChecker.hasAnyPermissionInOrgUnit(eq(reviewer.getId()), eq(unitId), any())).thenReturn(true);
        when(permissionChecker.isSuperiorTo(reviewer.getId(), submitter.getId(), unitId)).thenReturn(true);

        Organization org = Organization.builder().id(UUID.randomUUID()).build();
        OrgHierarchyLevel level = OrgHierarchyLevel.builder().id(UUID.randomUUID()).organization(org).build();
        OrgUnit unit = OrgUnit.builder().id(unitId).name("Phòng A").orgHierarchyLevel(level).build();
        // Đợt ĐÃ HẾT HẠN — tình huống thường gặp lúc chấm đợt.
        period = KpiPeriod.builder().id(UUID.randomUUID()).name("Tháng 9")
                .startDate(NOW.minus(Duration.ofDays(40))).endDate(NOW.minus(Duration.ofDays(5)))
                .periodType(KpiFrequency.MONTHLY).build();
        kpi = KpiCriteria.builder().id(UUID.randomUUID()).name("Doanh thu").orgUnit(unit).kpiPeriod(period)
                .status(KpiStatus.APPROVED).frequency(KpiFrequency.MONTHLY)
                .assignees(new ArrayList<>(List.of(submitter))).build();
        when(kpiCriteriaRepository.findById(kpi.getId())).thenReturn(Optional.of(kpi));
    }

    @AfterEach
    void clearLogin() {
        SecurityContextHolder.clearContext();
    }

    private static User user(String email, String name) {
        User u = new User();
        u.setId(UUID.randomUUID());
        u.setEmail(email);
        u.setFullName(name);
        return u;
    }

    private static void login(User u) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(u.getEmail(), "n/a", List.of()));
    }

    private KpiSubmission submission(SubmissionStatus status) {
        KpiSubmission s = KpiSubmission.builder().id(UUID.randomUUID()).kpiCriteria(kpi).orgUnit(kpi.getOrgUnit())
                .submittedBy(submitter).status(status).actualValue(80.0).createdAt(NOW.minus(Duration.ofDays(10))).build();
        kpi.getSubmissions().add(s);
        when(submissionRepository.findById(s.getId())).thenReturn(Optional.of(s));
        return s;
    }

    private static ReturnSubmissionRequest returnReq(Instant deadline) {
        return ReturnSubmissionRequest.builder().reason("Thiếu minh chứng doanh thu").resubmitDeadline(deadline).build();
    }

    private static ErrorCode codeOf(Throwable t) {
        return ((BusinessException) t).getErrorCode();
    }

    @Test
    @DisplayName("Trả lại bài ĐÃ DUYỆT ⇒ RETURNED, lưu lý do + hạn, bắn sự kiện thông báo")
    void returnsApprovedSubmission() {
        KpiSubmission s = submission(SubmissionStatus.APPROVED);
        Instant deadline = NOW.plus(Duration.ofDays(3));

        service.returnSubmission(s.getId(), returnReq(deadline));

        assertThat(s.getStatus()).isEqualTo(SubmissionStatus.RETURNED);
        assertThat(s.getReturnedBy()).isSameAs(reviewer);
        assertThat(s.getReturnReason()).isEqualTo("Thiếu minh chứng doanh thu");
        assertThat(s.getResubmitDeadline()).isEqualTo(deadline);
        assertThat(s.isAwaitingResubmission(NOW)).isTrue();
        verify(events).publishEvent(any(SubmissionReturnedEvent.class));
    }

    @Test
    @DisplayName("Chỉ trả lại được bài CHỜ DUYỆT / ĐÃ DUYỆT / BỊ TỪ CHỐI — nháp và bài đã trả lại thì không")
    void onlyReviewableStatesCanBeReturned() {
        KpiSubmission pending = submission(SubmissionStatus.PENDING);
        service.returnSubmission(pending.getId(), returnReq(NOW.plus(Duration.ofDays(1))));
        assertThat(pending.getStatus()).isEqualTo(SubmissionStatus.RETURNED);

        KpiSubmission draft = submission(SubmissionStatus.DRAFT);
        assertThatThrownBy(() -> service.returnSubmission(draft.getId(), returnReq(NOW.plus(Duration.ofDays(1)))))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(ErrorCode.SUBMISSION_CANNOT_BE_RETURNED_IN_STATUS));

        assertThatThrownBy(() -> service.returnSubmission(pending.getId(), returnReq(NOW.plus(Duration.ofDays(1)))))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(ErrorCode.SUBMISSION_CANNOT_BE_RETURNED_IN_STATUS));
    }

    @Test
    @DisplayName("Hạn nộp lại phải ở tương lai")
    void deadlineMustBeInFuture() {
        KpiSubmission s = submission(SubmissionStatus.PENDING);
        assertThatThrownBy(() -> service.returnSubmission(s.getId(), returnReq(NOW.minus(Duration.ofHours(1)))))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(ErrorCode.RESUBMIT_DEADLINE_MUST_BE_IN_FUTURE));
        assertThat(s.getStatus()).isEqualTo(SubmissionStatus.PENDING);
    }

    @Test
    @DisplayName("Đã có bản đánh giá đợt của cấp quản lý ⇒ chặn; chỉ có tự đánh giá ⇒ vẫn trả lại được")
    void blockedAfterManagerEvaluation() {
        KpiSubmission s = submission(SubmissionStatus.APPROVED);
        Evaluation self = new Evaluation();
        self.setUser(submitter);
        self.setEvaluator(submitter);
        when(evaluationRepository.findByUserIdAndKpiPeriodId(submitter.getId(), period.getId())).thenReturn(List.of(self));
        service.returnSubmission(s.getId(), returnReq(NOW.plus(Duration.ofDays(2))));
        assertThat(s.getStatus()).isEqualTo(SubmissionStatus.RETURNED);

        KpiSubmission other = submission(SubmissionStatus.APPROVED);
        Evaluation byManager = new Evaluation();
        byManager.setUser(submitter);
        byManager.setEvaluator(reviewer);
        when(evaluationRepository.findByUserIdAndKpiPeriodId(submitter.getId(), period.getId()))
                .thenReturn(List.of(self, byManager));
        assertThatThrownBy(() -> service.returnSubmission(other.getId(), returnReq(NOW.plus(Duration.ofDays(2)))))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(ErrorCode.SUBMISSION_RETURN_AFTER_EVALUATION_FINALIZED));
        assertThat(other.getStatus()).isEqualTo(SubmissionStatus.APPROVED);
    }

    @Test
    @DisplayName("Người không đứng trên người nộp ⇒ 403, không ghi gì")
    void nonSuperiorCannotReturn() {
        KpiSubmission s = submission(SubmissionStatus.PENDING);
        when(permissionChecker.isSuperiorTo(reviewer.getId(), submitter.getId(), unitId)).thenReturn(false);
        assertThatThrownBy(() -> service.returnSubmission(s.getId(), returnReq(NOW.plus(Duration.ofDays(1)))))
                .isInstanceOf(ForbiddenException.class);
        verify(submissionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Phiếu chốt đánh giá (duyệt hàng loạt) bỏ qua bài đã trả lại")
    void bulkReviewSkipsReturned() {
        KpiSubmission s = submission(SubmissionStatus.RETURNED);
        BulkReviewRequest r = new BulkReviewRequest();
        ReflectionTestUtils.setField(r, "submissionIds", List.of(s.getId()));
        assertThat(service.bulkReview(r)).isEmpty();
        assertThat(s.getStatus()).isEqualTo(SubmissionStatus.RETURNED);
    }

    @Test
    @DisplayName("Nhân viên nộp bài mới sau khi đợt hết hạn nhờ bài bị trả lại còn hạn; bài mới nối vào bài cũ")
    void resubmitAfterPeriodEnd() {
        KpiSubmission returned = submission(SubmissionStatus.RETURNED);
        returned.setReturnedAt(NOW.minus(Duration.ofDays(1)));
        returned.setResubmitDeadline(NOW.plus(Duration.ofDays(2)));
        when(submissionRepository.findByKpiCriteriaIdAndSubmittedByIdAndDeletedAtIsNull(kpi.getId(), submitter.getId()))
                .thenReturn(new ArrayList<>(List.of(returned)));
        login(submitter);

        CreateSubmissionRequest req = new CreateSubmissionRequest();
        ReflectionTestUtils.setField(req, "kpiCriteriaId", kpi.getId());
        ReflectionTestUtils.setField(req, "actualValue", 95.0);
        ReflectionTestUtils.setField(req, "isDraft", false);
        ReflectionTestUtils.setField(req, "periodStart", LocalDate.ofInstant(period.getStartDate(), ZoneOffset.UTC));
        ReflectionTestUtils.setField(req, "periodEnd", LocalDate.ofInstant(period.getEndDate(), ZoneOffset.UTC));

        service.createSubmission(req);

        assertThat(returned.getResubmission()).isNotNull();
        assertThat(returned.getResubmission().getActualValue()).isEqualTo(95.0);
        assertThat(returned.isAwaitingResubmission(NOW)).isFalse();
    }

    @Test
    @DisplayName("Không có bài bị trả lại còn hạn ⇒ đợt hết hạn vẫn chặn nộp như cũ")
    void noOpenReturnStillBlockedAfterPeriodEnd() {
        KpiSubmission expired = submission(SubmissionStatus.RETURNED);
        expired.setResubmitDeadline(NOW.minus(Duration.ofHours(1)));
        when(submissionRepository.findByKpiCriteriaIdAndSubmittedByIdAndDeletedAtIsNull(kpi.getId(), submitter.getId()))
                .thenReturn(new ArrayList<>(List.of(expired)));
        login(submitter);

        CreateSubmissionRequest req = new CreateSubmissionRequest();
        ReflectionTestUtils.setField(req, "kpiCriteriaId", kpi.getId());
        ReflectionTestUtils.setField(req, "actualValue", 95.0);
        ReflectionTestUtils.setField(req, "isDraft", false);

        assertThatThrownBy(() -> service.createSubmission(req))
                .satisfies(t -> assertThat(codeOf(t)).isEqualTo(ErrorCode.EVALUATION_PERIOD_ENDED));
    }
}
