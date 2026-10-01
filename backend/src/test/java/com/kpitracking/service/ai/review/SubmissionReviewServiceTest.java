package com.kpitracking.service.ai.review;

import com.kpitracking.ai.review.ReviewRun;
import com.kpitracking.ai.review.SubmissionReviewWorkflow;
import com.kpitracking.dto.request.ai.AiSubmissionReviewRequest;
import com.kpitracking.dto.response.ai.AiSubmissionReviewResponse;
import com.kpitracking.entity.AiSubmissionReview;
import com.kpitracking.entity.OrgHierarchyLevel;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.AiReviewStatus;
import com.kpitracking.event.AiReviewEvents;
import com.kpitracking.exception.AiTokenQuotaExceededException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.mapper.AiSubmissionReviewMapper;
import com.kpitracking.repository.AiSubmissionReviewItemRepository;
import com.kpitracking.repository.AiSubmissionReviewRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.AiQuotaService;
import com.kpitracking.service.AiRateLimiter;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Nửa "yêu cầu" (chốt chặn trước khi tốn token) và nửa "chạy nền" (lỗi thì FAILED, có danh tính cho sổ token).
 */
class SubmissionReviewServiceTest {

    private ReviewContextBuilder contextBuilder;
    private SubmissionReviewWorkflow workflow;
    private ReviewRecorder recorder;
    private AiSubmissionReviewRepository reviewRepository;
    private OrganizationRepository organizationRepository;
    private AiRateLimiter rateLimiter;
    private AiQuotaService quota;
    private ApplicationEventPublisher events;
    private AiSubmissionReviewMapper mapper;
    private SubmissionReviewService service;
    private AiReviewSettingsResolver resolver;
    private OrgUnitRepository orgUnits;
    private UserRoleOrgUnitRepository assignments;

    private final User me = new User();
    private final Organization org = new Organization();
    private final UUID periodId = UUID.randomUUID();
    private final UUID staffId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        contextBuilder = mock(ReviewContextBuilder.class);
        workflow = mock(SubmissionReviewWorkflow.class);
        recorder = mock(ReviewRecorder.class);
        reviewRepository = mock(AiSubmissionReviewRepository.class);
        organizationRepository = mock(OrganizationRepository.class);
        rateLimiter = mock(AiRateLimiter.class);
        quota = mock(AiQuotaService.class);
        events = mock(ApplicationEventPublisher.class);
        mapper = mock(AiSubmissionReviewMapper.class);
        UserRepository userRepository = mock(UserRepository.class);

        resolver = mock(AiReviewSettingsResolver.class);
        orgUnits = mock(OrgUnitRepository.class);
        assignments = mock(UserRoleOrgUnitRepository.class);

        service = new SubmissionReviewService(contextBuilder, resolver, workflow, recorder, reviewRepository,
                mock(AiSubmissionReviewItemRepository.class), mock(KpiCriteriaRepository.class), organizationRepository,
                userRepository, assignments, mapper, rateLimiter, quota, events, orgUnits,
                mock(com.kpitracking.repository.KpiSubmissionRepository.class),
                mock(com.kpitracking.repository.QualitativeLevelRepository.class));
        when(resolver.resolve(any(), any())).thenReturn(
                new AiReviewSettingsResolver.Effective(true, new ReviewContext.Weights(60, 30, 10), null, "công ty"));

        me.setId(UUID.randomUUID());
        me.setEmail("head@demo.com");
        org.setId(UUID.randomUUID());
        org.setEnableAi(true);
        org.setEnableAiReview(true);
        when(userRepository.findByEmail("head@demo.com")).thenReturn(Optional.of(me));
        when(contextBuilder.requireCanReview(me.getId(), staffId)).thenReturn(org);
        when(reviewRepository.save(any())).thenAnswer(inv -> {
            AiSubmissionReview r = inv.getArgument(0);
            if (r.getId() == null) r.setId(UUID.randomUUID());
            return r;
        });
        when(mapper.toResponse(any())).thenAnswer(inv -> {
            AiSubmissionReview r = inv.getArgument(0);
            return AiSubmissionReviewResponse.builder().id(r.getId()).status(r.getStatus()).build();
        });
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("head@demo.com", null, List.of()));
    }

    @Test
    @DisplayName("mức gợi ý cho định tính: mức có % gần nhất với điểm hành vi; bằng nhau thì lấy mức thấp hơn")
    void nearestLevel() {
        var scale = ReviewScoreCalculator.DEFAULT_SCALE;   // KÉM 0 · YẾU 20 · TRUNG BÌNH 50 · KHÁ 75 · TỐT 100
        assertThat(SubmissionReviewService.nearestLevel(scale, 92.5)).isEqualTo("TỐT");
        assertThat(SubmissionReviewService.nearestLevel(scale, 81)).isEqualTo("KHÁ");
        assertThat(SubmissionReviewService.nearestLevel(scale, 87.5)).isEqualTo("KHÁ");   // cách đều 75 và 100
        assertThat(SubmissionReviewService.nearestLevel(scale, 5)).isEqualTo("KÉM");
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private AiSubmissionReviewRequest req() {
        return new AiSubmissionReviewRequest(periodId, staffId);
    }

    @Test
    @DisplayName("yêu cầu hợp lệ -> ghi QUEUED rồi phát sự kiện chạy nền")
    void queuesAndPublishes() {
        AiSubmissionReviewResponse r = service.request(req());

        assertThat(r.getStatus()).isEqualTo(AiReviewStatus.QUEUED);
        verify(events).publishEvent(any(AiReviewEvents.Requested.class));
    }

    @Test
    @DisplayName("hết hạn mức -> không ghi lượt, không phát sự kiện, không gọi mô hình")
    void quotaExceededStopsBeforeAnyWork() {
        doThrow(new AiTokenQuotaExceededException("hết hạn mức")).when(quota).checkAndThrow(anyString());

        assertThatThrownBy(() -> service.request(req())).isInstanceOf(AiTokenQuotaExceededException.class);
        verify(reviewRepository, never()).save(any());
        verify(events, never()).publishEvent(any());
    }

    @Test
    @DisplayName("tổ chức chưa bật tính năng -> 403, không kiểm hạn mức")
    void disabledFeatureIsForbidden() {
        org.setEnableAiReview(false);

        assertThatThrownBy(() -> service.request(req())).isInstanceOf(ForbiddenException.class);
        verify(quota, never()).checkAndThrow(anyString());
    }

    @Test
    @DisplayName("công ty bật nhưng đơn vị của nhân viên tắt -> 403, không kiểm hạn mức")
    void unitDisabledIsForbidden() {
        when(resolver.resolve(org, staffId)).thenReturn(
                new AiReviewSettingsResolver.Effective(false, new ReviewContext.Weights(60, 30, 10), UUID.randomUUID(), "đơn vị"));

        assertThatThrownBy(() -> service.request(req())).isInstanceOf(ForbiddenException.class);
        verify(quota, never()).checkAndThrow(anyString());
    }

    @Test
    @DisplayName("chạy theo lô: kiểm hạn mức MỘT lần; bỏ qua người ngoài phạm vi / không có chỉ tiêu / chính mình")
    void batchQueuesOnlyReviewablePeople() {
        OrgHierarchyLevel level = new OrgHierarchyLevel();
        level.setOrganization(org);
        OrgUnit unit = new OrgUnit();
        unit.setId(UUID.randomUUID());
        unit.setPath("/a/");
        unit.setOrgHierarchyLevel(level);
        when(orgUnits.findById(unit.getId())).thenReturn(Optional.of(unit));
        when(orgUnits.findSubtree("/a/", org.getId())).thenReturn(List.of(unit));

        UUID outsider = UUID.randomUUID();
        UUID noKpi = UUID.randomUUID();
        when(assignments.findByOrgUnitIdIn(any())).thenReturn(List.of(
                member(me.getId()), member(staffId), member(outsider), member(noKpi)));
        when(contextBuilder.requireCanReview(me.getId(), outsider)).thenThrow(new ForbiddenException("x"));
        when(contextBuilder.requireCanReview(me.getId(), noKpi)).thenReturn(org);
        when(contextBuilder.hasCriteria(periodId, staffId)).thenReturn(true);
        when(contextBuilder.hasCriteria(periodId, noKpi)).thenReturn(false);

        SubmissionReviewService.BatchResult r = service.batch(periodId, unit.getId());

        assertThat(r).isEqualTo(new SubmissionReviewService.BatchResult(1, 0, 2));
        verify(quota).checkAndThrow("head@demo.com");
        verify(events).publishEvent(any(AiReviewEvents.Requested.class));
    }

    private static UserRoleOrgUnit member(UUID userId) {
        User u = new User();
        u.setId(userId);
        UserRoleOrgUnit a = new UserRoleOrgUnit();
        a.setUser(u);
        return a;
    }

    @Test
    @DisplayName("người ngoài phạm vi -> 403 (kiểm quyền chạy trước mọi thứ)")
    void outOfScopeIsForbidden() {
        when(contextBuilder.requireCanReview(me.getId(), staffId)).thenThrow(new ForbiddenException("x"));

        assertThatThrownBy(() -> service.request(req())).isInstanceOf(ForbiddenException.class);
        verify(events, never()).publishEvent(any());
    }

    @Test
    @DisplayName("đã có lượt DONE và bài nộp không đổi -> trả lượt cũ, không chấm lại, không tính tần suất")
    void doesNotRerunWhenNothingChanged() {
        AiSubmissionReview done = AiSubmissionReview.builder().id(UUID.randomUUID()).kpiPeriodId(periodId)
                .userId(staffId).status(AiReviewStatus.DONE).createdAt(Instant.now()).build();
        when(reviewRepository.findFirstByKpiPeriodIdAndUserIdOrderByCreatedAtDesc(periodId, staffId))
                .thenReturn(Optional.of(done));
        when(reviewRepository.countSubmissionsChangedSince(eq(staffId), eq(periodId), any())).thenReturn(0L);

        AiSubmissionReviewResponse r = service.request(req());

        assertThat(r.getId()).isEqualTo(done.getId());
        verify(rateLimiter, never()).check(anyString());
        verify(events, never()).publishEvent(any());
    }

    @Test
    @DisplayName("bài nộp đã đổi sau lượt DONE -> chấm lại")
    void rerunsWhenSubmissionsChanged() {
        AiSubmissionReview done = AiSubmissionReview.builder().id(UUID.randomUUID()).kpiPeriodId(periodId)
                .userId(staffId).status(AiReviewStatus.DONE).createdAt(Instant.now()).build();
        when(reviewRepository.findFirstByKpiPeriodIdAndUserIdOrderByCreatedAtDesc(periodId, staffId))
                .thenReturn(Optional.of(done));
        when(reviewRepository.countSubmissionsChangedSince(eq(staffId), eq(periodId), any())).thenReturn(2L);

        service.request(req());

        verify(events).publishEvent(any(AiReviewEvents.Requested.class));
    }

    @Test
    @DisplayName("chạy nền: mô hình lỗi -> FAILED có thông điệp; danh tính người bấm có trong SecurityContext khi chạy")
    void executeFailureMarksFailedAndRunsAsRequester() {
        UUID reviewId = UUID.randomUUID();
        SecurityContextHolder.clearContext();   // luồng @Async thật không có SecurityContext
        when(recorder.markRunning(reviewId)).thenReturn(AiSubmissionReview.builder().id(reviewId)
                .organizationId(org.getId()).kpiPeriodId(periodId).userId(staffId).status(AiReviewStatus.RUNNING).build());
        when(organizationRepository.findById(org.getId())).thenReturn(Optional.of(org));
        AtomicReference<String> seenAs = new AtomicReference<>();
        doAnswer(inv -> {
            seenAs.set(SecurityContextHolder.getContext().getAuthentication().getName());
            throw new RuntimeException("mô hình sập");
        }).when(workflow).run(any(ReviewRun.class));

        service.execute(reviewId, "head@demo.com");

        assertThat(seenAs.get()).isEqualTo("head@demo.com");
        verify(recorder).fail(eq(reviewId), anyString(), any());
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();   // đã trả lại như cũ
    }

    @Test
    @DisplayName("chạy nền: lượt đã được luồng khác nhận -> bỏ qua, không chạy lần hai")
    void executeSkipsWhenNotQueued() {
        UUID reviewId = UUID.randomUUID();
        when(recorder.markRunning(reviewId)).thenReturn(null);

        service.execute(reviewId, "head@demo.com");

        verify(workflow, never()).run(any());
    }
}
