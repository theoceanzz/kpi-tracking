package com.kpitracking.service.ai.review;

import com.kpitracking.ai.review.ReviewRun;
import com.kpitracking.ai.review.SubmissionReviewWorkflow;
import com.kpitracking.dto.request.ai.AiReviewSettingsRequest;
import com.kpitracking.dto.request.ai.AiSubmissionReviewRequest;
import com.kpitracking.dto.response.ai.AiReviewSettingsResponse;
import com.kpitracking.dto.response.ai.AiSubmissionReviewItemResponse;
import com.kpitracking.dto.response.ai.AiSubmissionReviewResponse;
import com.kpitracking.entity.AiSubmissionReview;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.AiReviewStatus;
import com.kpitracking.event.AiReviewEvents;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.AiSubmissionReviewMapper;
import com.kpitracking.repository.AiSubmissionReviewItemRepository;
import com.kpitracking.repository.AiSubmissionReviewRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.AiQuotaService;
import com.kpitracking.service.AiRateLimiter;
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
import java.util.List;
import java.util.Map;
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
    private final com.kpitracking.repository.OrgUnitRepository orgUnitRepository;
    private final com.kpitracking.repository.KpiSubmissionRepository kpiSubmissionRepository;
    private final com.kpitracking.repository.QualitativeLevelRepository qualitativeLevelRepository;

    /** Trần số người một lần chạy theo lô — lô lớn hơn thì chia nhỏ theo đơn vị con. */
    static final int MAX_BATCH = 100;

    /** Kết quả chạy theo lô: số lượt mới xếp hàng, số lượt dùng lại, số người bỏ qua (không quyền / không chỉ tiêu / đơn vị tắt). */
    public record BatchResult(int queued, int reused, int skipped) {}

    @Value("${app.ai.review.enabled:true}")
    boolean systemEnabled = true;

    @Value("${app.ai.model.name:}")
    String modelName = "";

    // ── yêu cầu (luồng request) ───────────────────────────────────────────

    /**
     * Nhờ AI đọc bài nộp. Không chấm lại: đã có lượt đang chạy, hoặc lượt {@code DONE} mà từ đó chưa bài
     * nộp nào đổi, thì trả lượt đó.
     */
    @Transactional
    public AiSubmissionReviewResponse request(AiSubmissionReviewRequest req) {
        return start(req.getKpiPeriodId(), req.getUserId(), false);
    }

    /** Chạy lại bất kể đã có kết quả — vẫn tính vào tần suất và hạn mức. */
    @Transactional
    public AiSubmissionReviewResponse rerun(UUID reviewId) {
        User me = currentUser();
        AiSubmissionReview old = reviewRepository.findById(reviewId).orElseThrow(this::notFound);
        contextBuilder.requireCanReview(me.getId(), old.getUserId());
        return start(old.getKpiPeriodId(), old.getUserId(), true);
    }

    private AiSubmissionReviewResponse start(UUID kpiPeriodId, UUID userId, boolean force) {
        User me = currentUser();
        // 1. Phạm vi: người yêu cầu phải chấm được người này (quyền theo đơn vị, không chỉ theo tổ chức).
        Organization org = contextBuilder.requireCanReview(me.getId(), userId);
        // 2. Cờ: công tắc hệ thống + AI của tổ chức + tính năng ở công ty + cấu hình đơn vị của người được chấm.
        requireEnabled(org, userId);

        if (!force) {
            AiSubmissionReview latest = reviewRepository
                    .findFirstByKpiPeriodIdAndUserIdOrderByCreatedAtDesc(kpiPeriodId, userId).orElse(null);
            if (latest != null && reusable(latest)) return summaryOf(latest);
        }

        // 3-4. Tần suất rồi hạn mức — đúng thứ tự guard() của AiService.
        aiRateLimiter.check(me.getEmail());
        aiQuotaService.checkAndThrow(me.getEmail());

        AiSubmissionReview review = reviewRepository.save(AiSubmissionReview.builder()
                .organizationId(org.getId())
                .kpiPeriodId(kpiPeriodId)
                .userId(userId)
                .requestedBy(me.getId())
                .status(AiReviewStatus.QUEUED)
                .build());
        // Phát trong transaction; listener AFTER_COMMIT chỉ chạy khi dòng QUEUED đã thật sự lưu.
        events.publishEvent(new AiReviewEvents.Requested(review.getId(), me.getEmail()));
        return summaryOf(review);
    }

    /**
     * Chạy theo lô cho mọi người trong một nhánh đơn vị (GĐ2). Một lô là MỘT yêu cầu: kiểm tần suất và hạn
     * mức một lần. Mỗi người vẫn đi qua đúng các chốt của lượt lẻ — không chấm được người đó, đơn vị của
     * họ tắt tính năng, hay họ không có chỉ tiêu trong đợt thì bỏ qua (không lộ lý do theo từng người).
     */
    @Transactional
    public BatchResult batch(UUID kpiPeriodId, UUID orgUnitId) {
        User me = currentUser();
        com.kpitracking.entity.OrgUnit unit = orgUnitRepository.findById(orgUnitId)
                .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", orgUnitId));
        UUID orgId = unit.getOrgHierarchyLevel().getOrganization().getId();
        List<UUID> unitIds = orgUnitRepository.findSubtree(unit.getPath(), orgId).stream()
                .map(com.kpitracking.entity.OrgUnit::getId).toList();
        List<UUID> members = userRoleOrgUnitRepository.findByOrgUnitIdIn(unitIds).stream()
                .map(a -> a.getUser().getId())
                .filter(id -> !id.equals(me.getId()))
                .distinct()
                .limit(MAX_BATCH)
                .toList();

        aiRateLimiter.check(me.getEmail());
        aiQuotaService.checkAndThrow(me.getEmail());

        int queued = 0, reused = 0, skipped = 0;
        for (UUID userId : members) {
            Organization org;
            try {
                org = contextBuilder.requireCanReview(me.getId(), userId);
                requireEnabled(org, userId);
            } catch (ForbiddenException e) {
                skipped++;
                continue;
            }
            if (!contextBuilder.hasCriteria(kpiPeriodId, userId)) {
                skipped++;
                continue;
            }
            AiSubmissionReview latest = reviewRepository
                    .findFirstByKpiPeriodIdAndUserIdOrderByCreatedAtDesc(kpiPeriodId, userId).orElse(null);
            if (latest != null && reusable(latest)) {
                reused++;
                continue;
            }
            AiSubmissionReview review = reviewRepository.save(AiSubmissionReview.builder()
                    .organizationId(org.getId()).kpiPeriodId(kpiPeriodId).userId(userId)
                    .requestedBy(me.getId()).status(AiReviewStatus.QUEUED).build());
            events.publishEvent(new AiReviewEvents.Requested(review.getId(), me.getEmail()));
            queued++;
        }
        log.info("Chạy AI đánh giá theo lô cho đơn vị {} đợt {}: {} xếp hàng, {} dùng lại, {} bỏ qua",
                orgUnitId, kpiPeriodId, queued, reused, skipped);
        return new BatchResult(queued, reused, skipped);
    }

    private boolean reusable(AiSubmissionReview latest) {
        if (latest.getStatus() == AiReviewStatus.QUEUED || latest.getStatus() == AiReviewStatus.RUNNING) return true;
        if (latest.getStatus() != AiReviewStatus.DONE) return false;
        return reviewRepository.countSubmissionsChangedSince(
                latest.getUserId(), latest.getKpiPeriodId(), latest.getCreatedAt()) == 0;
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
        return full(review);
    }

    /** Lượt mới nhất cho một nhân viên trong một đợt, hoặc {@code null} khi chưa có. */
    @Transactional(readOnly = true)
    public AiSubmissionReviewResponse latest(UUID kpiPeriodId, UUID userId) {
        User me = currentUser();
        contextBuilder.requireCanReview(me.getId(), userId);
        return reviewRepository.findFirstByKpiPeriodIdAndUserIdOrderByCreatedAtDesc(kpiPeriodId, userId)
                .map(this::full).orElse(null);
    }

    private AiSubmissionReviewResponse summaryOf(AiSubmissionReview review) {
        AiSubmissionReviewResponse r = mapper.toResponse(review);
        r.setItems(List.of());
        return r;
    }

    private AiSubmissionReviewResponse full(AiSubmissionReview review) {
        AiSubmissionReviewResponse r = mapper.toResponse(review);
        var items = itemRepository.findAllByReviewId(review.getId());
        Map<UUID, KpiCriteria> kpis = new HashMap<>();
        kpiCriteriaRepository.findAllById(items.stream().map(i -> i.getKpiCriteriaId()).distinct().toList())
                .forEach(k -> kpis.put(k.getId(), k));
        // Giá trị thực đạt của bài nộp mới nhất — để giao diện ghi lý do phần "đạt chỉ tiêu" (vd "8/10 cái").
        Map<UUID, Double> actual = new HashMap<>();
        // Định tính: mức người nộp tự đánh giá — căn cứ phần "đạt chỉ tiêu" trên thang hành vi.
        Map<UUID, String> selfLevel = new HashMap<>();
        kpiSubmissionRepository.findAllById(items.stream().map(i -> i.getKpiSubmissionId())
                        .filter(java.util.Objects::nonNull).distinct().toList())
                .forEach(s -> {
                    actual.put(s.getId(), s.getActualValue());
                    if (s.getQualitativeLevel() != null) selfLevel.put(s.getId(), s.getQualitativeLevel().getName());
                });
        List<ReviewContext.QualityLevel> scale = qualityScale(review.getOrganizationId());
        r.setItems(items.stream().map(i -> {
            AiSubmissionReviewItemResponse ir = mapper.toItemResponse(i);
            KpiCriteria k = kpis.get(i.getKpiCriteriaId());
            if (k != null) {
                ir.setKpiCriteriaName(k.getName());
                ir.setWeight(k.getWeight());
                ir.setQualitative(k.getKpiType() == com.kpitracking.enums.KpiType.QUALITATIVE);
                ir.setTargetValue(k.getTargetValue());
                ir.setUnit(k.getUnit());
            }
            if (i.getKpiSubmissionId() != null) {
                ir.setActualValue(actual.get(i.getKpiSubmissionId()));
                ir.setSelfLevel(selfLevel.get(i.getKpiSubmissionId()));
            }
            if (Boolean.TRUE.equals(i.getQualitative()) && i.getMaxPoints() != null && i.getSuggestedScore() != null
                    && i.getMaxPoints().signum() > 0) {
                ir.setSuggestedLevel(nearestLevel(scale,
                        i.getSuggestedScore().doubleValue() * 100.0 / i.getMaxPoints().doubleValue()));
            }
            return ir;
        }).toList());
        // Tổng đợt — hai thang tách nhau như hệ thống: định lượng → điểm đánh giá 100; định tính → điểm hành vi 100.
        // Chỉ lượt kiểu mới (có điểm tối đa); lượt cũ để null.
        var quantitative = items.stream()
                .filter(i -> i.getMaxPoints() != null && !Boolean.TRUE.equals(i.getQualitative())).toList();
        if (!quantitative.isEmpty()) {
            r.setSuggestedTotal(sum(quantitative.stream().map(i -> i.getSuggestedScore()).toList(), false));
            r.setSystemTotal(sum(quantitative.stream().map(i -> i.getSystemPoints()).toList(), true));
        }
        var behavior = items.stream()
                .filter(i -> i.getMaxPoints() != null && Boolean.TRUE.equals(i.getQualitative())).toList();
        if (!behavior.isEmpty()) {
            java.math.BigDecimal total = sum(behavior.stream().map(i -> i.getSuggestedScore()).toList(), true);
            r.setBehaviorSuggestedTotal(total);
            r.setBehaviorSuggestedLevel(nearestLevel(scale, total.doubleValue()));
        }
        weightsOf(review.getCriteriaSnapshot(), r);
        return r;
    }

    private static final com.fasterxml.jackson.databind.ObjectMapper JSON = new com.fasterxml.jackson.databind.ObjectMapper();

    /** Trọng số đã dùng, đọc từ ảnh chụp lúc chấm ({@code ReviewRecorder.snapshot}: "weights": {target, quality, onTime}). */
    private static void weightsOf(String snapshot, AiSubmissionReviewResponse r) {
        if (snapshot == null || snapshot.isBlank()) return;
        try {
            var w = JSON.readTree(snapshot).path("weights");
            if (w.isMissingNode() || w.isNull()) return;
            r.setWeightTarget(w.path("target").asInt());
            r.setWeightQuality(w.path("quality").asInt());
            r.setWeightOnTime(w.path("onTime").asInt());
        } catch (Exception e) {
            log.debug("Không đọc được trọng số từ ảnh chụp: {}", e.getMessage());
        }
    }

    /** Thang chất lượng của tổ chức (xếp từ kém tới tốt), hoặc thang mặc định khi chưa cấu hình. */
    private List<ReviewContext.QualityLevel> qualityScale(UUID organizationId) {
        List<ReviewContext.QualityLevel> levels = qualitativeLevelRepository
                .findByOrganizationIdOrderByPositionAsc(organizationId).stream()
                .map(l -> new ReviewContext.QualityLevel(l.getName(), l.getScorePercent(),
                        l.getPosition() == null ? 0 : l.getPosition()))
                .toList();
        return levels.isEmpty() ? ReviewScoreCalculator.DEFAULT_SCALE : levels;
    }

    /** Mức có % gần nhất với điểm (thang 100); bằng nhau thì lấy mức thấp hơn (gợi ý thận trọng). */
    static String nearestLevel(List<ReviewContext.QualityLevel> scale, double percent) {
        String best = null;
        double bestGap = Double.MAX_VALUE;
        for (int i = 0; i < scale.size(); i++) {
            ReviewContext.QualityLevel l = scale.get(i);
            double p = l.scorePercent() != null ? l.scorePercent() : (i + 1) * 100.0 / scale.size();
            double gap = Math.abs(p - percent);
            if (gap < bestGap) {
                bestGap = gap;
                best = l.name();
            }
        }
        return best;
    }

    /** Cộng các số có mặt; {@code capAt100}: điểm hệ thống của đợt có trần 100 (như {@code EvaluationService}). */
    private static java.math.BigDecimal sum(List<java.math.BigDecimal> values, boolean capAt100) {
        java.math.BigDecimal total = values.stream().filter(java.util.Objects::nonNull)
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
        java.math.BigDecimal hundred = java.math.BigDecimal.valueOf(100);
        return capAt100 && total.compareTo(hundred) > 0 ? hundred.setScale(2) : total.setScale(2, java.math.RoundingMode.HALF_UP);
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
            ReviewRun run = new ReviewRun(review.getId(), review.getKpiPeriodId(), review.getUserId(), org);
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

    @Transactional
    public AiReviewSettingsResponse updateSettings(AiReviewSettingsRequest req) {
        if (req.getWeightTarget() + req.getWeightQuality() + req.getWeightOnTime() != 100) {
            throw new BusinessException("Tổng ba trọng số phải bằng 100%.");
        }
        Organization org = currentOrganization();
        org.setEnableAiReview(req.getEnabled());
        org.setAiReviewWeightTarget(req.getWeightTarget());
        org.setAiReviewWeightQuality(req.getWeightQuality());
        org.setAiReviewWeightOnTime(req.getWeightOnTime());
        return settingsOf(organizationRepository.save(org));
    }

    private static AiReviewSettingsResponse settingsOf(Organization org) {
        return AiReviewSettingsResponse.builder()
                .enabled(Boolean.TRUE.equals(org.getEnableAiReview()))
                .weightTarget(org.getAiReviewWeightTarget())
                .weightQuality(org.getAiReviewWeightQuality())
                .weightOnTime(org.getAiReviewWeightOnTime())
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
