package com.kpitracking.service.analytics;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.KpiType;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.service.KpiAchievementCalculator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Cửa DUY NHẤT để thống kê lấy một con số về KPI.
 *
 * <p><b>Thống kê không viết lại công thức tỉ lệ.</b> Mọi tỉ lệ đạt đều do
 * {@link KpiAchievementCalculator} của lõi tính — cùng lớp sinh ra {@code system_score},
 * {@code bsc_score} và điểm tự chấm của bài nộp. Lớp này chỉ làm đúng MỘT việc mà lõi không có:
 * <b>chọn khoảng thời gian</b> lấy bài nộp (lõi luôn tính trọn đời KPI).
 *
 * <p>Vì sao cần: trước đây mỗi service thống kê tự tính một kiểu, nên cùng một KPI ra ba con số
 * khác nhau ở ba màn hình và không con nào khớp bảng điểm — KPI ngược về 0 khi vượt chỉ tiêu
 * (lõi cho {@code 2 − actual/target}), KPI thiếu chỉ tiêu bị gán {@code target = 1.0} (lõi loại
 * khỏi điểm), {@code minimumValue} / {@code compensatedAchievementPercent} / KPI thưởng bị bỏ qua,
 * và chính sách KPI khoá kỳ của lõi không ai biết.
 *
 * <p>Quy ước {@code null}: <b>null = "không có số để nói"</b> (KPI không tham gia tính điểm, hoặc
 * KPI định tính chưa được chấm), khác hẳn {@code 0.0} = "có số và bằng không". Người gọi phải bỏ
 * null ra khỏi cả tử lẫn mẫu khi lấy trung bình — đúng cách lõi làm.
 */
@Component
@RequiredArgsConstructor
public class AnalyticsKpiMetrics {

    /**
     * Trạng thái KPI được tính vào điểm — đi qua {@code scoringStatuses} nên chính sách KPI khoá
     * kỳ đổi ở lõi là thống kê đổi theo. Trước đây mọi truy vấn thống kê gắn cứng
     * {@code status = 'APPROVED'}, nên KPI {@code EDITED/EDIT/INACTIVE-có-bù} nằm trong mẫu số của
     * bảng điểm nhưng biến mất khỏi mọi trung bình trên Thống kê.
     */
    public static final List<KpiStatus> SCORING_STATUSES = KpiAchievementCalculator.scoringStatuses(
            List.of(KpiStatus.APPROVED, KpiStatus.EDITED, KpiStatus.EDIT, KpiStatus.INACTIVE));

    /** Bài nộp được tính — đúng bộ của {@link KpiAchievementCalculator#actualValue}. */
    private static final Set<SubmissionStatus> SCORED = EnumSet.of(
            SubmissionStatus.APPROVED, SubmissionStatus.PENDING, SubmissionStatus.REJECTED);

    private static final Set<SubmissionStatus> APPROVED_ONLY = EnumSet.of(SubmissionStatus.APPROVED);

    private final KpiAchievementCalculator calculator;

    /**
     * Khoảng thời gian của một ô thống kê.
     *
     * @param from         mốc đầu, {@code null} = không chặn
     * @param to           mốc cuối, {@code null} = không chặn
     * @param onlyApproved người dùng bật "chỉ tính bài đã duyệt"; {@code false} = đúng bộ trạng
     *                     thái của lõi (duyệt + chờ duyệt + bị từ chối)
     */
    public record Window(Instant from, Instant to, boolean onlyApproved) {
        public static final Window ALL = new Window(null, null, false);

        public boolean unbounded() {
            return from == null && to == null && !onlyApproved;
        }
    }

    /** KPI này có tham gia tính điểm không — hỏi thẳng lõi, không tự suy. */
    public boolean counts(KpiCriteria kpi) {
        return calculator.countsTowardBscScore(kpi);
    }

    /**
     * Giá trị thực đạt trong khoảng — cùng vị từ bài nộp với lõi (đã xoá mềm thì Hibernate lọc sẵn
     * qua {@code @SQLRestriction}), thêm mốc thời gian theo {@code periodStart ?? createdAt}.
     *
     * <p>Khoảng không chặn gì thì uỷ thác thẳng cho lõi để không có cơ hội lệch.
     */
    public double actualValue(KpiCriteria kpi, UUID userId, Window w, boolean waterfall) {
        if (w == null || w.unbounded()) return calculator.actualValue(kpi, userId, waterfall);

        // Waterfall: điểm chảy ngược từ con lên cha — giữ đúng phép bình quân của lõi.
        if (waterfall) {
            List<KpiCriteria> children = KpiMetricsCalculator.children(kpi);
            if (!children.isEmpty()) {
                return children.stream().mapToDouble(c -> actualValue(c, null, w, true)).average().orElse(0.0);
            }
        }
        Set<SubmissionStatus> statuses = w.onlyApproved() ? APPROVED_ONLY : SCORED;
        return kpi.getSubmissions().stream()
                .filter(s -> userId == null || (s.getSubmittedBy() != null && userId.equals(s.getSubmittedBy().getId())))
                .filter(s -> statuses.contains(s.getStatus()))
                .filter(s -> inWindow(s, w))
                .mapToDouble(s -> s.getActualValue() != null ? s.getActualValue() : 0.0)
                .sum();
    }

    /**
     * % đạt của một KPI (0..150) theo đúng công thức lõi, hoặc {@code null} khi KPI không tham gia
     * tính điểm (KPI thưởng, KPI cha phân rã, thiếu trọng số, định lượng thiếu chỉ tiêu, huỷ không
     * bù, khoá kỳ) hay KPI định tính chưa chấm.
     */
    public Double attainmentPercent(KpiCriteria kpi, UUID userId, Window w, boolean waterfall) {
        if (!counts(kpi)) return null;
        if (kpi.getKpiType() == KpiType.QUALITATIVE) {
            // Định tính chấm theo MỨC chứ không cộng dồn theo thời gian ⇒ không cắt theo khoảng.
            Double ratio = calculator.qualitativeRatio(kpi, userId);
            return ratio == null ? null : ratio * 100.0;
        }
        if (kpi.getStatus() == KpiStatus.CLOSED_BY_LOCK) return 0.0;
        return calculator.ratioFromActual(kpi, actualValue(kpi, userId, w, waterfall)) * 100.0;
    }

    /** % đạt tính trên bài nộp của CẢ đơn vị (không lọc theo người nộp). */
    public Double attainmentPercentForUnit(KpiCriteria kpi, Window w, boolean waterfall) {
        return attainmentPercent(kpi, null, w, waterfall);
    }

    /**
     * % đạt khi giá trị thực đạt ĐÃ được tính sẵn — dành cho các chỗ gộp bằng truy vấn SQL
     * ({@code SUM(actual_value)} theo đơn vị/khoảng) thay vì nạp từng bài nộp.
     *
     * <p>Vẫn là công thức của lõi: {@code compensatedAchievementPercent} → vi phạm sàn → KPI ngược
     * {@code 2 − actual/target} → trần 150%. Người gọi chỉ chịu trách nhiệm cộng đúng tập bài nộp.
     */
    public Double attainmentPercentFromActual(KpiCriteria kpi, double actual) {
        if (!counts(kpi)) return null;
        if (kpi.getStatus() == KpiStatus.CLOSED_BY_LOCK) return 0.0;
        return calculator.ratioFromActual(kpi, actual) * 100.0;
    }

    /**
     * Nhịp tiến độ: thực đạt so với phần chỉ tiêu ĐÃ TỚI HẠN ({@code target × timeRatio}).
     *
     * <p>Khác "% đạt" ở mẫu số, nên hai số này không được mang cùng một tên trên API. Trả
     * {@code null} khi KPI không tham gia tính điểm; trả 0 khi lõi đã kết luận tỉ lệ bằng 0 (vi
     * phạm sàn, KPI khoá kỳ) để nhịp không bao giờ đẹp hơn mức đạt.
     *
     * <p>KPI ngược không cộng dồn theo thời gian nên không chia theo tỉ lệ thời gian: nhịp = mức đạt.
     */
    public Double pacePercent(KpiCriteria kpi, UUID userId, Window w, boolean waterfall, double timeRatio) {
        Double attain = attainmentPercent(kpi, userId, w, waterfall);
        if (attain == null || attain == 0.0) return attain;
        if (Boolean.TRUE.equals(kpi.getIsReverseKpi()) || kpi.getKpiType() == KpiType.QUALITATIVE) return attain;
        if (timeRatio <= 0) return null;
        return Math.min(attain / timeRatio, KpiAchievementCalculator.MAX_RATIO * 100.0);
    }

    /**
     * Bình quân có trọng số của một tập KPI — cùng mẫu số với {@code EvaluationService.systemScoreOf}:
     * KPI không tham gia tính điểm bị loại khỏi CẢ tử lẫn mẫu. {@code null} khi không còn KPI nào.
     */
    public Double weightedAttainment(Collection<KpiCriteria> kpis, UUID userId, Window w, boolean waterfall) {
        double num = 0, den = 0;
        for (KpiCriteria kpi : kpis) {
            Double pct = attainmentPercent(kpi, userId, w, waterfall);
            if (pct == null) continue;
            double weight = kpi.getWeight() == null ? 0.0 : kpi.getWeight();
            if (weight <= 0) continue;
            num += pct * weight;
            den += weight;
        }
        return den > 0 ? num / den : null;
    }

    /** % đạt dùng cho BSC (trọn đời KPI, không cắt theo khoảng) — thẳng từ {@code bscRatio} của lõi. */
    public Double bscAttainmentPercent(KpiCriteria kpi, UUID userId, boolean waterfall) {
        if (!counts(kpi)) return null;
        Double ratio = calculator.bscRatio(kpi, userId, waterfall);
        return ratio == null ? null : ratio * 100.0;
    }

    /**
     * Nhịp tiến độ khi giá trị thực đạt đã tính sẵn — bản "from actual" của {@link #pacePercent}.
     *
     * <p>{@code timeRatio} = phần chỉ tiêu đã tới hạn (0..1). Chỗ gọi nào đang có sẵn biến
     * {@code expected = target × timeRatio} thì truyền {@code expected / target}.
     */
    public Double pacePercentFromActual(KpiCriteria kpi, double actual, double timeRatio) {
        Double attain = attainmentPercentFromActual(kpi, actual);
        if (attain == null || attain == 0.0) return attain;
        if (Boolean.TRUE.equals(kpi.getIsReverseKpi()) || kpi.getKpiType() == KpiType.QUALITATIVE) return attain;
        if (timeRatio <= 0) return null;
        return Math.min(attain / timeRatio, KpiAchievementCalculator.MAX_RATIO * 100.0);
    }

    private static boolean inWindow(KpiSubmission s, Window w) {
        Instant t = s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
        if (t == null) return false;
        return (w.from() == null || !t.isBefore(w.from())) && (w.to() == null || !t.isAfter(w.to()));
    }
}
