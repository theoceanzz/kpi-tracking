package com.kpitracking.ai.submission.review;

import com.kpitracking.ai.submission.review.ReviewRun;
import com.kpitracking.ai.submission.review.SubmissionReviewWorkflow;
import com.kpitracking.dto.request.ai.AiReviewSettingsRequest;
import com.kpitracking.dto.request.ai.AiSubmissionReviewRequest;
import com.kpitracking.dto.response.ai.AiReviewSettingsResponse;
import com.kpitracking.dto.response.ai.AiSubmissionReviewItemResponse;
import com.kpitracking.dto.response.ai.AiSubmissionReviewResponse;
import com.kpitracking.entity.ai.AiSubmissionReview;
import com.kpitracking.entity.kpi.KpiCriteria;
import com.kpitracking.entity.organization.Organization;
import com.kpitracking.entity.user.User;
import com.kpitracking.entity.user.UserRoleOrgUnit;
import com.kpitracking.enums.ai.AiReviewStatus;
import com.kpitracking.event.AiReviewEvents;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.AiSubmissionReviewMapper;
import com.kpitracking.repository.ai.AiSubmissionReviewItemRepository;
import com.kpitracking.repository.ai.AiSubmissionReviewRepository;
import com.kpitracking.repository.kpi.KpiCriteriaRepository;
import com.kpitracking.repository.organization.OrganizationRepository;
import com.kpitracking.repository.user.UserRepository;
import com.kpitracking.repository.user.UserRoleOrgUnitRepository;
import com.kpitracking.service.ai.AiQuotaService;
import com.kpitracking.service.ai.AiRateLimiter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Điều phối tính năng AI đọc bài nộp và đề xuất điểm.
 *
 * <p><b>Luật bất di bất dịch:</b> không có đường nào từ đây ghi vào {@code evaluations} hay
 * {@code kpi_submissions}. Kết quả chỉ để tham khảo; điểm vào hồ sơ là con số quản lý bấm ở luồng chấm
 * hiện có.
 *
 * <p>Chia hai nửa: {@link #request} chạy trên luồng request (kiểm quyền, cờ, tần suất, hạn mức — đều cần
 * SecurityContext) rồi ghi {@code QUEUED} và phát sự kiện; {@link #execute} chạy nền (listener
 * {@code @Async}) và đi qua {@link SubmissionReviewWorkflow}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SubmissionReviewService {

    private final ReviewContextBuilder contextBuilder;
    private final AiReviewSettingsResolver settingsResolver;
    private final SubmissionReviewWorkflow workflow;
    private final ReviewRecorder recorder;
    private final AiSubmissionReviewRepository reviewRepository;
    private final AiSubmissionReviewItemRepository itemRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final AiSubmissionReviewMapper mapper;
    private final AiRateLimiter aiRateLimiter;
    private final AiQuotaService aiQuotaService;
    private final ApplicationEventPublisher events;
    private final com.kpitracking.repository.submission.KpiSubmissionRepository kpiSubmissionRepository;
    private final com.kpitracking.repository.ai.AiReviewLevelRepository levelRepository;
    private final AiReviewLatestView latestView;

    @Value("${app.ai.review.enabled:true}")
    boolean systemEnabled = true;

    @Value("${app.ai.model.name:}")
    String modelName = "";

    // ── yêu cầu (luồng request) ───────────────────────────────────────────

    /**
     * Nhờ AI chấm CÁC CHỈ TIÊU được chọn (nút "Gợi ý" ở từng ô của phiếu chấm). Từ 06/10 không còn chấm cả phiếu: thiếu
     * {@code kpiCriteriaIds} thì từ chối. Không chấm lại khi chỉ tiêu đang chấm dở, hoặc đã có kết quả mà bài không
     * đổi (trừ khi {@code force}).
     */
    @Transactional
    public AiSubmissionReviewResponse request(AiSubmissionReviewRequest req) {
        if (req.getKpiCriteriaIds() == null || req.getKpiCriteriaIds().isEmpty()) {
            throw new BusinessException(ErrorCode.AI_REVIEW_CRITERIA_REQUIRED);
        }
        return start(req.getKpiPeriodId(), req.getUserId(), req.getKpiCriteriaIds(), Boolean.TRUE.equals(req.getForce()));
    }

    /**
     * @param criteriaIds các chỉ tiêu cần chấm (không rỗng)
     * @param force       chấm lại kể cả khi bài không đổi
     */
    private AiSubmissionReviewResponse start(UUID kpiPeriodId, UUID userId, List<UUID> criteriaIds, boolean force) {
        User me = currentUser();
        // 1. Phạm vi: người yêu cầu phải chấm được người này (quyền theo đơn vị, không chỉ theo tổ chức).
        Organization org = contextBuilder.requireCanReview(me.getId(), userId);
        // 2. Cờ: công tắc hệ thống + AI của tổ chức + tính năng ở công ty + cấu hình đơn vị của người được chấm.
        requireEnabled(org, userId);

        // Chỉ tiêu nào không vào phiếu AI (KPI thưởng, khoá kỳ, xin tạm dừng…) thì bỏ; không còn gì thì báo đúng lý do.
        Set<UUID> sheet = contextBuilder.reviewableCriteria(kpiPeriodId, userId);
        Set<UUID> scope = new LinkedHashSet<>(criteriaIds);
        scope.retainAll(sheet);
        if (scope.isEmpty()) {
            boolean paused = contextBuilder.pausedCriteria(kpiPeriodId, userId).stream().anyMatch(criteriaIds::contains);
            throw new ForbiddenException(paused ? ErrorCode.AI_REVIEW_CRITERIA_PAUSED : ErrorCode.AI_REVIEW_CRITERIA_NOT_ON_SHEET);
        }
        AiReviewLatestView.View view = latestView.of(
                reviewRepository.findByKpiPeriodIdAndUserIdOrderByCreatedAtDesc(kpiPeriodId, userId), sheet);
        // Đang chấm thì không xếp thêm lượt trùng; chưa đổi gì (và không ép) thì dùng lại kết quả cũ, khỏi tốn token.
        if (view != null) scope.removeIf(id -> view.isRunning(id) || (!force && reusable(view, id, userId)));
        if (scope.isEmpty()) return assemble(view);

        // 3-4. Tần suất rồi hạn mức — đúng thứ tự guard() của AiService.
        aiRateLimiter.check(me.getEmail());
        aiQuotaService.checkAndThrow(me.getEmail());

        AiSubmissionReview review = reviewRepository.save(AiSubmissionReview.builder()
                .organizationId(org.getId())
                .kpiPeriodId(kpiPeriodId)
                .userId(userId)
                .requestedBy(me.getId())
                .status(AiReviewStatus.QUEUED)
                .scopeCriteriaIds(AiReviewLatestView.scopeColumn(scope))
                .build());
        // Phát trong transaction; listener AFTER_COMMIT chỉ chạy khi dòng QUEUED đã thật sự lưu.
        events.publishEvent(new AiReviewEvents.Requested(review.getId(), me.getEmail()));
        return summaryOf(review);
    }

    /** Kết quả hiện hành của chỉ tiêu còn dùng được: đã có, và bài của chỉ tiêu không đổi kể từ lượt chấm nó. */
    private boolean reusable(AiReviewLatestView.View view, UUID kpiCriteriaId, UUID userId) {
        AiSubmissionReview run = view.runOfCriterion().get(kpiCriteriaId);
        return run != null
                && reviewRepository.countCriterionSubmissionsChangedSince(userId, kpiCriteriaId, run.getCreatedAt()) == 0;
    }

    // ── đọc ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public AiSubmissionReviewResponse get(UUID reviewId) {
        User me = currentUser();
        AiSubmissionReview review = reviewRepository.findById(reviewId).orElseThrow(this::notFound);
        try {
            contextBuilder.requireCanReview(me.getId(), review.getUserId());
        } catch (ForbiddenException e) {
            throw notFound();   // không phân biệt "không có" với "không được xem"
        }
        var items = itemRepository.findAllByReviewId(review.getId());
        Map<UUID, AiSubmissionReview> runOf = new HashMap<>();
        items.forEach(i -> runOf.put(i.getKpiCriteriaId(), review));
        return assemble(review, review.getStatus(), items, runOf);
    }

    /**
     * Kết quả AI HIỆN HÀNH cho một nhân viên trong một đợt — gộp item mới nhất của từng chỉ tiêu từ mọi lượt
     * ({@link AiReviewLatestView}), hoặc {@code null} khi chưa có lượt nào.
     */
    @Transactional(readOnly = true)
    public AiSubmissionReviewResponse latest(UUID kpiPeriodId, UUID userId) {
        User me = currentUser();
        contextBuilder.requireCanReview(me.getId(), userId);
        // Chỉ chỉ tiêu còn trên phiếu AI: kết quả cũ của chỉ tiêu nay đã xin tạm dừng không hiện nữa.
        return assemble(latestView.of(reviewRepository.findByKpiPeriodIdAndUserIdOrderByCreatedAtDesc(kpiPeriodId, userId),
                contextBuilder.reviewableCriteria(kpiPeriodId, userId)));
    }

    private AiSubmissionReviewResponse assemble(AiReviewLatestView.View view) {
        if (view == null) return null;
        AiSubmissionReviewResponse r = assemble(view.base(), view.status(), view.items(), view.runOfCriterion());
        r.setRunningCriteriaIds(List.copyOf(view.runningCriteriaIds()));
        r.setFailedCriteriaIds(List.copyOf(view.failedCriteriaIds()));
        return r;
    }

    private AiSubmissionReviewResponse summaryOf(AiSubmissionReview review) {
        AiSubmissionReviewResponse r = mapper.toResponse(review);
        r.setItems(List.of());
        return r;
    }

    /**
     * Dựng response từ một lượt "nền" (phần chung) và danh sách item — của chính lượt đó, hoặc gộp từ nhiều lượt.
     *
     * @param runOf lượt đã chấm item của từng chỉ tiêu (ghi {@code reviewedAt})
     */
    private AiSubmissionReviewResponse assemble(AiSubmissionReview review, AiReviewStatus status,
                                                List<com.kpitracking.entity.ai.AiSubmissionReviewItem> allItems,
                                                Map<UUID, AiSubmissionReview> runOf) {
        AiSubmissionReviewResponse r = mapper.toResponse(review);
        r.setStatus(status);
        Map<UUID, KpiCriteria> kpis = new HashMap<>();
        kpiCriteriaRepository.findAllById(allItems.stream().map(i -> i.getKpiCriteriaId()).distinct().toList())
                .forEach(k -> kpis.put(k.getId(), k));
        // Giá trị thực đạt của bài nộp mới nhất — để giao diện ghi lý do phần "đạt chỉ tiêu" (vd "8/10 cái").
        Map<UUID, Double> actual = new HashMap<>();
        // Định tính: mức người nộp tự đánh giá — căn cứ phần "đạt chỉ tiêu" trên thang hành vi.
        Map<UUID, String> selfLevel = new HashMap<>();
        java.util.Set<UUID> returned = new java.util.HashSet<>();
        kpiSubmissionRepository.findAllById(allItems.stream().map(i -> i.getKpiSubmissionId())
                        .filter(java.util.Objects::nonNull).distinct().toList())
                .forEach(s -> {
                    actual.put(s.getId(), s.getActualValue());
                    if (s.getQualitativeLevel() != null) selfLevel.put(s.getId(), s.getQualitativeLevel().getName());
                    if (s.getStatus() == com.kpitracking.enums.submission.SubmissionStatus.RETURNED) returned.add(s.getId());
                });
        // Kết quả AI của bài đã TRẢ LẠI không còn là kết quả hiện hành: nhân viên nộp lại là bài mới, AI phải chấm lại —
        // để nguyên thì phiếu chấm và khối Xem đánh giá hiện điểm cũ như thể AI đã chấm bài mới (07/10).
        List<com.kpitracking.entity.ai.AiSubmissionReviewItem> items = allItems.stream()
                .filter(i -> i.getKpiSubmissionId() == null || !returned.contains(i.getKpiSubmissionId()))
                .toList();
        // Điểm AI tính LẠI lúc đọc theo THANG ĐIỂM AI hiện hành (V51): điểm = điểm của mức AI đã chọn — kết quả cũ (chấm
        // theo 60/30/10) cũng ra đúng thang mới, và sửa thang thì mọi ô đổi theo mà không phải chấm lại.
        AiReviewSettingsResolver.AiScale aiScale = settingsResolver.aiScale(review.getOrganizationId());
        List<ReviewContext.QualityLevel> scale = aiScale.levels();
        java.math.BigDecimal maxPoints = aiScale.max();
        r.setItems(items.stream().map(i -> {
            AiSubmissionReviewItemResponse ir = mapper.toItemResponse(i);
            AiSubmissionReview run = runOf.get(i.getKpiCriteriaId());
            if (run != null) ir.setReviewedAt(run.getCreatedAt());
            KpiCriteria k = kpis.get(i.getKpiCriteriaId());
            if (k != null) {
                ir.setKpiCriteriaName(k.getName());
                ir.setWeight(k.getWeight());
                ir.setQualitative(k.getKpiType() == com.kpitracking.enums.kpi.KpiType.QUALITATIVE);
                ir.setTargetValue(k.getTargetValue());
                ir.setUnit(k.getUnit());
            }
            if (i.getKpiSubmissionId() != null) {
                ir.setActualValue(actual.get(i.getKpiSubmissionId()));
                ir.setSelfLevel(selfLevel.get(i.getKpiSubmissionId()));
            }
            // Mức tin cậy tính LẠI lúc đọc theo luật hiện hành (đi theo chất lượng, 07/10) — kết quả chấm theo luật cũ
            // (hay lượt trước 06/10 chưa có mức riêng) cũng ra đúng, không phải chấm lại.
            ReviewResultValidator.Confidence conf = ReviewResultValidator.qualityConfidence(i.getQualityLevel(), scale,
                    i.getErrorMessage() != null, i.getKpiSubmissionId() != null);
            ir.setConfidence(conf.level());
            ir.setConfidenceReasons(conf.reasons());
            ReviewScoreCalculator.Points p = ReviewScoreCalculator.points(maxPoints,
                    ReviewScoreCalculator.qualityPercentOf(i.getQualityLevel(), scale));
            ir.setMaxPoints(p.max());
            ir.setSuggestedScore(p.total());
            return ir;
        }).toList());
        return r;
    }

    // ── chạy nền ──────────────────────────────────────────────────────────

    /**
     * Chạy một lượt ở luồng nền. Không {@code @Transactional} bao trùm: mỗi lần ghi trạng thái là một
     * transaction riêng ({@link ReviewRecorder}) để màn chấm thấy {@code RUNNING} ngay, và lượt lỗi vẫn
     * ghi được {@code FAILED}.
     */
    public void execute(UUID reviewId, String requesterEmail) {
        Instant startedAt = Instant.now();
        AiSubmissionReview review = recorder.markRunning(reviewId);
        if (review == null) return;   // đã có luồng khác nhận, hoặc đã bị xoá

        SecurityContext previous = SecurityContextHolder.getContext();
        // Luồng @Async không có SecurityContext, mà sổ token (TokenUsageListener) đọc danh tính từ đó.
        SecurityContextHolder.setContext(new SecurityContextImpl(
                new UsernamePasswordAuthenticationToken(requesterEmail, null, List.of())));
        try {
            Organization org = organizationRepository.findById(review.getOrganizationId()).orElseThrow();
            ReviewRun run = new ReviewRun(review.getId(), review.getKpiPeriodId(), review.getUserId(), org,
                    AiReviewLatestView.scopeOf(review));
            workflow.run(run);
            recorder.complete(run, modelName, startedAt);
            log.info("AI đánh giá bài nộp {} xong: {} chỉ tiêu, tin cậy {}, {}+{} token",
                    reviewId, run.getResults().size(), run.getConfidence(),
                    run.getPromptTokens().get(), run.getCompletionTokens().get());
        } catch (Exception e) {
            log.error("AI đánh giá bài nộp {} lỗi", reviewId, e);
            recorder.fail(reviewId, "AI chưa phân tích được lượt này. Bạn thử chạy lại sau ít phút.", startedAt);
        } finally {
            SecurityContextHolder.setContext(previous);
        }
    }

    // ── cấu hình ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public AiReviewSettingsResponse settings() {
        return settingsOf(currentOrganization());
    }

    /**
     * Lưu cờ bật/tắt + thang điểm AI. Thang thay trọn (xoá rồi ghi lại); tên mức là khoá mà kết quả AI lưu theo, nên
     * đổi tên một mức thì kết quả cũ ở mức đó thôi có điểm cho tới khi chấm lại.
     */
    @Transactional
    public AiReviewSettingsResponse updateSettings(AiReviewSettingsRequest req) {
        List<AiReviewSettingsRequest.Level> levels = req.getLevels();
        java.util.Set<String> names = new java.util.HashSet<>();
        boolean namesOk = levels.stream().allMatch(l -> names.add(l.getName().strip().toLowerCase(java.util.Locale.ROOT)));
        double max = levels.stream().mapToDouble(l -> l.getPoints().doubleValue()).max().orElse(0);
        if (levels.size() < 2 || levels.size() > 10 || !namesOk || max <= 0) {
            throw new BusinessException(ErrorCode.AI_REVIEW_LEVELS_INVALID);
        }
        Organization org = currentOrganization();
        org.setEnableAiReview(req.getEnabled());
        organizationRepository.save(org);
        levelRepository.deleteByOrganizationId(org.getId());
        List<AiReviewSettingsRequest.Level> sorted = levels.stream()
                .sorted(java.util.Comparator.comparing(AiReviewSettingsRequest.Level::getPoints)).toList();
        for (int i = 0; i < sorted.size(); i++) {
            AiReviewSettingsRequest.Level l = sorted.get(i);
            levelRepository.save(com.kpitracking.entity.ai.AiReviewLevel.builder()
                    .organizationId(org.getId()).position(i + 1).name(l.getName().strip()).points(l.getPoints())
                    .color(l.getColor()).description(l.getDescription() == null || l.getDescription().isBlank()
                            ? null : l.getDescription().strip())
                    .build());
        }
        return settingsOf(org);
    }

    private AiReviewSettingsResponse settingsOf(Organization org) {
        return AiReviewSettingsResponse.builder()
                .enabled(Boolean.TRUE.equals(org.getEnableAiReview()))
                .levels(levelRepository.findByOrganizationIdOrderByPositionAsc(org.getId()).stream()
                        .map(l -> AiReviewSettingsResponse.Level.builder().name(l.getName()).points(l.getPoints())
                                .color(l.getColor()).description(l.getDescription()).build())
                        .toList())
                .build();
    }

    // ── tiện ích ──────────────────────────────────────────────────────────

    private void requireEnabled(Organization org, UUID userId) {
        if (!systemEnabled || Boolean.FALSE.equals(org.getEnableAi())) {
            throw new ForbiddenException("Tính năng AI đã bị tắt cho tổ chức của bạn.");
        }
        if (!Boolean.TRUE.equals(org.getEnableAiReview())) {
            throw new ForbiddenException("Tổ chức chưa bật tính năng AI đánh giá bài nộp.");
        }
        // Công ty bật thì đơn vị quyết (đơn vị gần nhất có cấu hình riêng).
        if (!settingsResolver.resolve(org, userId).enabled()) {
            throw new ForbiddenException("Đơn vị của nhân viên này đã tắt tính năng AI đánh giá bài nộp.");
        }
    }

    private Organization currentOrganization() {
        User me = currentUser();
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(me.getId());
        if (assignments.isEmpty() || assignments.get(0).getOrgUnit() == null) {
            throw new ForbiddenException("Bạn chưa thuộc tổ chức nào.");
        }
        return assignments.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization();
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
    }

    private ResourceNotFoundException notFound() {
        return new ResourceNotFoundException("Kết quả AI đánh giá", "id", "?");
    }
}
