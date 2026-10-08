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

    /**
     * Chỉ tiêu còn hiệu lực trong đợt — đi qua {@code scoringStatuses} của core để chính sách KPI
     * khoá kỳ (CLOSED_BY_LOCK) đổi ở MỘT chỗ là cả điểm hệ thống lẫn bộ chấm AI đổi theo.
     */
    private static final List<KpiStatus> ACTIVE = KpiAchievementCalculator.scoringStatuses(List.of(
            KpiStatus.APPROVED, KpiStatus.EDITED, KpiStatus.EDIT, KpiStatus.INACTIVE));

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
    private final com.kpitracking.repository.KpiAdjustmentRequestRepository adjustmentRepository;

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

    /**
     * Id các chỉ tiêu sẽ có mặt trong phiếu AI của người này — cùng bộ lọc với {@link #build} (được giao, tính vào
     * điểm, không xin tạm dừng). Lượt chấm lẻ chỉ nhận id trong tập này.
     */
    @Transactional(readOnly = true)
    public java.util.Set<UUID> reviewableCriteria(UUID kpiPeriodId, UUID userId) {
        return sheetKpis(kpiPeriodId, userId).stream().map(KpiCriteria::getId)
                .collect(java.util.stream.Collectors.toSet());
    }

    /** Id các chỉ tiêu được giao cho người này mà đã / đang xin tạm dừng — để báo đúng lý do khi AI từ chối chấm. */
    @Transactional(readOnly = true)
    public java.util.Set<UUID> pausedCriteria(UUID kpiPeriodId, UUID userId) {
        return pausedIds(assignedKpis(kpiPeriodId, userId));
    }

    private List<KpiCriteria> assignedKpis(UUID kpiPeriodId, UUID userId) {
        return kpiCriteriaRepository
                .findByUserIdInAssigneesAndKpiPeriodId(userId, kpiPeriodId, ACTIVE, Pageable.unpaged())
                .getContent();
    }

    /**
     * Chỉ tiêu của phiếu AI: được giao, tính vào điểm ({@code countsTowardBscScore}) và KHÔNG xin tạm dừng.
     *
     * <p>Core vẫn tính KPI đã duyệt tạm dừng (có % bù) vào điểm BSC, nhưng AI không có gì để chấm ở đó — và để nó trong
     * mẫu số thì điểm tối đa của mọi chỉ tiêu khác co lại (trọng số 30 tạm dừng làm 25 thành 19,2), lệch với thang của
     * bảng chấm (06/10).
     */
    private List<KpiCriteria> sheetKpis(UUID kpiPeriodId, UUID userId) {
        List<KpiCriteria> kpis = assignedKpis(kpiPeriodId, userId);
        java.util.Set<UUID> paused = pausedIds(kpis);
        return kpis.stream()
                .filter(achievementCalculator::countsTowardBscScore)
                .filter(k -> !paused.contains(k.getId()))
                .toList();
    }

    /** Đã duyệt tạm dừng ({@code INACTIVE}) hoặc đang có yêu cầu xin tạm dừng chờ duyệt. */
    private java.util.Set<UUID> pausedIds(List<KpiCriteria> kpis) {
        java.util.Set<UUID> paused = new java.util.HashSet<>();
        kpis.stream().filter(k -> k.getStatus() == KpiStatus.INACTIVE).forEach(k -> paused.add(k.getId()));
        List<UUID> editing = kpis.stream().filter(k -> k.getStatus() == KpiStatus.EDIT).map(KpiCriteria::getId).toList();
        if (!editing.isEmpty()) paused.addAll(adjustmentRepository.findPendingDeactivationCriteriaIds(editing));
        return paused;
    }

    /** Đọc và cắt gọn mọi dữ liệu cho một lượt. Gọi TRONG transaction (luồng nền mở REQUIRES_NEW). */
    @Transactional(readOnly = true)
    public ReviewContext build(UUID organizationId, UUID kpiPeriodId, UUID userId, Organization org) {
        KpiPeriod period = kpiPeriodRepository.findById(kpiPeriodId).orElse(null);
        User user = userRepository.findById(userId).orElse(null);
        boolean waterfall = Boolean.TRUE.equals(org.getEnableWaterfall());

        /*
          Pool trọng số phải khớp thang điểm thật của quản lý, nếu không `normFactor` (= 100/Σw) chia trên một mẫu số
          lớn hơn. Vị từ của core loại KPI khoá kỳ, huỷ không bù, cha phân rã, thưởng, thiếu trọng số, định lượng thiếu
          chỉ tiêu; sheetKpis loại thêm KPI xin tạm dừng (core vẫn tính chúng theo % bù).
         */
        List<KpiCriteria> kpis = sheetKpis(kpiPeriodId, userId);

        List<ReviewContext.Criterion> criteria = new ArrayList<>();
        for (KpiCriteria kpi : kpis) {
            List<ReviewContext.Submission> subs = new ArrayList<>();
            kpi.getSubmissions().stream()
                    // Bài đã TRẢ LẠI là lịch sử (quy ước ở SubmissionStatus.RETURNED: không tính ở chỗ chấm nào) —
                    // AI không đọc, không trích, không tính đúng hạn trên nó; nhân viên nộp lại thì chấm bài mới.
                    .filter(s -> s.getDeletedAt() == null && s.getSubmittedBy() != null
                            && userId.equals(s.getSubmittedBy().getId())
                            && s.getStatus() != com.kpitracking.enums.SubmissionStatus.RETURNED)
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

    /**
     * Ngữ cảnh cho luồng nhân viên TỰ SOI: đúng MỘT chỉ tiêu, bài là bản đang soạn (chưa lưu, chưa nộp). Không có
     * thang chất lượng, lịch sử chấm hay tỉ lệ đạt — luồng này không chọn mức, không tính số.
     */
    @Transactional(readOnly = true)
    public ReviewContext buildDraft(Organization org, UUID userId, UUID kpiCriteriaId, ReviewContext.Submission draft) {
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiCriteriaId).orElseThrow();
        User user = userRepository.findById(userId).orElse(null);
        KpiPeriod period = kpi.getKpiPeriod();
        ReviewContext.Submission sub = new ReviewContext.Submission(draft.id(), cut(draft.note()), draft.actualValue(),
                draft.qualitativeLevel(), draft.status(), draft.submittedAt(), draft.attachments(), draft.evidence());
        ReviewContext.Criterion c = new ReviewContext.Criterion(kpi.getId(), kpi.getName(), cut(kpi.getDescription()),
                kpi.getKpiType() == KpiType.QUALITATIVE, kpi.getUnit(), kpi.getTargetValue(), kpi.getMinimumValue(),
                Boolean.TRUE.equals(kpi.getIsReverseKpi()), kpi.getWeight() == null ? 0.0 : kpi.getWeight(),
                kpi.getEffectiveDeadline(), null, List.of(sub), List.of());
        return new ReviewContext(org.getId(), period == null ? null : period.getId(),
                period == null ? null : period.getName(), userId, user == null ? null : user.getFullName(),
                List.of(c), List.of(), List.of(), settingsResolver.resolve(org, userId).weights(),
                List.of(), settingsResolver.criteriaSetFor(org.getId(), userId), List.of());
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
