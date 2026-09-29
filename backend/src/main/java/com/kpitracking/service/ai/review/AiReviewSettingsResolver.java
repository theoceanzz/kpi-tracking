package com.kpitracking.service.ai.review;

import com.kpitracking.entity.AiCriteriaSet;
import com.kpitracking.entity.AiReviewUnitSetting;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.repository.AiCriteriaSetItemRepository;
import com.kpitracking.repository.AiCriteriaSetRepository;
import com.kpitracking.repository.AiReviewUnitSettingRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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

    /** Cấu hình hiệu lực. {@code source} nói nó đến từ đâu, để màn hình giải thích được. */
    public record Effective(boolean enabled, ReviewContext.Weights weights, UUID fromUnitId, String source) {}

    @Transactional(readOnly = true)
    public Effective resolve(Organization org, UUID userId) {
        ReviewContext.Weights companyWeights = new ReviewContext.Weights(
                nz(org.getAiReviewWeightTarget(), 60), nz(org.getAiReviewWeightQuality(), 30), nz(org.getAiReviewWeightOnTime(), 10));
        boolean companyOn = Boolean.TRUE.equals(org.getEnableAi()) && Boolean.TRUE.equals(org.getEnableAiReview());
        if (!companyOn) return new Effective(false, companyWeights, null, "Công ty");

        String path = primaryUnitPath(userId);
        Map<UUID, String> paths = unitPaths(org.getId());
        Optional<AiReviewUnitSetting> nearest = unitSettingRepository.findByOrganizationId(org.getId()).stream()
                .filter(s -> path != null && paths.get(s.getOrgUnitId()) != null && path.startsWith(paths.get(s.getOrgUnitId())))
                .max(Comparator.comparingInt(s -> paths.get(s.getOrgUnitId()).length()));
        if (nearest.isEmpty()) return new Effective(true, companyWeights, null, "Công ty");
        AiReviewUnitSetting s = nearest.get();
        return new Effective(Boolean.TRUE.equals(s.getEnabled()),
                new ReviewContext.Weights(s.getWeightTarget(), s.getWeightQuality(), s.getWeightOnTime()),
                s.getOrgUnitId(), "Đơn vị");
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
                        i.getKind()))
                .toList();
        return new ReviewContext.CriteriaSet(chosen.getId(), chosen.getVersion() == null ? 1 : chosen.getVersion(),
                chosen.getTitle(), rows);
    }

    /**
     * Tài liệu kho của các quy chế đang áp cho đơn vị KHÁC — không được trích khi chấm bài người này (mỗi đơn vị
     * một quy chế). Giữ lại tài liệu của bộ đã chọn cho người này ({@code chosenSetId}, có thể null) và mọi tài liệu
     * nạp tay qua "Tài liệu trợ lý AI" (không gắn bộ tiêu chí nào).
     */
    @Transactional(readOnly = true)
    public List<String> regulationDocsNotFor(UUID organizationId, UUID chosenSetId) {
        List<AiCriteriaSet> active = criteriaSetRepository.findByOrganizationIdAndStatus(organizationId, AiCriteriaSet.CONFIRMED);
        UUID keep = active.stream().filter(s -> s.getId().equals(chosenSetId))
                .map(AiCriteriaSet::getRagDocumentId).findFirst().orElse(null);
        return active.stream()
                .map(AiCriteriaSet::getRagDocumentId)
                .filter(d -> d != null && !d.equals(keep))
                .map(UUID::toString).distinct().toList();
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

    private static int nz(Integer v, int dflt) {
        return v == null ? dflt : v;
    }
}
