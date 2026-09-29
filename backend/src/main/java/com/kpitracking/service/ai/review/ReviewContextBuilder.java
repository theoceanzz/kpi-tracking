package com.kpitracking.service.ai.review;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiPeriod;
import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.SubmissionAttachment;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.KpiType;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.QualitativeLevelRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.KpiAchievementCalculator;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Dựng {@link ReviewContext}: kiểm quyền, đọc chỉ tiêu + bài nộp + thang chất lượng, cắt gọn.
 *
 * <p>Mọi giới hạn độ dài áp Ở ĐÂY, không rải trong prompt. Giai đoạn 1 KHÔNG mở tệp minh chứng — tên
 * tệp đi vào {@code unreadableFiles} để giao diện nói thật với quản lý là AI chưa đọc chúng.
 */
@Component
@RequiredArgsConstructor
public class ReviewContextBuilder {

    /** Chỉ tiêu còn hiệu lực trong đợt — cùng bộ trạng thái với điểm hệ thống ({@code EvaluationService}). */
    private static final List<KpiStatus> ACTIVE = List.of(
            KpiStatus.APPROVED, KpiStatus.EDITED, KpiStatus.EDIT, KpiStatus.INACTIVE);

    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final QualitativeLevelRepository qualitativeLevelRepository;
    private final PermissionChecker permissionChecker;
    private final KpiAchievementCalculator achievementCalculator;
    private final com.kpitracking.repository.KpiSubmissionRepository submissionRepository;
    private final AiReviewSettingsResolver settingsResolver;
    private final ReviewConductSource conductSource;

    /** Số lần chấm đợt trước lấy làm lịch sử cho mỗi chỉ tiêu. */
    static final int HISTORY_SIZE = 3;

    @Value("${app.ai.review.note-max-chars:4000}")
    int noteMaxChars = 4000;

    /**
     * Người yêu cầu có được chấm người này không — cùng luật với {@code KpiSubmissionService.requireCanReview}:
     * quản trị toàn tổ chức, hoặc có quyền duyệt bài nộp ở một đơn vị của người đó VÀ cấp cao hơn họ.
     *
     * <p>Sai thì chỉ một thông báo, không phân biệt "không tồn tại" với "không có quyền" — để không lộ
     * ai có trong tổ chức.
     *
     * @return tổ chức của người được chấm (đã kiểm)
     */
    @Transactional(readOnly = true)
    public Organization requireCanReview(UUID requesterId, UUID targetUserId) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(targetUserId);
        for (UserRoleOrgUnit a : assignments) {
            if (a.getOrgUnit() == null) continue;
            UUID unitId = a.getOrgUnit().getId();
            boolean allowed = permissionChecker.isGlobalAdminIn(requesterId, unitId)
                    || (permissionChecker.hasAnyPermissionInOrgUnit(requesterId, unitId, "SUBMISSION:REVIEW")
                        && permissionChecker.isSuperiorTo(requesterId, targetUserId, unitId));
            if (allowed) return a.getOrgUnit().getOrgHierarchyLevel().getOrganization();
        }
        throw new ForbiddenException("Bạn không có quyền xem phân tích bài nộp của người này.");
    }

    /** Người này có chỉ tiêu nào trong đợt không — chạy theo lô bỏ qua người không có gì để chấm. */
    @Transactional(readOnly = true)
    public boolean hasCriteria(UUID kpiPeriodId, UUID userId) {
        return !kpiCriteriaRepository
                .findByUserIdInAssigneesAndKpiPeriodId(userId, kpiPeriodId, ACTIVE, Pageable.ofSize(1))
                .isEmpty();
    }

    /** Đọc và cắt gọn mọi dữ liệu cho một lượt. Gọi TRONG transaction (luồng nền mở REQUIRES_NEW). */
    @Transactional(readOnly = true)
    public ReviewContext build(UUID organizationId, UUID kpiPeriodId, UUID userId, Organization org) {
        KpiPeriod period = kpiPeriodRepository.findById(kpiPeriodId).orElse(null);
        User user = userRepository.findById(userId).orElse(null);
        boolean waterfall = Boolean.TRUE.equals(org.getEnableWaterfall());

        List<KpiCriteria> kpis = kpiCriteriaRepository
                .findByUserIdInAssigneesAndKpiPeriodId(userId, kpiPeriodId, ACTIVE, Pageable.unpaged())
                .getContent();

        List<ReviewContext.Criterion> criteria = new ArrayList<>();
        for (KpiCriteria kpi : kpis) {
            if (Boolean.TRUE.equals(kpi.getIsBonusKpi())) continue;   // ngoài pool trọng số
            List<ReviewContext.Submission> subs = new ArrayList<>();
            kpi.getSubmissions().stream()
                    .filter(s -> s.getDeletedAt() == null && s.getSubmittedBy() != null
                            && userId.equals(s.getSubmittedBy().getId()))
                    .sorted(Comparator.comparing(KpiSubmission::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                    .forEach(s -> {
                        // Chỉ ghi tên + URL ở đây; bước "evidence" của luồng tải và đọc nội dung (ngoài
                        // transaction, song song) và tự ghi tệp nào không đọc được.
                        List<ReviewContext.Attachment> files = new ArrayList<>();
                        for (SubmissionAttachment att : s.getAttachments()) {
                            files.add(new ReviewContext.Attachment(att.getFileName(), att.getFileUrl()));
                        }
                        subs.add(new ReviewContext.Submission(s.getId(), cut(s.getNote()), s.getActualValue(),
                                s.getQualitativeLevel() == null ? null : s.getQualitativeLevel().getName(),
                                s.getStatus() == null ? null : s.getStatus().name(), s.getCreatedAt(), files, List.of()));
                    });

            boolean qualitative = kpi.getKpiType() == KpiType.QUALITATIVE;
            criteria.add(new ReviewContext.Criterion(kpi.getId(), kpi.getName(), cut(kpi.getDescription()),
                    qualitative, kpi.getUnit(), kpi.getTargetValue(), kpi.getMinimumValue(),
                    Boolean.TRUE.equals(kpi.getIsReverseKpi()),
                    kpi.getWeight() == null ? 0.0 : kpi.getWeight(),
                    kpi.getEffectiveDeadline(),
                    ratioOf(kpi, userId, qualitative, waterfall, subs.isEmpty()),
                    subs, history(userId, kpi.getName(), kpiPeriodId)));
        }

        List<ReviewContext.QualityLevel> scale = qualitativeLevelRepository
                .findByOrganizationIdOrderByPositionAsc(organizationId).stream()
                .map(l -> new ReviewContext.QualityLevel(l.getName(), l.getScorePercent(),
                        l.getPosition() == null ? 0 : l.getPosition()))
                .toList();

        // Trọng số theo ĐƠN VỊ của người được chấm (đơn vị gần nhất có cấu hình riêng), không thì theo công ty.
        ReviewContext.Weights weights = settingsResolver.resolve(org, userId).weights();
        return new ReviewContext(organizationId, kpiPeriodId, period == null ? null : period.getName(),
                userId, user == null ? null : user.getFullName(), criteria, scale, List.of(), weights,
                List.of(), settingsResolver.criteriaSetFor(organizationId, userId),
                conductSource.forPeriod(org, period));
    }

    /** Lần quản lý đã chấm chỉ tiêu cùng tên ở đợt trước — tham khảo, không vào điểm. */
    private List<ReviewContext.HistoryEntry> history(UUID userId, String kpiName, UUID kpiPeriodId) {
        if (kpiName == null) return List.of();
        return submissionRepository.findReviewedHistory(userId, kpiName, kpiPeriodId,
                        org.springframework.data.domain.PageRequest.of(0, HISTORY_SIZE)).stream()
                .map(s -> new ReviewContext.HistoryEntry(
                        s.getKpiCriteria().getKpiPeriod() == null ? null : s.getKpiCriteria().getKpiPeriod().getName(),
                        s.getManagerScore(),
                        s.getQualitativeLevel() == null ? null : s.getQualitativeLevel().getName(),
                        cutShort(s.getReviewNote())))
                .toList();
    }

    private static String cutShort(String text) {
        if (text == null) return null;
        String t = text.strip();
        return t.length() <= 300 ? t : t.substring(0, 300) + "…";
    }

    /** Tỉ lệ đạt do mã nguồn tính; {@code null} khi chỉ tiêu không đo được bằng số. */
    private Double ratioOf(KpiCriteria kpi, UUID userId, boolean qualitative, boolean waterfall, boolean noSubmission) {
        if (qualitative) return achievementCalculator.qualitativeRatio(kpi, userId);
        if (kpi.getCompensatedAchievementPercent() == null
                && (kpi.getTargetValue() == null || kpi.getTargetValue() == 0)) return null;
        if (noSubmission && kpi.getCompensatedAchievementPercent() == null) return 0.0;
        return achievementCalculator.ratio(kpi, userId, waterfall);
    }

    private String cut(String text) {
        if (text == null) return null;
        String t = text.strip();
        return t.length() <= noteMaxChars ? t : t.substring(0, noteMaxChars) + " …[đã cắt]";
    }
}
