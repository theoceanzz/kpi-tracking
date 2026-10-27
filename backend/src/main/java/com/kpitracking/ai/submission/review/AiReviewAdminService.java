package com.kpitracking.ai.submission.review;

import com.kpitracking.dto.response.ai.AiReviewReportResponse;
import com.kpitracking.dto.response.ai.AiReviewUnitSettingResponse;
import com.kpitracking.entity.ai.AiReviewUnitSetting;
import com.kpitracking.entity.ai.AiSubmissionReview;
import com.kpitracking.entity.ai.AiSubmissionReviewItem;
import com.kpitracking.entity.evaluation.Evaluation;
import com.kpitracking.entity.organization.OrgUnit;
import com.kpitracking.entity.organization.Organization;
import com.kpitracking.entity.user.User;
import com.kpitracking.entity.user.UserRoleOrgUnit;
import com.kpitracking.enums.ai.AiReviewStatus;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.ai.AiReviewUnitSettingRepository;
import com.kpitracking.repository.ai.AiSubmissionReviewItemRepository;
import com.kpitracking.repository.ai.AiSubmissionReviewRepository;
import com.kpitracking.repository.evaluation.EvaluationRepository;
import com.kpitracking.repository.organization.OrgUnitRepository;
import com.kpitracking.repository.user.UserRepository;
import com.kpitracking.repository.user.UserRoleOrgUnitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Quản trị tính năng AI đánh giá bài nộp: cấu hình theo ĐƠN VỊ và báo cáo giám sát chất lượng chấm.
 *
 * <p>Báo cáo so điểm AI đề xuất (tổng điểm đề xuất các chỉ tiêu, cùng thang 100 với điểm hệ thống) với điểm
 * quản lý đã chốt ({@code evaluations.score} của người chấm khác chính nhân viên). Đây là số đo "AI có đáng
 * tin không" của cả ba giai đoạn — tài liệu phân tích mục 10.4 và 25.
 */
@Service
@RequiredArgsConstructor
public class AiReviewAdminService {

    private final AiReviewUnitSettingRepository unitSettingRepository;
    private final AiSubmissionReviewRepository reviewRepository;
    private final AiSubmissionReviewItemRepository itemRepository;
    private final EvaluationRepository evaluationRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final ReviewContextBuilder contextBuilder;
    private final AiReviewLatestView latestView;
    private final AiReviewSettingsResolver settingsResolver;

    // ── cấu hình theo đơn vị ──────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AiReviewUnitSettingResponse> unitSettings() {
        Organization org = organizationOf(currentUser());
        Map<UUID, String> names = unitNames(org.getId());
        return unitSettingRepository.findByOrganizationId(org.getId()).stream()
                .map(s -> toResponse(s, names))
                .sorted(Comparator.comparing(r -> r.getOrgUnitName() == null ? "" : r.getOrgUnitName()))
                .toList();
    }

    /** Tắt AI cho đơn vị và các đơn vị con. Từ 13/10 không còn trọng số riêng nên đây là cấu hình riêng duy nhất. */
    @Transactional
    public AiReviewUnitSettingResponse turnOffForUnit(UUID orgUnitId) {
        Organization org = organizationOf(currentUser());
        Map<UUID, String> names = unitNames(org.getId());
        if (!names.containsKey(orgUnitId)) throw new ForbiddenException("Đơn vị không thuộc tổ chức của bạn.");
        AiReviewUnitSetting s = unitSettingRepository.findById(orgUnitId)
                .orElse(AiReviewUnitSetting.builder().orgUnitId(orgUnitId).organizationId(org.getId()).build());
        s.setEnabled(false);
        s.setUpdatedAt(Instant.now());
        return toResponse(unitSettingRepository.save(s), names);
    }

    /** Bỏ cấu hình riêng — đơn vị quay về theo đơn vị cha / công ty. */
    @Transactional
    public void deleteUnitSetting(UUID orgUnitId) {
        Organization org = organizationOf(currentUser());
        unitSettingRepository.findById(orgUnitId)
                .filter(s -> s.getOrganizationId().equals(org.getId()))
                .ifPresent(unitSettingRepository::delete);
    }

    private static AiReviewUnitSettingResponse toResponse(AiReviewUnitSetting s, Map<UUID, String> names) {
        return AiReviewUnitSettingResponse.builder()
                .orgUnitId(s.getOrgUnitId()).orgUnitName(names.get(s.getOrgUnitId())).enabled(s.getEnabled())
                .build();
    }

    // ── báo cáo lệch AI – quản lý ─────────────────────────────────────────

    /**
     * Mỗi người lấy kết quả AI HIỆN HÀNH trong đợt: item mới nhất của từng chỉ tiêu, gộp từ các lượt {@code DONE}
     * ({@link AiReviewLatestView}) — lượt mới nhất có thể chỉ chấm lẻ một bài, lấy riêng nó thì tổng tụt về một chỉ
     * tiêu. Chỉ gồm người mà người xem chấm được (cùng luật phạm vi với lượt lẻ); lọc thêm theo nhánh đơn vị nếu có.
     */
    @Transactional(readOnly = true)
    public AiReviewReportResponse report(UUID kpiPeriodId, UUID orgUnitId) {
        User me = currentUser();
        Organization org = organizationOf(me);
        // Thang điểm AI (V51) — % của mức AI chọn cho báo cáo lệch và mức tin cậy của dòng (luật 07/10).
        List<ReviewContext.QualityLevel> scale = settingsResolver.aiScale(org.getId()).levels();
        Map<UUID, OrgUnit> units = orgUnitRepository.findSubtree("/", org.getId()).stream()
                .collect(Collectors.toMap(OrgUnit::getId, u -> u, (a, b) -> a));
        String branch = orgUnitId == null || units.get(orgUnitId) == null ? null : units.get(orgUnitId).getPath();

        Map<UUID, List<AiSubmissionReview>> doneByUser = new LinkedHashMap<>();
        for (AiSubmissionReview r : reviewRepository.findByOrganizationIdAndKpiPeriodIdAndStatusOrderByCreatedAtDesc(
                org.getId(), kpiPeriodId, AiReviewStatus.DONE)) {
            doneByUser.computeIfAbsent(r.getUserId(), k -> new ArrayList<>()).add(r);
        }

        List<AiReviewReportResponse.Row> rows = new ArrayList<>();
        for (List<AiSubmissionReview> done : doneByUser.values()) {
            // Lượt "nền" của dòng: lượt cả phiếu mới nhất, không có thì lượt mới nhất.
            AiSubmissionReview r = done.stream().filter(AiReviewLatestView::isFull).findFirst().orElse(done.get(0));
            try {
                contextBuilder.requireCanReview(me.getId(), r.getUserId());
            } catch (ForbiddenException e) {
                continue;
            }
            OrgUnit unit = primaryUnit(r.getUserId());
            if (branch != null && (unit == null || !unit.getPath().startsWith(branch))) continue;

            // Chỉ chỉ tiêu còn trên phiếu AI — kết quả cũ của chỉ tiêu nay đã xin tạm dừng không cộng vào nữa.
            List<AiSubmissionReviewItem> items = latestView.merge(done,
                    contextBuilder.reviewableCriteria(kpiPeriodId, r.getUserId())).items();
            // Điểm AI nằm trên thang riêng (chỉ chất lượng, 13/10) nên so theo %: Σđiểm/Σtối đa — mọi chỉ tiêu cùng một
            // điểm tối đa nên bằng trung bình % chất lượng của các chỉ tiêu AI chấm được. Quản lý: điểm đánh giá thang 100.
            Double ai = items.stream()
                    .map(i -> ReviewScoreCalculator.qualityPercentOf(i.getQualityLevel(), scale))
                    .filter(Objects::nonNull)
                    .mapToDouble(v -> Math.max(0.0, Math.min(v, 100.0)))
                    .average().stream().boxed().findFirst().orElse(null);
            // Không có bài nộp nào thì AI không có gì để chấm (điểm 0 là "thiếu dữ liệu", không phải nhận định)
            // — đưa vào mẫu chỉ làm phồng sai số. Vẫn hiện dòng, không tính lệch.
            boolean hadSubmissions = items.stream().anyMatch(i -> i.getKpiSubmissionId() != null);
            Double manager = hadSubmissions ? managerScore(r.getUserId(), kpiPeriodId) : null;
            User u = userRepository.findById(r.getUserId()).orElse(null);
            rows.add(AiReviewReportResponse.Row.builder()
                    .userId(r.getUserId()).userName(u == null ? null : u.getFullName())
                    .unitName(unit == null ? null : unit.getName()).reviewId(r.getId())
                    .aiScore(ai == null ? null : round(ai)).managerScore(manager)
                    .difference(manager == null || ai == null ? null : round(ai - manager))
                    .confidence(confidenceOf(items, scale, r))
                    .build());
        }
        rows.sort(Comparator.comparing((AiReviewReportResponse.Row x) -> x.getDifference() == null ? -1 : Math.abs(x.getDifference())).reversed());

        List<AiReviewReportResponse.Row> compared = rows.stream().filter(x -> x.getDifference() != null).toList();
        Map<String, List<AiReviewReportResponse.Row>> byUnit = new HashMap<>();
        for (AiReviewReportResponse.Row x : compared) byUnit.computeIfAbsent(x.getUnitName() == null ? "—" : x.getUnitName(), k -> new ArrayList<>()).add(x);

        return AiReviewReportResponse.builder()
                .compared(compared.size())
                .meanAbsoluteError(compared.isEmpty() ? null : round(compared.stream().mapToDouble(x -> Math.abs(x.getDifference())).average().orElse(0)))
                .withinFivePercent(compared.isEmpty() ? null : round(100.0 * compared.stream().filter(x -> Math.abs(x.getDifference()) <= 5).count() / compared.size()))
                .meanBias(compared.isEmpty() ? null : round(compared.stream().mapToDouble(AiReviewReportResponse.Row::getDifference).average().orElse(0)))
                .rows(rows)
                .units(byUnit.entrySet().stream()
                        .map(e -> AiReviewReportResponse.UnitRow.builder()
                                .unitName(e.getKey()).compared(e.getValue().size())
                                .meanAbsoluteError(round(e.getValue().stream().mapToDouble(x -> Math.abs(x.getDifference())).average().orElse(0)))
                                .meanBias(round(e.getValue().stream().mapToDouble(AiReviewReportResponse.Row::getDifference).average().orElse(0)))
                                .build())
                        .sorted(Comparator.comparing(AiReviewReportResponse.UnitRow::getMeanAbsoluteError).reversed())
                        .toList())
                .build();
    }

    /** Điểm quản lý đã chốt: lần chấm mới nhất của một người KHÁC chính nhân viên (bỏ tự đánh giá). */
    private Double managerScore(UUID userId, UUID kpiPeriodId) {
        return evaluationRepository.findByUserIdAndKpiPeriodId(userId, kpiPeriodId).stream()
                .filter(e -> e.getEvaluator() != null && !userId.equals(e.getEvaluator().getId()) && e.getScore() != null)
                .max(Comparator.comparing(Evaluation::getCreatedAt, Comparator.nullsFirst(Comparator.naturalOrder())))
                .map(Evaluation::getScore)
                .orElse(null);
    }

    private OrgUnit primaryUnit(UUID userId) {
        UserRoleOrgUnit primary = com.kpitracking.service.PrimaryUnitResolver.pick(
                userRoleOrgUnitRepository.findByUserId(userId),
                userRepository.findById(userId).map(com.kpitracking.entity.user.User::getPrimaryOrgUnitId).orElse(null));
        return primary != null ? primary.getOrgUnit() : null;
    }

    private Map<UUID, String> unitNames(UUID orgId) {
        Map<UUID, String> out = new java.util.HashMap<>();   // toMap không nhận giá trị null
        for (OrgUnit u : orgUnitRepository.findSubtree("/", orgId)) out.put(u.getId(), u.getName());
        return out;
    }

    private Organization organizationOf(User me) {
        List<UserRoleOrgUnit> a = userRoleOrgUnitRepository.findByUserId(me.getId());
        if (a.isEmpty() || a.get(0).getOrgUnit() == null) throw new ForbiddenException("Bạn chưa thuộc tổ chức nào.");
        return a.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization();
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
    }

    private static double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    /**
     * Mức tin cậy của một dòng báo cáo: thấp nhất trong các chỉ tiêu, mỗi chỉ tiêu tính lại theo chất lượng AI chấm
     * ({@link ReviewResultValidator#qualityConfidence}) — cùng luật với màn chấm. Không có chỉ tiêu nào thì lấy mức của lượt.
     */
    private static String confidenceOf(List<AiSubmissionReviewItem> items, List<ReviewContext.QualityLevel> scale,
                                       AiSubmissionReview base) {
        String lowest = ReviewResultValidator.lowest(items.stream()
                .map(i -> ReviewResultValidator.qualityConfidence(i.getQualityLevel(), scale,
                        i.getErrorMessage() != null, i.getKpiSubmissionId() != null).level())
                .toList());
        return lowest != null ? lowest : base.getConfidence();
    }
}
