package com.kpitracking.ai.submission.review;

import com.kpitracking.dto.request.ai.AiReviewSettingsRequest;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.ai.submission.review.ReviewRun;
import com.kpitracking.ai.submission.review.SubmissionReviewWorkflow;
import com.kpitracking.dto.request.ai.AiSubmissionReviewRequest;
import com.kpitracking.dto.response.ai.AiSubmissionReviewItemResponse;
import com.kpitracking.dto.response.ai.AiSubmissionReviewResponse;
import com.kpitracking.entity.ai.AiSubmissionReview;
import com.kpitracking.entity.ai.AiSubmissionReviewItem;
import com.kpitracking.entity.organization.Organization;
import com.kpitracking.entity.user.User;
import com.kpitracking.enums.ai.AiReviewStatus;
import com.kpitracking.event.AiReviewEvents;
import com.kpitracking.exception.AiTokenQuotaExceededException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.mapper.AiSubmissionReviewMapper;
import com.kpitracking.repository.ai.AiSubmissionReviewItemRepository;
import com.kpitracking.repository.ai.AiSubmissionReviewRepository;
import com.kpitracking.repository.kpi.KpiCriteriaRepository;
import com.kpitracking.repository.organization.OrganizationRepository;
import com.kpitracking.repository.user.UserRepository;
import com.kpitracking.repository.user.UserRoleOrgUnitRepository;
import com.kpitracking.service.ai.AiQuotaService;
import com.kpitracking.service.ai.AiRateLimiter;
import org.mockito.ArgumentCaptor;
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
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
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
    private UserRoleOrgUnitRepository assignments;
    private AiSubmissionReviewItemRepository itemRepository;
    private com.kpitracking.repository.ai.AiReviewLevelRepository levelRepository;
    private com.kpitracking.repository.submission.KpiSubmissionRepository submissionRepository;
    /** Item theo lượt — giả lập bảng ai_submission_review_items cho {@code findAllByReviewIdIn}. */
    private final java.util.Map<UUID, List<AiSubmissionReviewItem>> itemsByRun = new java.util.HashMap<>();

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
        assignments = mock(UserRoleOrgUnitRepository.class);

        itemRepository = mock(AiSubmissionReviewItemRepository.class);
        levelRepository = mock(com.kpitracking.repository.ai.AiReviewLevelRepository.class);
        submissionRepository = mock(com.kpitracking.repository.submission.KpiSubmissionRepository.class);
        when(itemRepository.findAllByReviewIdIn(anyCollection())).thenAnswer(inv -> {
            java.util.Collection<UUID> ids = inv.getArgument(0);
            return ids.stream().flatMap(id -> itemsByRun.getOrDefault(id, List.of()).stream()).toList();
        });
        service = new SubmissionReviewService(contextBuilder, resolver, workflow, recorder, reviewRepository,
                itemRepository, mock(KpiCriteriaRepository.class), organizationRepository,
                userRepository, assignments, mapper, rateLimiter, quota, events,
                submissionRepository,
                levelRepository,
                new AiReviewLatestView(itemRepository));
        when(resolver.resolve(any(), any())).thenReturn(
                new AiReviewSettingsResolver.Effective(true, null, "công ty"));
        when(resolver.aiScale(any())).thenReturn(AiReviewSettingsResolver.AiScale.EMPTY);

        me.setId(UUID.randomUUID());
        me.setEmail("head@demo.com");
        org.setId(UUID.randomUUID());
        org.setEnableAi(true);
        org.setEnableAiReview(true);
        when(userRepository.findByEmail("head@demo.com")).thenReturn(Optional.of(me));
        when(contextBuilder.requireCanReview(me.getId(), staffId)).thenReturn(org);
        when(contextBuilder.reviewableCriteria(periodId, staffId)).thenReturn(Set.of(kpiA, kpiB));
        when(reviewRepository.save(any())).thenAnswer(inv -> {
            AiSubmissionReview r = inv.getArgument(0);
            if (r.getId() == null) r.setId(UUID.randomUUID());
            return r;
        });
        when(mapper.toResponse(any())).thenAnswer(inv -> {
            AiSubmissionReview r = inv.getArgument(0);
            return AiSubmissionReviewResponse.builder().id(r.getId()).status(r.getStatus()).build();
        });
        when(mapper.toItemResponse(any())).thenAnswer(inv -> {
            AiSubmissionReviewItem i = inv.getArgument(0);
            return AiSubmissionReviewItemResponse.builder().id(i.getId()).kpiCriteriaId(i.getKpiCriteriaId())
                    .suggestedScore(i.getSuggestedScore()).build();
        });
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("head@demo.com", null, List.of()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    /** Yêu cầu chấm một chỉ tiêu (nút "Gợi ý" ở một ô) — từ 06/10 không còn yêu cầu chấm cả phiếu. */
    private AiSubmissionReviewRequest req() {
        return new AiSubmissionReviewRequest(periodId, staffId, List.of(kpiA), null);
    }

    @Test
    @DisplayName("yêu cầu không ghi chỉ tiêu (chấm cả phiếu) -> 400, không tốn gì")
    void requestWithoutCriteriaIsRejected() {
        assertThatThrownBy(() -> service.request(new AiSubmissionReviewRequest(periodId, staffId, null, null)))
                .isInstanceOf(com.kpitracking.exception.BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.AI_REVIEW_CRITERIA_REQUIRED);
        assertThatThrownBy(() -> service.request(new AiSubmissionReviewRequest(periodId, staffId, List.of(), null)))
                .extracting("errorCode").isEqualTo(ErrorCode.AI_REVIEW_CRITERIA_REQUIRED);
        verify(contextBuilder, never()).requireCanReview(any(), any());
        verify(reviewRepository, never()).save(any());
    }

    @Test
    @DisplayName("chỉ tiêu đã / đang xin tạm dừng -> 403 nói rõ lý do tạm dừng, không tạo lượt")
    void pausedCriterionIsRejected() {
        UUID paused = UUID.randomUUID();
        when(contextBuilder.pausedCriteria(periodId, staffId)).thenReturn(Set.of(paused));

        assertThatThrownBy(() -> service.request(scoped(false, paused)))
                .isInstanceOf(ForbiddenException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.AI_REVIEW_CRITERIA_PAUSED);
        verify(reviewRepository, never()).save(any());
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
                new AiReviewSettingsResolver.Effective(false, UUID.randomUUID(), "đơn vị"));

        assertThatThrownBy(() -> service.request(req())).isInstanceOf(ForbiddenException.class);
        verify(quota, never()).checkAndThrow(anyString());
    }

    @Test
    @DisplayName("người ngoài phạm vi -> 403 (kiểm quyền chạy trước mọi thứ)")
    void outOfScopeIsForbidden() {
        when(contextBuilder.requireCanReview(me.getId(), staffId)).thenThrow(new ForbiddenException("x"));

        assertThatThrownBy(() -> service.request(req())).isInstanceOf(ForbiddenException.class);
        verify(events, never()).publishEvent(any());
    }

    @Test
    @DisplayName("bài của chỉ tiêu đã đổi sau lần chấm trước -> chấm lại chỉ tiêu đó")
    void rerunsWhenSubmissionsChanged() {
        AiSubmissionReview done = run(AiReviewStatus.DONE, Instant.now());
        item(done, kpiA, 30);
        when(reviewRepository.findByKpiPeriodIdAndUserIdOrderByCreatedAtDesc(periodId, staffId)).thenReturn(List.of(done));
        when(reviewRepository.countCriterionSubmissionsChangedSince(eq(staffId), eq(kpiA), any())).thenReturn(2L);

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

    // ── chấm từng bài (06/10) ─────────────────────────────────────────────────

    private final UUID kpiA = UUID.randomUUID();
    private final UUID kpiB = UUID.randomUUID();

    private AiSubmissionReview run(AiReviewStatus status, Instant at, UUID... scope) {
        AiSubmissionReview r = AiSubmissionReview.builder().id(UUID.randomUUID()).organizationId(org.getId())
                .kpiPeriodId(periodId).userId(staffId).status(status).createdAt(at)
                .scopeCriteriaIds(AiReviewLatestView.scopeColumn(List.of(scope))).build();
        itemsByRun.put(r.getId(), new java.util.ArrayList<>());
        return r;
    }

    private AiSubmissionReviewItem item(AiSubmissionReview run, UUID kpi, double score) {
        AiSubmissionReviewItem i = AiSubmissionReviewItem.builder().id(UUID.randomUUID()).reviewId(run.getId())
                .kpiCriteriaId(kpi).suggestedScore(java.math.BigDecimal.valueOf(score)).build();
        itemsByRun.get(run.getId()).add(i);
        return i;
    }

    private AiSubmissionReviewRequest scoped(boolean force, UUID... kpis) {
        return new AiSubmissionReviewRequest(periodId, staffId, List.of(kpis), force);
    }

    @Test
    @DisplayName("chấm một bài: chỉ tiêu không thuộc phiếu của người này -> 403, không tốn gì")
    void scopedRejectsCriterionNotOnSheet() {
        when(contextBuilder.reviewableCriteria(periodId, staffId)).thenReturn(Set.of(kpiA));

        assertThatThrownBy(() -> service.request(scoped(false, UUID.randomUUID())))
                .isInstanceOf(ForbiddenException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.AI_REVIEW_CRITERIA_NOT_ON_SHEET);
        verify(rateLimiter, never()).check(anyString());
        verify(reviewRepository, never()).save(any());
    }

    @Test
    @DisplayName("\"Gợi ý tất cả\" có dòng không thuộc phiếu AI (KPI thưởng) -> bỏ dòng đó, chấm phần còn lại")
    void scopedDropsCriteriaNotOnSheet() {
        when(contextBuilder.reviewableCriteria(periodId, staffId)).thenReturn(Set.of(kpiA));
        when(reviewRepository.findByKpiPeriodIdAndUserIdOrderByCreatedAtDesc(periodId, staffId)).thenReturn(List.of());

        service.request(scoped(false, kpiA, UUID.randomUUID()));

        ArgumentCaptor<AiSubmissionReview> saved = ArgumentCaptor.forClass(AiSubmissionReview.class);
        verify(reviewRepository).save(saved.capture());
        assertThat(AiReviewLatestView.scopeOf(saved.getValue())).containsExactly(kpiA);
    }

    @Test
    @DisplayName("chấm một bài đã có kết quả và bài không đổi -> trả bản gộp, không tạo lượt, không tính tần suất")
    void scopedReusesUnchangedCriterion() {
        when(contextBuilder.reviewableCriteria(periodId, staffId)).thenReturn(Set.of(kpiA, kpiB));
        AiSubmissionReview full = run(AiReviewStatus.DONE, Instant.now());
        item(full, kpiA, 30);
        item(full, kpiB, 20);
        when(reviewRepository.findByKpiPeriodIdAndUserIdOrderByCreatedAtDesc(periodId, staffId)).thenReturn(List.of(full));
        when(reviewRepository.countCriterionSubmissionsChangedSince(eq(staffId), eq(kpiA), any())).thenReturn(0L);

        AiSubmissionReviewResponse r = service.request(scoped(false, kpiA));

        assertThat(r.getItems()).hasSize(2);
        verify(rateLimiter, never()).check(anyString());
        verify(events, never()).publishEvent(any());
    }

    @Test
    @DisplayName("\"Chấm lại bài này\" (force) -> lượt mới CHỈ cho chỉ tiêu đó")
    void scopedForceQueuesOnlyThatCriterion() {
        when(contextBuilder.reviewableCriteria(periodId, staffId)).thenReturn(Set.of(kpiA, kpiB));
        AiSubmissionReview full = run(AiReviewStatus.DONE, Instant.now());
        item(full, kpiA, 30);
        item(full, kpiB, 20);
        when(reviewRepository.findByKpiPeriodIdAndUserIdOrderByCreatedAtDesc(periodId, staffId)).thenReturn(List.of(full));

        service.request(scoped(true, kpiA));

        ArgumentCaptor<AiSubmissionReview> saved = ArgumentCaptor.forClass(AiSubmissionReview.class);
        verify(reviewRepository).save(saved.capture());
        assertThat(AiReviewLatestView.scopeOf(saved.getValue())).containsExactly(kpiA);
        verify(rateLimiter).check("head@demo.com");
        verify(events).publishEvent(any(AiReviewEvents.Requested.class));
    }

    @Test
    @DisplayName("\"Gợi ý tất cả\": bỏ chỉ tiêu đã có kết quả còn dùng được và chỉ tiêu đang chấm, chấm phần còn lại")
    void scopedSkipsReusableAndRunning() {
        UUID kpiC = UUID.randomUUID();
        when(contextBuilder.reviewableCriteria(periodId, staffId)).thenReturn(Set.of(kpiA, kpiB, kpiC));
        AiSubmissionReview full = run(AiReviewStatus.DONE, Instant.now().minusSeconds(600));
        item(full, kpiA, 30);
        AiSubmissionReview runningB = run(AiReviewStatus.RUNNING, Instant.now(), kpiB);
        when(reviewRepository.findByKpiPeriodIdAndUserIdOrderByCreatedAtDesc(periodId, staffId))
                .thenReturn(List.of(runningB, full));
        when(reviewRepository.countCriterionSubmissionsChangedSince(eq(staffId), eq(kpiA), any())).thenReturn(0L);

        service.request(scoped(false, kpiA, kpiB, kpiC));

        ArgumentCaptor<AiSubmissionReview> saved = ArgumentCaptor.forClass(AiSubmissionReview.class);
        verify(reviewRepository).save(saved.capture());
        assertThat(AiReviewLatestView.scopeOf(saved.getValue())).containsExactly(kpiC);
    }

    @Test
    @DisplayName("kết quả hiện hành: mỗi chỉ tiêu lấy item của lượt mới nhất có chấm nó; báo chỉ tiêu đang chấm")
    void latestMergesNewestItemPerCriterion() {
        AiSubmissionReview full = run(AiReviewStatus.DONE, Instant.now().minusSeconds(600));
        item(full, kpiA, 30);
        item(full, kpiB, 20);
        AiSubmissionReview redoA = run(AiReviewStatus.DONE, Instant.now().minusSeconds(60), kpiA);
        AiSubmissionReviewItem newA = item(redoA, kpiA, 35);
        AiSubmissionReview runningB = run(AiReviewStatus.QUEUED, Instant.now(), kpiB);
        when(reviewRepository.findByKpiPeriodIdAndUserIdOrderByCreatedAtDesc(periodId, staffId))
                .thenReturn(List.of(runningB, redoA, full));

        AiSubmissionReviewResponse r = service.latest(periodId, staffId);

        assertThat(r.getId()).isEqualTo(full.getId());               // phần chung lấy từ lượt cả phiếu
        assertThat(r.getStatus()).isEqualTo(AiReviewStatus.DONE);    // lượt lẻ đang chạy không làm cả phiếu "đang chạy"
        assertThat(r.getItems()).extracting(AiSubmissionReviewItemResponse::getKpiCriteriaId).containsExactlyInAnyOrder(kpiA, kpiB);
        assertThat(r.getItems()).filteredOn(i -> i.getKpiCriteriaId().equals(kpiA)).singleElement()
                .satisfies(i -> {
                    assertThat(i.getId()).isEqualTo(newA.getId());
                    assertThat(i.getReviewedAt()).isEqualTo(redoA.getCreatedAt());
                });
        assertThat(r.getRunningCriteriaIds()).containsExactly(kpiB);
    }

    @Test
    @DisplayName("lượt lẻ lỗi mới hơn kết quả đang có -> chỉ tiêu đó báo lỗi để giao diện hiện \"Thử lại\"")
    void latestReportsFailedScopedRun() {
        AiSubmissionReview full = run(AiReviewStatus.DONE, Instant.now().minusSeconds(600));
        item(full, kpiA, 30);
        AiSubmissionReview failedA = run(AiReviewStatus.FAILED, Instant.now(), kpiA);
        when(reviewRepository.findByKpiPeriodIdAndUserIdOrderByCreatedAtDesc(periodId, staffId))
                .thenReturn(List.of(failedA, full));

        assertThat(service.latest(periodId, staffId).getFailedCriteriaIds()).containsExactly(kpiA);
    }

    @Test
    @DisplayName("kết quả hiện hành chỉ gồm chỉ tiêu còn trên phiếu AI — kết quả cũ của chỉ tiêu nay đã tạm dừng bị ẩn")
    void latestHidesCriteriaNoLongerOnSheet() {
        UUID pausedKpi = UUID.randomUUID();
        AiSubmissionReview full = run(AiReviewStatus.DONE, Instant.now());
        item(full, kpiA, 30);
        item(full, pausedKpi, 3.5);
        when(reviewRepository.findByKpiPeriodIdAndUserIdOrderByCreatedAtDesc(periodId, staffId)).thenReturn(List.of(full));

        assertThat(service.latest(periodId, staffId).getItems())
                .extracting(AiSubmissionReviewItemResponse::getKpiCriteriaId).containsExactly(kpiA);
    }

    @Test
    @DisplayName("bấm Gợi ý ô đầu tiên (chưa có lượt nào xong) -> chỉ đúng chỉ tiêu đó báo đang chấm")
    void firstQueuedRunMarksOnlyItsRow() {
        AiSubmissionReview queued = run(AiReviewStatus.QUEUED, Instant.now(), kpiA);
        when(reviewRepository.findByKpiPeriodIdAndUserIdOrderByCreatedAtDesc(periodId, staffId)).thenReturn(List.of(queued));

        assertThat(service.latest(periodId, staffId).getRunningCriteriaIds()).containsExactly(kpiA);
    }

    @Test
    @DisplayName("lượt chấm lẻ đang chạy không làm trạng thái chung thành \"đang chạy\" khi đã có lượt xong")
    void finishedRunIsTheBase() {
        AiSubmissionReview failed = run(AiReviewStatus.FAILED, Instant.now().minusSeconds(60), kpiB);
        AiSubmissionReview queued = run(AiReviewStatus.QUEUED, Instant.now(), kpiA);
        when(reviewRepository.findByKpiPeriodIdAndUserIdOrderByCreatedAtDesc(periodId, staffId)).thenReturn(List.of(queued, failed));

        AiSubmissionReviewResponse r = service.latest(periodId, staffId);
        assertThat(r.getStatus()).isEqualTo(AiReviewStatus.FAILED);
        assertThat(r.getRunningCriteriaIds()).containsExactly(kpiA);
    }

    @Test
    @DisplayName("lượt cả phiếu cũ còn chạy dở -> mọi chỉ tiêu của phiếu báo đang chấm theo từng id")
    void legacyFullRunInFlightMarksEveryRow() {
        AiSubmissionReview full = run(AiReviewStatus.RUNNING, Instant.now());
        when(reviewRepository.findByKpiPeriodIdAndUserIdOrderByCreatedAtDesc(periodId, staffId)).thenReturn(List.of(full));

        assertThat(service.latest(periodId, staffId).getRunningCriteriaIds()).containsExactlyInAnyOrder(kpiA, kpiB);
    }

    /** Thang điểm AI của công ty (V48): KÉM · TRUNG BÌNH · TỐT = 0 · ½ · trọn `max` điểm. */
    private static AiReviewSettingsResolver.AiScale dbScale(double max) {
        String[] names = {"KÉM", "TRUNG BÌNH", "TỐT"};
        double[] share = {0, 0.5, 1};
        java.util.List<com.kpitracking.entity.ai.AiReviewLevel> rows = new java.util.ArrayList<>();
        for (int i = 0; i < names.length; i++) {
            rows.add(com.kpitracking.entity.ai.AiReviewLevel.builder().name(names[i]).position(i + 1)
                    .points(java.math.BigDecimal.valueOf(share[i] * max)).build());
        }
        return AiReviewSettingsResolver.scaleOf(rows);
    }

    @Test
    @DisplayName("mức tin cậy tính LẠI lúc đọc theo chất lượng: kết quả cũ lưu 'Cao' mà chất lượng KÉM -> trả 'Thấp'")
    void latestRecomputesConfidenceFromQuality() {
        when(resolver.aiScale(org.getId())).thenReturn(dbScale(10));
        AiSubmissionReview done = run(AiReviewStatus.DONE, Instant.now());
        AiSubmissionReviewItem poor = item(done, kpiA, 17.5);
        poor.setKpiSubmissionId(UUID.randomUUID());
        poor.setQualityLevel("KÉM");
        poor.setConfidence("CAO");   // luật cũ
        AiSubmissionReviewItem good = item(done, kpiB, 24);
        good.setKpiSubmissionId(UUID.randomUUID());
        good.setQualityLevel("TỐT");
        when(reviewRepository.findByKpiPeriodIdAndUserIdOrderByCreatedAtDesc(periodId, staffId)).thenReturn(List.of(done));

        var items = service.latest(periodId, staffId).getItems();

        assertThat(items).filteredOn(i -> i.getKpiCriteriaId().equals(kpiA)).singleElement().satisfies(i -> {
            assertThat(i.getConfidence()).isEqualTo("THAP");
            assertThat(i.getConfidenceReasons()).containsExactly(ReviewResultValidator.REASON_QUALITY_LOW);
        });
        assertThat(items).filteredOn(i -> i.getKpiCriteriaId().equals(kpiB)).singleElement()
                .satisfies(i -> assertThat(i.getConfidence()).isEqualTo("CAO"));
    }

    @Test
    @DisplayName("điểm AI tính LẠI lúc đọc theo thang điểm AI: điểm của mức đã chọn — kết quả cũ chấm theo 60/30/10 cũng ra thang mới")
    void latestRecomputesScoreOnAiScale() {
        when(resolver.aiScale(org.getId())).thenReturn(dbScale(20));
        AiSubmissionReview done = run(AiReviewStatus.DONE, Instant.now());
        AiSubmissionReviewItem mid = item(done, kpiA, 32.2);   // điểm cũ trên thang đánh giá
        mid.setQualityLevel("TRUNG BÌNH");
        AiSubmissionReviewItem noLevel = item(done, kpiB, 24);   // không chấm được chất lượng -> không có điểm
        when(reviewRepository.findByKpiPeriodIdAndUserIdOrderByCreatedAtDesc(periodId, staffId)).thenReturn(List.of(done));

        var items = service.latest(periodId, staffId).getItems();

        assertThat(items).filteredOn(i -> i.getKpiCriteriaId().equals(kpiA)).singleElement().satisfies(i -> {
            assertThat(i.getMaxPoints()).isEqualByComparingTo("20");
            assertThat(i.getSuggestedScore()).isEqualByComparingTo("10");   // TRUNG BÌNH 50% × 20
        });
        assertThat(items).filteredOn(i -> i.getKpiCriteriaId().equals(kpiB)).singleElement()
                .satisfies(i -> assertThat(i.getSuggestedScore()).isNull());
    }

    @Test
    @DisplayName("kết quả AI của bài đã TRẢ LẠI không còn là kết quả hiện hành — ô về Gợi ý, Xem đánh giá không hiện điểm cũ")
    void resultOfReturnedSubmissionIsDropped() {
        AiSubmissionReview done = run(AiReviewStatus.DONE, Instant.now());
        AiSubmissionReviewItem old = item(done, kpiA, 30);
        old.setKpiSubmissionId(UUID.randomUUID());
        AiSubmissionReviewItem live = item(done, kpiB, 20);
        live.setKpiSubmissionId(UUID.randomUUID());
        com.kpitracking.entity.submission.KpiSubmission returned = new com.kpitracking.entity.submission.KpiSubmission();
        returned.setId(old.getKpiSubmissionId());
        returned.setStatus(com.kpitracking.enums.submission.SubmissionStatus.RETURNED);
        com.kpitracking.entity.submission.KpiSubmission pending = new com.kpitracking.entity.submission.KpiSubmission();
        pending.setId(live.getKpiSubmissionId());
        pending.setStatus(com.kpitracking.enums.submission.SubmissionStatus.PENDING);
        when(submissionRepository.findAllById(any())).thenReturn(List.of(returned, pending));
        when(reviewRepository.findByKpiPeriodIdAndUserIdOrderByCreatedAtDesc(periodId, staffId)).thenReturn(List.of(done));

        assertThat(service.latest(periodId, staffId).getItems())
                .extracting(AiSubmissionReviewItemResponse::getKpiCriteriaId).containsExactly(kpiB);
    }

    @Test
    @DisplayName("lưu thang điểm AI: 1 mức, tên trùng, hoặc mức cao nhất 0 điểm -> từ chối, không ghi gì")
    void invalidAiScaleIsRejected() {
        java.util.function.Function<Object[][], AiReviewSettingsRequest> req = rows -> AiReviewSettingsRequest.builder()
                .enabled(true).levels(java.util.Arrays.stream(rows).map(r -> AiReviewSettingsRequest.Level.builder()
                        .name((String) r[0]).points(java.math.BigDecimal.valueOf((Double) r[1])).build()).toList()).build();

        for (AiReviewSettingsRequest bad : List.of(
                req.apply(new Object[][]{{"Tốt", 10.0}}),
                req.apply(new Object[][]{{"Khá", 5.0}, {" khá ", 10.0}}),
                req.apply(new Object[][]{{"Kém", 0.0}, {"Tốt", 0.0}}))) {
            assertThatThrownBy(() -> service.updateSettings(bad)).isInstanceOf(BusinessException.class)
                    .extracting("errorCode").isEqualTo(com.kpitracking.exception.ErrorCode.AI_REVIEW_LEVELS_INVALID);
        }
        verifyNoInteractions(levelRepository);
    }
}
