package com.kpitracking.ai.submission.review;

import com.kpitracking.entity.ai.AiCriteriaSet;
import com.kpitracking.entity.ai.AiReviewUnitSetting;
import com.kpitracking.entity.organization.OrgUnit;
import com.kpitracking.entity.ai.RagDocument;
import com.kpitracking.entity.organization.Organization;
import com.kpitracking.entity.user.UserRoleOrgUnit;
import com.kpitracking.repository.ai.AiCriteriaSetItemRepository;
import com.kpitracking.repository.ai.AiCriteriaSetRepository;
import com.kpitracking.repository.ai.AiReviewLevelRepository;
import com.kpitracking.repository.ai.AiReviewUnitSettingRepository;
import com.kpitracking.repository.organization.OrgUnitRepository;
import com.kpitracking.repository.ai.RagDocumentRepository;
import com.kpitracking.repository.user.UserRoleOrgUnitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Cấu hình AI đánh giá bài nộp HIỆU LỰC cho một người, theo luật tài liệu phân tích mục 4.1:
 * công ty tắt thì mọi cấp tắt; công ty bật thì đơn vị quyết — lấy bản ghi của đơn vị GẦN NHẤT trên đường
 * từ đơn vị của người đó lên gốc; không có bản ghi nào thì theo công ty. "Chức danh" là quyền
 * {@code AI_REVIEW:USE} gắn với vai trò; "từng người" theo hạn mức token AI sẵn có.
 *
 * <p>Bộ tiêu chí chọn cùng luật: bộ đã xác nhận của đơn vị gần nhất, không có thì bộ của cả tổ chức.
 */
@Component
@RequiredArgsConstructor
public class AiReviewSettingsResolver {

    private final AiReviewUnitSettingRepository unitSettingRepository;
    private final AiCriteriaSetRepository criteriaSetRepository;
    private final AiCriteriaSetItemRepository criteriaSetItemRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final RagDocumentRepository ragDocumentRepository;
    private final AiReviewLevelRepository levelRepository;

    /** Cấu hình hiệu lực. {@code source} nói nó đến từ đâu, để màn hình giải thích được. */
    public record Effective(boolean enabled, UUID fromUnitId, String source) {}

    /**
     * Thang điểm AI của công ty (V51) và điểm tối đa (= điểm mức cao nhất). Trống khi chưa cấu hình: khi đó AI không được
     * hỏi mức (như thang định tính trống trước đây) nên không ra điểm.
     */
    public record AiScale(List<ReviewContext.QualityLevel> levels, java.math.BigDecimal max) {
        public static final AiScale EMPTY = new AiScale(List.of(), null);
    }

    /** MỘT chỗ dựng thang AI — luồng chấm, đọc kết quả và báo cáo lệch đều đi qua đây. */
    @Transactional(readOnly = true)
    public AiScale aiScale(UUID organizationId) {
        return scaleOf(levelRepository.findByOrganizationIdOrderByPositionAsc(organizationId));
    }

    static AiScale scaleOf(List<com.kpitracking.entity.ai.AiReviewLevel> rows) {
        double max = rows.stream().mapToDouble(l -> l.getPoints() == null ? 0 : l.getPoints().doubleValue()).max().orElse(0);
        if (max <= 0) return AiScale.EMPTY;
        List<ReviewContext.QualityLevel> levels = rows.stream()
                .sorted(Comparator.comparing((com.kpitracking.entity.ai.AiReviewLevel l) -> l.getPoints())
                        .thenComparing(com.kpitracking.entity.ai.AiReviewLevel::getPosition))
                .map(l -> new ReviewContext.QualityLevel(l.getName(), l.getPoints().doubleValue() * 100.0 / max,
                        l.getPosition() == null ? 0 : l.getPosition(), l.getPoints().doubleValue(), l.getDescription()))
                .toList();
        return new AiScale(levels, java.math.BigDecimal.valueOf(max).setScale(2, java.math.RoundingMode.HALF_UP));
    }

    @Transactional(readOnly = true)
    public Effective resolve(Organization org, UUID userId) {
        boolean companyOn = Boolean.TRUE.equals(org.getEnableAi()) && Boolean.TRUE.equals(org.getEnableAiReview());
        if (!companyOn) return new Effective(false, null, "Công ty");

        String path = primaryUnitPath(userId);
        Map<UUID, String> paths = unitPaths(org.getId());
        Optional<AiReviewUnitSetting> nearest = unitSettingRepository.findByOrganizationId(org.getId()).stream()
                .filter(s -> path != null && paths.get(s.getOrgUnitId()) != null && path.startsWith(paths.get(s.getOrgUnitId())))
                .max(Comparator.comparingInt(s -> paths.get(s.getOrgUnitId()).length()));
        if (nearest.isEmpty()) return new Effective(true, null, "Công ty");
        AiReviewUnitSetting s = nearest.get();
        return new Effective(Boolean.TRUE.equals(s.getEnabled()), s.getOrgUnitId(), "Đơn vị");
    }

    /** Bộ tiêu chí đã xác nhận áp cho người này, hoặc {@code null}. */
    @Transactional(readOnly = true)
    public ReviewContext.CriteriaSet criteriaSetFor(UUID organizationId, UUID userId) {
        List<AiCriteriaSet> confirmed = criteriaSetRepository.findByOrganizationIdAndStatus(organizationId, AiCriteriaSet.CONFIRMED);
        if (confirmed.isEmpty()) return null;
        String path = primaryUnitPath(userId);
        Map<UUID, String> paths = unitPaths(organizationId);
        AiCriteriaSet chosen = confirmed.stream()
                .filter(s -> s.getOrgUnitId() != null && path != null && paths.get(s.getOrgUnitId()) != null
                        && path.startsWith(paths.get(s.getOrgUnitId())))
                .max(Comparator.comparingInt(s -> paths.get(s.getOrgUnitId()).length()))
                .orElseGet(() -> confirmed.stream().filter(s -> s.getOrgUnitId() == null).findFirst().orElse(null));
        if (chosen == null) return null;
        List<ReviewContext.CriteriaRow> rows = criteriaSetItemRepository.findBySetIdOrderByPositionAsc(chosen.getId()).stream()
                .map(i -> new ReviewContext.CriteriaRow(i.getName(), i.getDescription(),
                        i.getWeight() == null ? null : i.getWeight().doubleValue(), i.getScaleLevels(), i.getScope(),
                        i.getKind(), i.getSourceExcerpt(),
                        // Máy đối chiếu thấy đoạn gốc trong tài liệu, hoặc người duyệt đã xác nhận dòng này.
                        Boolean.TRUE.equals(i.getExcerptVerified()) || Boolean.TRUE.equals(i.getReviewerConfirmed()),
                        i.getTopic()))
                .toList();
        return new ReviewContext.CriteriaSet(chosen.getId(), chosen.getVersion() == null ? 1 : chosen.getVersion(),
                chosen.getTitle(), rows);
    }

    /**
     * Tài liệu kho ĐƯỢC trích khi chấm bài người này (mỗi đơn vị một quy chế): tài liệu của bộ đã chọn cho người đó
     * ({@code chosenSetId}, có thể null) + tài liệu nạp tay qua "Tài liệu trợ lý AI" (không gắn bộ tiêu chí nào) —
     * chỉ bản đã nạp xong.
     *
     * <p>Lấy từ bảng {@code rag_documents} làm danh sách CHO PHÉP. Trước đây là danh sách CHẶN (tài liệu của bộ đang
     * áp cho đơn vị khác), nên đoạn "mồ côi" trong kho vector — tài liệu đã xoá, hoặc DB dựng lại mà kho vector giữ
     * nguyên — vẫn lọt vào mọi đơn vị (29/09: quy chế IT-OPS cũ hiện trong kết quả của Phòng Truyền thông).
     */
    @Transactional(readOnly = true)
    public List<String> regulationDocsFor(UUID organizationId, UUID chosenSetId) {
        List<AiCriteriaSet> sets = criteriaSetRepository.findByOrganizationIdOrderByCreatedAtDesc(organizationId);
        Set<UUID> linkedToSets = new HashSet<>();
        UUID chosenDoc = null;
        for (AiCriteriaSet s : sets) {
            if (s.getRagDocumentId() == null) continue;
            linkedToSets.add(s.getRagDocumentId());
            if (s.getId().equals(chosenSetId) && AiCriteriaSet.CONFIRMED.equals(s.getStatus())) chosenDoc = s.getRagDocumentId();
        }
        List<String> allowed = new ArrayList<>();
        for (RagDocument d : ragDocumentRepository.findByOrganizationIdOrderByCreatedAtDesc(organizationId)) {
            if (d.getStatus() != RagDocument.Status.READY) continue;
            if (d.getId().equals(chosenDoc) || !linkedToSets.contains(d.getId())) allowed.add(d.getId().toString());
        }
        return allowed;
    }

    private String primaryUnitPath(UUID userId) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        return assignments.stream().map(UserRoleOrgUnit::getOrgUnit)
                .filter(u -> u != null && u.getPath() != null)
                .map(OrgUnit::getPath)
                .findFirst().orElse(null);
    }

    private Map<UUID, String> unitPaths(UUID organizationId) {
        Map<UUID, String> out = new HashMap<>();
        for (OrgUnit u : orgUnitRepository.findSubtree("/", organizationId)) out.put(u.getId(), u.getPath());
        return out;
    }
}
