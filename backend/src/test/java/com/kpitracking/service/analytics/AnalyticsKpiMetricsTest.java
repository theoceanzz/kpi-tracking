package com.kpitracking.service.analytics;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.entity.User;
import com.kpitracking.enums.KpiParentRelationType;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.KpiType;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.service.KpiAchievementCalculator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Chốt một điều: <b>{@link AnalyticsKpiMetrics} ra đúng con số mà lõi ra</b>.
 *
 * <p>Đây là lưới an toàn cho đợt gỡ công thức riêng của Thống kê. Trước đợt này, Thống kê tự tính
 * và lệch lõi ở những chỗ dưới đây — mỗi ca test là một chỗ lệch có thật, nêu kèm số cũ để người
 * đọc sau biết vì sao con số trên màn hình đổi:
 *
 * <ul>
 *   <li>KPI ngược vượt chỉ tiêu: Thống kê trả 0, lõi trả {@code 2 − actual/target}.</li>
 *   <li>KPI ngược: Thống kê chỉ lấy bài nộp MỚI NHẤT, lõi CỘNG mọi bài nộp.</li>
 *   <li>KPI thiếu chỉ tiêu: Thống kê gán {@code target = 1.0} (ra hàng nghìn %), lõi loại khỏi điểm.</li>
 *   <li>{@code minimumValue}, {@code compensatedAchievementPercent}, KPI thưởng, KPI cha phân rã,
 *       KPI huỷ, KPI khoá kỳ: Thống kê bỏ qua hết.</li>
 * </ul>
 */
class AnalyticsKpiMetricsTest {

    private static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");

    private KpiAchievementCalculator core;
    private AnalyticsKpiMetrics metrics;

    @BeforeEach
    void setUp() {
        core = new KpiAchievementCalculator(mock(KpiCriteriaRepository.class));
        metrics = new AnalyticsKpiMetrics(core);
    }

    // ── dựng dữ liệu ─────────────────────────────────────────────────────────

    private KpiCriteria kpi(Double target, Double minimum, boolean reverse) {
        KpiCriteria k = new KpiCriteria();
        k.setId(UUID.randomUUID());
        k.setKpiType(KpiType.QUANTITATIVE);
        k.setStatus(KpiStatus.APPROVED);
        k.setWeight(10.0);
        k.setTargetValue(target);
        k.setMinimumValue(minimum);
        k.setIsReverseKpi(reverse);
        k.setSubmissions(new ArrayList<>());
        return k;
    }

    private void submit(KpiCriteria k, UUID userId, double actual, Instant at) {
        User u = new User();
        u.setId(userId);
        KpiSubmission s = new KpiSubmission();
        s.setId(UUID.randomUUID());
        s.setKpiCriteria(k);
        s.setSubmittedBy(u);
        s.setActualValue(actual);
        s.setStatus(SubmissionStatus.APPROVED);
        s.setCreatedAt(at);
        k.getSubmissions().add(s);
    }

    // ── mức đạt khớp lõi ─────────────────────────────────────────────────────

    @Test
    @DisplayName("KPI thường: % đạt = tỉ lệ của lõi × 100, trần 150%")
    void normalKpiMatchesCore() {
        UUID user = UUID.randomUUID();
        KpiCriteria k = kpi(100.0, null, false);
        submit(k, user, 60, T0);
        submit(k, user, 30, T0.plus(1, ChronoUnit.DAYS));

        assertThat(metrics.attainmentPercent(k, user, AnalyticsKpiMetrics.Window.ALL, false)).isEqualTo(90.0);
        assertThat(metrics.attainmentPercent(k, user, AnalyticsKpiMetrics.Window.ALL, false))
                .isEqualTo(core.ratio(k, user, false) * 100.0);

        submit(k, user, 200, T0.plus(2, ChronoUnit.DAYS));
        assertThat(metrics.attainmentPercent(k, user, AnalyticsKpiMetrics.Window.ALL, false)).isEqualTo(150.0);
    }

    @Test
    @DisplayName("KPI ngược vượt chỉ tiêu: 2 − actual/target (Thống kê cũ trả 0)")
    void reverseKpiOverTargetIsNotZero() {
        UUID user = UUID.randomUUID();
        KpiCriteria k = kpi(100.0, null, true);
        submit(k, user, 120, T0);   // vượt chỉ tiêu 20% ở KPI "càng thấp càng tốt"

        Double pct = metrics.attainmentPercent(k, user, AnalyticsKpiMetrics.Window.ALL, false);
        assertThat(pct).isEqualTo(80.0);                       // 2 − 1.2 = 0.8
        assertThat(pct).isEqualTo(core.ratio(k, user, false) * 100.0);
        assertThat(KpiMetricsCalculatorLegacy.reverseOld(120, 100)).isZero();   // số cũ, để đối chiếu
    }

    @Test
    @DisplayName("KPI ngược: CỘNG mọi bài nộp như lõi, không chỉ lấy bài mới nhất")
    void reverseKpiSumsSubmissions() {
        UUID user = UUID.randomUUID();
        KpiCriteria k = kpi(100.0, null, true);
        submit(k, user, 30, T0);
        submit(k, user, 40, T0.plus(1, ChronoUnit.DAYS));      // tổng 70 ⇒ 2 − 0.7 = 1.3 → 130%

        assertThat(metrics.actualValue(k, user, AnalyticsKpiMetrics.Window.ALL, false)).isEqualTo(70.0);
        assertThat(metrics.attainmentPercent(k, user, AnalyticsKpiMetrics.Window.ALL, false))
                .isEqualTo(core.ratio(k, user, false) * 100.0);
    }

    @Test
    @DisplayName("Vi phạm sàn minimumValue ⇒ 0, không phải actual/target")
    void breachingMinimumIsZero() {
        UUID user = UUID.randomUUID();
        KpiCriteria k = kpi(100.0, 50.0, false);
        submit(k, user, 40, T0);

        assertThat(metrics.attainmentPercent(k, user, AnalyticsKpiMetrics.Window.ALL, false)).isZero();
    }

    @Test
    @DisplayName("KPI huỷ có bù: dùng thẳng % bù của lõi")
    void compensatedUsesCompensationPercent() {
        UUID user = UUID.randomUUID();
        KpiCriteria k = kpi(100.0, null, false);
        k.setStatus(KpiStatus.INACTIVE);
        k.setCompensatedAchievementPercent(80.0);

        assertThat(metrics.attainmentPercent(k, user, AnalyticsKpiMetrics.Window.ALL, false)).isEqualTo(80.0);
    }

    // ── KPI không tham gia tính điểm ⇒ null, KHÔNG phải 0 ────────────────────

    @Test
    @DisplayName("KPI thiếu chỉ tiêu ⇒ null (Thống kê cũ gán target = 1.0 rồi ra hàng nghìn %)")
    void missingTargetIsNull() {
        UUID user = UUID.randomUUID();
        KpiCriteria k = kpi(null, null, false);
        submit(k, user, 37, T0);

        assertThat(metrics.attainmentPercent(k, user, AnalyticsKpiMetrics.Window.ALL, false)).isNull();
        assertThat(metrics.counts(k)).isFalse();
    }

    @Test
    @DisplayName("KPI thưởng, KPI huỷ không bù, KPI thiếu trọng số ⇒ null")
    void nonScoringKpisAreNull() {
        UUID user = UUID.randomUUID();

        KpiCriteria bonus = kpi(100.0, null, false);
        bonus.setIsBonusKpi(true);
        assertThat(metrics.attainmentPercent(bonus, user, AnalyticsKpiMetrics.Window.ALL, false)).isNull();

        KpiCriteria cancelled = kpi(100.0, null, false);
        cancelled.setStatus(KpiStatus.INACTIVE);
        assertThat(metrics.attainmentPercent(cancelled, user, AnalyticsKpiMetrics.Window.ALL, false)).isNull();

        KpiCriteria noWeight = kpi(100.0, null, false);
        noWeight.setWeight(0.0);
        assertThat(metrics.attainmentPercent(noWeight, user, AnalyticsKpiMetrics.Window.ALL, false)).isNull();
    }

    @Test
    @DisplayName("KPI cha phân rã ⇒ null (điểm nằm ở các KPI con)")
    void decompositionParentIsNull() {
        UUID user = UUID.randomUUID();
        KpiCriteria parent = kpi(100.0, null, false);
        KpiCriteria child = kpi(50.0, null, false);
        child.setParentRelationType(KpiParentRelationType.DECOMPOSITION);
        parent.setChildren(List.of(child));

        assertThat(metrics.attainmentPercent(parent, user, AnalyticsKpiMetrics.Window.ALL, false)).isNull();
    }

    @Test
    @DisplayName("KPI khoá kỳ: theo đúng chính sách EXCLUDE của lõi")
    void closedByLockFollowsCorePolicy() {
        UUID user = UUID.randomUUID();
        KpiCriteria k = kpi(100.0, null, false);
        k.setStatus(KpiStatus.CLOSED_BY_LOCK);
        submit(k, user, 90, T0);

        boolean excluded = KpiAchievementCalculator.CLOSED_BY_LOCK_SCORING
                == KpiAchievementCalculator.ClosedByLockScoring.EXCLUDE;
        if (excluded) {
            assertThat(metrics.attainmentPercent(k, user, AnalyticsKpiMetrics.Window.ALL, false)).isNull();
        } else {
            assertThat(metrics.attainmentPercent(k, user, AnalyticsKpiMetrics.Window.ALL, false)).isZero();
        }
    }

    @Test
    @DisplayName("KPI định tính chưa chấm ⇒ null, rụng khỏi cả tử lẫn mẫu")
    void unscoredQualitativeIsNull() {
        UUID user = UUID.randomUUID();
        KpiCriteria k = kpi(null, null, false);
        k.setKpiType(KpiType.QUALITATIVE);

        assertThat(metrics.counts(k)).isTrue();                 // định tính KHÔNG cần chỉ tiêu
        assertThat(metrics.attainmentPercent(k, user, AnalyticsKpiMetrics.Window.ALL, false)).isNull();
    }

    // ── khoảng thời gian: việc DUY NHẤT lớp này tự làm ───────────────────────

    @Test
    @DisplayName("Cắt theo khoảng chỉ bỏ bài nộp ngoài khoảng, công thức vẫn của lõi")
    void windowOnlyFiltersSubmissions() {
        UUID user = UUID.randomUUID();
        KpiCriteria k = kpi(100.0, null, false);
        submit(k, user, 40, T0);
        submit(k, user, 50, T0.plus(40, ChronoUnit.DAYS));

        var jan = new AnalyticsKpiMetrics.Window(T0, T0.plus(10, ChronoUnit.DAYS), false);
        assertThat(metrics.actualValue(k, user, jan, false)).isEqualTo(40.0);
        assertThat(metrics.attainmentPercent(k, user, jan, false)).isEqualTo(40.0);

        // Không chặn khoảng ⇒ đúng bằng lõi
        assertThat(metrics.actualValue(k, user, AnalyticsKpiMetrics.Window.ALL, false))
                .isEqualTo(core.actualValue(k, user, false));
    }

    @Test
    @DisplayName("Chỉ tính bài đã duyệt: bỏ bài chờ duyệt / bị từ chối")
    void onlyApprovedDropsPendingAndRejected() {
        UUID user = UUID.randomUUID();
        KpiCriteria k = kpi(100.0, null, false);
        submit(k, user, 40, T0);
        KpiSubmission pending = k.getSubmissions().get(0);
        submit(k, user, 50, T0.plus(1, ChronoUnit.DAYS));
        k.getSubmissions().get(1).setStatus(SubmissionStatus.PENDING);

        var approvedOnly = new AnalyticsKpiMetrics.Window(null, null, true);
        assertThat(pending.getStatus()).isEqualTo(SubmissionStatus.APPROVED);
        assertThat(metrics.actualValue(k, user, approvedOnly, false)).isEqualTo(40.0);
        assertThat(metrics.actualValue(k, user, AnalyticsKpiMetrics.Window.ALL, false)).isEqualTo(90.0);
    }

    // ── nhịp tiến độ ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("Nhịp = mức đạt chia phần thời gian đã trôi, trần 150%")
    void paceDividesByElapsedShare() {
        UUID user = UUID.randomUUID();
        KpiCriteria k = kpi(100.0, null, false);
        submit(k, user, 30, T0);

        // Mới qua nửa kỳ mà đã đạt 30% ⇒ nhịp 60%
        assertThat(metrics.pacePercent(k, user, AnalyticsKpiMetrics.Window.ALL, false, 0.5)).isEqualTo(60.0);
        assertThat(metrics.pacePercent(k, user, AnalyticsKpiMetrics.Window.ALL, false, 1.0)).isEqualTo(30.0);
    }

    @Test
    @DisplayName("Nhịp không bao giờ đẹp hơn mức đạt khi lõi đã kết luận 0")
    void paceStaysZeroWhenCoreSaysZero() {
        UUID user = UUID.randomUUID();
        KpiCriteria k = kpi(100.0, 50.0, false);
        submit(k, user, 10, T0);                                // dưới sàn ⇒ lõi cho 0

        assertThat(metrics.pacePercent(k, user, AnalyticsKpiMetrics.Window.ALL, false, 0.2)).isZero();
    }

    // ── bình quân có trọng số ────────────────────────────────────────────────

    @Test
    @DisplayName("Bình quân có trọng số loại KPI không tính điểm khỏi CẢ tử lẫn mẫu")
    void weightedAttainmentDropsNonScoringFromBothSides() {
        UUID user = UUID.randomUUID();
        KpiCriteria good = kpi(100.0, null, false);
        good.setWeight(40.0);
        submit(good, user, 80, T0);

        KpiCriteria noTarget = kpi(null, null, false);          // không tính điểm
        noTarget.setWeight(60.0);
        submit(noTarget, user, 999, T0);

        // Chỉ còn KPI hợp lệ ⇒ 80%, KHÔNG phải (80×40 + 99900×60)/100
        assertThat(metrics.weightedAttainment(List.of(good, noTarget), user, AnalyticsKpiMetrics.Window.ALL, false))
                .isEqualTo(80.0);
        assertThat(metrics.weightedAttainment(List.of(noTarget), user, AnalyticsKpiMetrics.Window.ALL, false)).isNull();
    }

    /** Công thức KPI ngược CŨ của Thống kê, giữ lại trong test để ghi rõ chỗ lệch đã sửa. */
    private static final class KpiMetricsCalculatorLegacy {
        static double reverseOld(double actual, double target) {
            if (target <= 0) return 0.0;
            if (actual > target) return 0.0;
            return Math.max(0.0, Math.min(2.0 - actual / target, 1.5)) * 100.0;
        }
    }
}
