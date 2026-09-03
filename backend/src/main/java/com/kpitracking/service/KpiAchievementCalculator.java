package com.kpitracking.service;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.entity.QualitativeLevel;
import com.kpitracking.enums.KpiParentRelationType;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.repository.KpiCriteriaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Nguồn chân lý DUY NHẤT cho công thức tính "tỉ lệ đạt" của một KPI.
 *
 * Được dùng bởi cả EvaluationService (system_score) và BscScoringService (bsc_score)
 * để hai điểm này luôn so sánh được với nhau — tránh mỗi nơi một công thức rồi trôi lệch.
 * Muốn đổi cách tính đạt: sửa DUY NHẤT ở đây.
 */
@Component
@RequiredArgsConstructor
public class KpiAchievementCalculator {

    private final KpiCriteriaRepository kpiCriteriaRepository;

    /** Trần tỉ lệ đạt (150%) — vượt mức vẫn bị chặn để 1 KPI không kéo lệch toàn bộ điểm. */
    public static final double MAX_RATIO = 1.5;

    /**
     * Giá trị thực đạt của KPI.
     * - Waterfall bật + có KPI con: lấy TRUNG BÌNH giá trị của các con (điểm chảy ngược lên).
     * - Ngược lại: tổng actualValue các submission của user (targetUserId null = tính mọi người).
     */
    public double actualValue(KpiCriteria kpi, UUID targetUserId, boolean enableWaterfall) {
        if (enableWaterfall) {
            List<KpiCriteria> children = kpiCriteriaRepository.findByParentId(kpi.getId());
            if (!children.isEmpty()) {
                return children.stream()
                        .mapToDouble(child -> actualValue(child, null, true))
                        .average()
                        .orElse(0.0);
            }
        }
        return kpi.getSubmissions().stream()
                .filter(s -> s.getDeletedAt() == null
                        && (targetUserId == null || s.getSubmittedBy().getId().equals(targetUserId))
                        && (s.getStatus() == SubmissionStatus.APPROVED
                            || s.getStatus() == SubmissionStatus.PENDING
                            || s.getStatus() == SubmissionStatus.REJECTED))
                .mapToDouble(s -> s.getActualValue() != null ? s.getActualValue() : 0.0)
                .sum();
    }

    /**
     * Giá trị thực đạt có vi phạm ngưỡng {@code minimumValue} không?
     * - KPI ngược (càng thấp càng tốt): minimumValue là NGƯỠNG TỆ NHẤT chấp nhận được ⇒ vi phạm khi actual > min.
     * - KPI thường: minimumValue là sàn ⇒ vi phạm khi actual < min.
     * Vi phạm ngưỡng ⇒ bài nộp bị từ chối và tỉ lệ đạt = 0.
     */
    public boolean breachesThreshold(KpiCriteria kpi, double actual) {
        Double minVal = kpi.getMinimumValue();
        if (minVal == null) return false;
        return Boolean.TRUE.equals(kpi.getIsReverseKpi()) ? actual > minVal : actual < minVal;
    }

    /**
     * NGUỒN CHÂN LÝ DUY NHẤT: tỉ lệ đạt (0..1.5) tính từ một giá trị thực đạt.
     * Dùng chung bởi autoScore (KpiSubmissionService) và system_score/bsc_score
     * ⇒ ba con số này không bao giờ lệch công thức.
     *
     * Thứ tự áp dụng:
     *  1. Có compensatedAchievementPercent (KPI huỷ có bù) → dùng thẳng giá trị bù.
     *  2. Vi phạm ngưỡng minimumValue → 0.
     *  3. KPI ngược: max(0, 2 - actual/target); KPI thường: actual/target.
     *  4. Chặn trần MAX_RATIO.
     */
    public double ratioFromActual(KpiCriteria kpi, double actual) {
        if (kpi.getCompensatedAchievementPercent() != null) {
            return Math.min(kpi.getCompensatedAchievementPercent() / 100.0, MAX_RATIO);
        }
        if (kpi.getTargetValue() == null || kpi.getTargetValue() == 0) return 0.0;
        if (breachesThreshold(kpi, actual)) return 0.0;
        boolean isInverse = Boolean.TRUE.equals(kpi.getIsReverseKpi());
        double ratio = isInverse
                ? Math.max(0.0, 2.0 - (actual / kpi.getTargetValue()))
                : actual / kpi.getTargetValue();
        return Math.min(ratio, MAX_RATIO);
    }

    /**
     * Tỉ lệ đạt (0..1.5) của MỘT HẠNG MỤC BSC tự chấm theo mục tiêu của chính nó (kiểu OKR):
     * cộng dồn giá trị thực đạt của các KPI định lượng trong hạng mục rồi so với mục tiêu hạng mục.
     *
     * Hạng mục không có cờ "ngược" nên {@code minimum} luôn là SÀN: dưới sàn ⇒ 0, giống KPI thường.
     * Trần vẫn là {@link #MAX_RATIO} để một hạng mục vượt mức không kéo lệch toàn bộ điểm BSC.
     */
    public double perspectiveRatioFromActual(Double target, Double minimum, double actual) {
        if (target == null || target == 0) return 0.0;
        if (minimum != null && actual < minimum) return 0.0;
        return Math.min(actual / target, MAX_RATIO);
    }

    /** Tỉ lệ đạt của KPI (0..1.5) tính từ các submission của user. */
    public double ratio(KpiCriteria kpi, UUID targetUserId, boolean enableWaterfall) {
        return ratioFromActual(kpi, actualValue(kpi, targetUserId, enableWaterfall));
    }

    /**
     * Tỉ lệ đạt của KPI ĐỊNH TÍNH (dùng cho điểm BSC).
     * Lấy mức được chấm ở submission mới nhất (APPROVED hoặc PENDING — giống cách tính behaviorScore)
     * rồi quy ra tỉ lệ theo score_percent do HR cấu hình trên thang định tính.
     *
     * Trả null khi: chưa được chấm mức, hoặc HR chưa cấu hình score_percent cho mức đó
     * ⇒ KPI này bị LOẠI khỏi điểm BSC (không tính trọng số) thay vì bị coi là 0đ —
     * tránh trừ oan nhân viên khi quản lý chưa kịp chấm.
     */
    public Double qualitativeRatio(KpiCriteria kpi, UUID targetUserId) {
        QualitativeLevel level = kpi.getSubmissions().stream()
                .filter(s -> s.getDeletedAt() == null
                        && (targetUserId == null || s.getSubmittedBy().getId().equals(targetUserId))
                        && (s.getStatus() == SubmissionStatus.APPROVED || s.getStatus() == SubmissionStatus.PENDING)
                        && s.getQualitativeLevel() != null)
                .max(Comparator.comparing(KpiSubmission::getCreatedAt, Comparator.nullsFirst(Comparator.naturalOrder())))
                .map(KpiSubmission::getQualitativeLevel)
                .orElse(null);
        if (level == null || level.getScorePercent() == null) return null;
        return Math.min(level.getScorePercent() / 100.0, MAX_RATIO);
    }

    /**
     * KPI có tham gia tính điểm BSC hay không (khác với điểm hệ thống: BSC tính CẢ định tính).
     * Loại: KPI huỷ không bù, KPI cha phân rã, KPI thưởng (ngoài pool trọng số), KPI thiếu trọng số,
     * và KPI định lượng thiếu target.
     */
    public boolean countsTowardBscScore(KpiCriteria kpi) {
        if (kpi.getStatus() == KpiStatus.INACTIVE && kpi.getCompensatedAchievementPercent() == null) return false;
        if (isDecompositionParent(kpi)) return false;
        if (Boolean.TRUE.equals(kpi.getIsBonusKpi())) return false;
        if (kpi.getWeight() == null || kpi.getWeight() <= 0) return false;
        if (kpi.getKpiType() == com.kpitracking.enums.KpiType.QUALITATIVE) return true;
        return kpi.getTargetValue() != null && kpi.getTargetValue() > 0;
    }

    /**
     * Tỉ lệ đạt dùng cho BSC — tự chọn công thức theo loại KPI.
     * Trả null nếu KPI định tính chưa chấm/chưa cấu hình % ⇒ loại khỏi điểm.
     */
    public Double bscRatio(KpiCriteria kpi, UUID targetUserId, boolean enableWaterfall) {
        if (kpi.getKpiType() == com.kpitracking.enums.KpiType.QUALITATIVE) {
            return qualitativeRatio(kpi, targetUserId);
        }
        return ratio(kpi, targetUserId, enableWaterfall);
    }

    /** KPI cha kiểu phân rã — không tự tính điểm (điểm nằm ở các KPI con). */
    public boolean isDecompositionParent(KpiCriteria kpi) {
        return kpi.getChildren() != null && kpi.getChildren().stream()
                .anyMatch(c -> c.getParentRelationType() == KpiParentRelationType.DECOMPOSITION);
    }

    /**
     * KPI có tham gia tính điểm định lượng hay không.
     * Loại: KPI huỷ mà không có bù, KPI cha phân rã, KPI không có target/weight hợp lệ.
     */
    public boolean countsTowardQuantitativeScore(KpiCriteria kpi) {
        if (kpi.getStatus() == KpiStatus.INACTIVE && kpi.getCompensatedAchievementPercent() == null) return false;
        if (isDecompositionParent(kpi)) return false;
        if (kpi.getKpiType() == com.kpitracking.enums.KpiType.QUALITATIVE) return false;
        return kpi.getTargetValue() != null && kpi.getTargetValue() > 0 && kpi.getWeight() != null;
    }
}
