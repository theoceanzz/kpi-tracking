package com.kpitracking.service.ai.review;

import com.kpitracking.ai.document.model.FileRef;
import com.kpitracking.dto.response.ai.AiSelfCheckAvailabilityResponse;
import com.kpitracking.dto.response.ai.AiSelfCheckResponse;
import com.kpitracking.entity.AiSelfCheck;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.SubmissionAttachment;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.AiReviewStatus;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.event.AiSelfCheckEvents;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.Terms;
import com.kpitracking.mapper.AiSubmissionReviewMapper;
import com.kpitracking.repository.AiSelfCheckRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiSubmissionRepository;
import com.kpitracking.repository.QualitativeLevelRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.AiQuotaService;
import com.kpitracking.service.AiRateLimiter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

/**
 * Nhân viên tự nhờ AI soi bài của MỘT chỉ tiêu trước khi nộp (câu E3 của tài liệu phân tích, khách chốt "có
 * token thì được dùng").
 *
 * <p>Ba luật người dùng đã chốt, nằm trong mã chứ không trong prompt:
 * <ul>
 *   <li><b>Chỉ nhận xét</b> — kết quả không có mức chất lượng, không có điểm ({@code AiSelfCheckResponse} không có
 *       trường nào để chứa).</li>
 *   <li><b>Riêng của người nộp</b> — chỉ chính chủ đọc được; không có đường nào cho quản lý xem, và luồng
 *       AI đánh giá của quản lý không đọc bảng này.</li>
 *   <li><b>Có token thì được dùng</b> — cổng là hạn mức token CỦA CHÍNH NHÂN VIÊN
 *       ({@link AiQuotaService#checkAndThrow}); token ghi sổ cho họ. Bài y hệt lần trước (cùng băm) thì trả lại kết
 *       quả cũ, không tốn token lần hai.</li>
 * </ul>
 * Không ghi gì vào {@code kpi_submissions}: soi không phải nộp.
 */
@Service
@RequiredArgsConstructor
public class SubmissionSelfCheckService {

    /** Bằng trần tệp minh chứng của form nộp bài ({@code attachmentPolicy.ts}). */
    static final int MAX_FILES = 5;

    private final AiSelfCheckRepository repository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final KpiSubmissionRepository submissionRepository;
    private final QualitativeLevelRepository qualitativeLevelRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final AiReviewSettingsResolver settingsResolver;
    private final AiRateLimiter aiRateLimiter;
    private final AiQuotaService aiQuotaService;
    private final ApplicationEventPublisher events;

    @Value("${app.ai.review.enabled:true}")
    boolean systemEnabled = true;

    /** Bài đang soạn trên form — chưa lưu ở đâu. {@code submissionId} = bản nháp đang sửa (nếu có). */
    public record Draft(UUID kpiCriteriaId, UUID submissionId, Double actualValue, UUID qualitativeLevelId,
                        String note) {}

    @Transactional
    public AiSelfCheckResponse start(Draft d, List<MultipartFile> files) {
        User me = currentUser();
        KpiCriteria kpi = requireOwnKpi(me, d.kpiCriteriaId());
        Organization org = organizationOf(me);
        requireEnabled(org, me.getId());
        KpiSubmission draft = d.submissionId() == null ? null : requireOwnDraft(me, kpi, d.submissionId());

        List<MultipartFile> incoming = files == null ? List.of()
                : files.stream().filter(f -> f != null && !f.isEmpty()).toList();
        if (incoming.size() > MAX_FILES) throw new BusinessException(ErrorCode.AI_SELF_CHECK_TOO_MANY_FILES, MAX_FILES);
        List<FileRef> refs = incoming.stream().map(SubmissionSelfCheckService::bytesOf).toList();
        List<AiSelfCheckEvents.StoredFile> stored = draft == null ? List.of() : draft.getAttachments().stream()
                .sorted(Comparator.comparing(SubmissionAttachment::getFileName, Comparator.nullsLast(Comparator.naturalOrder())))
                .limit(MAX_FILES)
                .map(a -> new AiSelfCheckEvents.StoredFile(a.getFileName(), a.getFileUrl()))
                .toList();
        String note = d.note() == null || d.note().isBlank() ? null : d.note().strip();
        String level = d.qualitativeLevelId() == null ? null
                : qualitativeLevelRepository.findById(d.qualitativeLevelId()).map(l -> l.getName()).orElse(null);
        if (note == null && d.actualValue() == null && level == null && refs.isEmpty() && stored.isEmpty()) {
            throw new BusinessException(ErrorCode.AI_SELF_CHECK_NOTHING_TO_READ);
        }

        ReviewContext.CriteriaSet set = settingsResolver.criteriaSetFor(org.getId(), me.getId());
        String hash = hash(d, note, level, refs, stored, set);
        AiSelfCheck same = repository
                .findFirstByUserIdAndKpiCriteriaIdAndInputHashOrderByCreatedAtDesc(me.getId(), kpi.getId(), hash)
                .filter(c -> c.getStatus() != AiReviewStatus.FAILED)
                .orElse(null);
        if (same != null) return toResponse(same, true);

        // Tần suất rồi hạn mức — đúng thứ tự guard() của AiService. Hạn mức là của CHÍNH người nộp.
        aiRateLimiter.check(me.getEmail());
        aiQuotaService.checkAndThrow(me.getEmail());

        AiSelfCheck check = repository.save(AiSelfCheck.builder()
                .organizationId(org.getId())
                .userId(me.getId())
                .kpiCriteriaId(kpi.getId())
                .kpiSubmissionId(draft == null ? null : draft.getId())
                .inputHash(hash)
                .status(AiReviewStatus.QUEUED)
                .build());
        // Phát trong transaction; listener AFTER_COMMIT chỉ chạy khi dòng QUEUED đã thật sự lưu.
        events.publishEvent(new AiSelfCheckEvents.Requested(check.getId(), me.getEmail(), note, d.actualValue(),
                level, refs, stored));
        return toResponse(check, false);
    }

    @Transactional(readOnly = true)
    public AiSelfCheckResponse get(UUID id) {
        User me = currentUser();
        return repository.findById(id)
                .filter(c -> c.getUserId().equals(me.getId()))   // không phân biệt "không có" với "không phải của bạn"
                .map(c -> toResponse(c, false))
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.aiSelfCheck"), "id", id));
    }

    /** Lần soi mới nhất của chính mình cho một chỉ tiêu, hoặc {@code null}. */
    @Transactional(readOnly = true)
    public AiSelfCheckResponse latest(UUID kpiCriteriaId) {
        User me = currentUser();
        return repository.findFirstByUserIdAndKpiCriteriaIdOrderByCreatedAtDesc(me.getId(), kpiCriteriaId)
                .map(c -> toResponse(c, false)).orElse(null);
    }

    /** Dùng được không, và vì sao không — cùng thứ tự chốt với {@link #start}, không ném lỗi. */
    @Transactional(readOnly = true)
    public AiSelfCheckAvailabilityResponse availability() {
        User me = currentUser();
        Organization org = organizationOf(me);
        if (!systemEnabled || Boolean.FALSE.equals(org.getEnableAi())) return unavailable("AI_OFF");
        if (!Boolean.TRUE.equals(org.getEnableAiReview())) return unavailable("REVIEW_OFF");
        if (!settingsResolver.resolve(org, me.getId()).enabled()) return unavailable("UNIT_OFF");
        AiQuotaService.QuotaStatus quota = aiQuotaService.getStatus(me.getId());
        if (quota.spendable() <= 0) return unavailable("NO_QUOTA");
        if (quota.remaining() <= 0) return unavailable("QUOTA_USED");
        return new AiSelfCheckAvailabilityResponse(true, null, quota.remaining());
    }

    // ── chốt chặn ─────────────────────────────────────────────────────────

    /** Cùng luật với nộp bài ({@code KpiSubmissionService.createSubmission}): chỉ người được giao, KPI đang mở. */
    private KpiCriteria requireOwnKpi(User me, UUID kpiCriteriaId) {
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiCriteriaId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.kpi"), "id", kpiCriteriaId));
        boolean assignee = kpi.getAssignees().stream().anyMatch(u -> u.getId().equals(me.getId()));
        if (!assignee) throw new ForbiddenException(ErrorCode.NOT_ASSIGNED_KPI);
        if (kpi.getStatus() == KpiStatus.INACTIVE) throw new BusinessException(ErrorCode.KPI_STOPPED);
        if (kpi.getStatus() != KpiStatus.APPROVED && kpi.getStatus() != KpiStatus.EDITED) {
            throw new BusinessException(ErrorCode.REPORTS_CAN_ONLY_SUBMITTED_KPIS_APPROVED_ADJUSTED);
        }
        return kpi;
    }

    /** Bản nháp của chính mình, đúng chỉ tiêu, còn ở trạng thái nháp — như điều kiện sửa bài trên form. */
    private KpiSubmission requireOwnDraft(User me, KpiCriteria kpi, UUID submissionId) {
        return submissionRepository.findById(submissionId)
                .filter(s -> s.getDeletedAt() == null && s.getStatus() == SubmissionStatus.DRAFT
                        && s.getSubmittedBy() != null && me.getId().equals(s.getSubmittedBy().getId())
                        && s.getKpiCriteria() != null && kpi.getId().equals(s.getKpiCriteria().getId()))
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.submission"), "id", submissionId));
    }

    private void requireEnabled(Organization org, UUID userId) {
        if (!systemEnabled || Boolean.FALSE.equals(org.getEnableAi())) {
            throw new ForbiddenException(ErrorCode.AI_FEATURE_TURNED_OFF_ORGANIZATION);
        }
        if (!Boolean.TRUE.equals(org.getEnableAiReview())) throw new ForbiddenException(ErrorCode.AI_REVIEW_NOT_ENABLED);
        if (!settingsResolver.resolve(org, userId).enabled()) {
            throw new ForbiddenException(ErrorCode.AI_REVIEW_UNIT_DISABLED);
        }
    }

    // ── tiện ích ──────────────────────────────────────────────────────────

    /**
     * Băm mọi thứ quyết định kết quả: bài (chữ, số, mức tự chọn, nội dung từng tệp), bộ tiêu chí đang áp và phiên
     * bản prompt. Đổi bất kỳ thứ gì thì là bài mới; y hệt thì dùng lại kết quả cũ.
     */
    static String hash(Draft d, String note, String level, List<FileRef> files,
                       List<AiSelfCheckEvents.StoredFile> stored, ReviewContext.CriteriaSet set) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            List<String> parts = new ArrayList<>(Arrays.asList(
                    String.valueOf(d.kpiCriteriaId()), String.valueOf(d.submissionId()),
                    String.valueOf(d.actualValue()), String.valueOf(level), String.valueOf(note),
                    set == null ? "-" : set.id() + ":" + set.version(), ReviewPrompts.PROMPT_VERSION));
            files.stream()
                    .map(f -> f.name() + ":" + HexFormat.of().formatHex(sha256(f.bytes())))
                    .sorted().forEach(parts::add);
            stored.stream().map(f -> f.fileName() + "@" + f.url()).sorted().forEach(parts::add);
            for (String p : parts) {
                md.update(p.getBytes(StandardCharsets.UTF_8));
                md.update((byte) 0);
            }
            return HexFormat.of().formatHex(md.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static byte[] sha256(byte[] bytes) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(bytes == null ? new byte[0] : bytes);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * Đọc byte ngay trên luồng request — tệp tạm của multipart mất khi request kết thúc. Đọc lỗi thì để mảng rỗng:
     * bộ đọc sẽ báo "không đọc được" kèm tên tệp, đúng luật "không im lặng".
     */
    private static FileRef bytesOf(MultipartFile f) {
        String name = f.getOriginalFilename() == null ? "tệp" : f.getOriginalFilename();
        try {
            return FileRef.of(name, f.getBytes());
        } catch (IOException e) {
            return FileRef.of(name, new byte[0]);
        }
    }

    private static AiSelfCheckAvailabilityResponse unavailable(String reason) {
        return new AiSelfCheckAvailabilityResponse(false, reason, 0);
    }

    private AiSelfCheckResponse toResponse(AiSelfCheck c, boolean reused) {
        return AiSelfCheckResponse.builder()
                .id(c.getId())
                .kpiCriteriaId(c.getKpiCriteriaId())
                .kpiSubmissionId(c.getKpiSubmissionId())
                .status(c.getStatus())
                .reused(reused)
                .summary(c.getSummary())
                .evidenceQuotes(lines(c.getEvidenceQuotes()))
                .strengths(lines(c.getStrengths()))
                .gaps(lines(c.getGaps()))
                .suggestions(lines(c.getSuggestions()))
                .basis(AiSubmissionReviewMapper.basisOf(c.getBasisCitations()))
                .unreadableFiles(lines(c.getUnreadableFiles()))
                .filesRead(c.getFilesRead())
                .filesTotal(c.getFilesTotal())
                .criteriaSetVersion(c.getCriteriaSetVersion())
                .createdAt(c.getCreatedAt())
                .finishedAt(c.getFinishedAt())
                .build();
    }

    private static List<String> lines(String text) {
        if (text == null || text.isBlank()) return List.of();
        return Arrays.stream(text.split("\n")).map(String::strip).filter(s -> !s.isEmpty()).toList();
    }

    private Organization organizationOf(User me) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(me.getId());
        return assignments.stream()
                .filter(a -> a.getOrgUnit() != null)
                .map(a -> a.getOrgUnit().getOrgHierarchyLevel().getOrganization())
                .findFirst()
                .orElseThrow(() -> new ForbiddenException(ErrorCode.DO_NOT_BELONG_ORGANIZATION));
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "email", email));
    }
}
