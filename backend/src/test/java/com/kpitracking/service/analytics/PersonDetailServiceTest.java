package com.kpitracking.service.analytics;

import com.kpitracking.entity.KpiCycle;
import com.kpitracking.entity.KpiPeriod;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Hai luật riêng của trang chi tiết một người.
 *
 * <p><b>Trễ hẹn:</b> trong mã đã có BA định nghĩa "trễ" khác nhau và chúng không khớp nhau, nên ô
 * này nói rõ luật của riêng nó và chốt lại bằng test: trễ = nộp sau khi đợt đóng, HOẶC không nộp gì.
 *
 * <p><b>Gom đợt theo kỳ:</b> sổ đánh giá là tab kỳ lồng tab đợt, nên thứ tự và chỗ rơi của đợt
 * không thuộc kỳ nào phải chắc chắn.
 */
class PersonDetailServiceTest {

    private static final Instant DONG_DOT = Instant.parse("2026-06-30T17:00:00Z");

    private static Object[] row(Instant firstSubmittedAt) {
        return new Object[]{UUID.randomUUID(), DONG_DOT, firstSubmittedAt};
    }

    @Test
    @DisplayName("Nộp sau khi đợt đóng là trễ; nộp trước là đúng hạn")
    void countsSubmissionsAfterPeriodEnd() {
        int[] r = PersonDetailService.countLate(List.of(
                row(DONG_DOT.minusSeconds(3600)),
                row(DONG_DOT.plusSeconds(3600)),
                row(DONG_DOT)));                       // đúng khoảnh khắc đóng vẫn là kịp
        assertThat(r).containsExactly(1, 3);
    }

    @Test
    @DisplayName("KHÔNG nộp gì cũng là trễ — 'chưa nộp' và 'nộp muộn' đều là lỗi hẹn")
    void missingCountsAsLate() {
        int[] r = PersonDetailService.countLate(List.of(
                row(null),
                row(DONG_DOT.minusSeconds(60))));
        assertThat(r).containsExactly(1, 2);
    }

    @Test
    @DisplayName("Đợt không có hạn thì không kết tội ai")
    void noDeadlineNoBlame() {
        int[] r = PersonDetailService.countLate(List.<Object[]>of(
                new Object[]{UUID.randomUUID(), null, Instant.parse("2030-01-01T00:00:00Z")}));
        assertThat(r).containsExactly(0, 1);
    }

    @Test
    @DisplayName("Không được giao KPI nào thì mẫu số bằng 0, không chia bậy")
    void noAssignments() {
        assertThat(PersonDetailService.countLate(List.of())).containsExactly(0, 0);
    }

    // ============================================================
    // Gom đợt theo kỳ
    // ============================================================

    private static KpiPeriod period(String name, KpiCycle cycle) {
        return KpiPeriod.builder().id(UUID.randomUUID()).name(name).kpiCycle(cycle).build();
    }

    private static KpiCycle cycle(String name) {
        return KpiCycle.builder().id(UUID.randomUUID()).name(name).build();
    }

    @Test
    @DisplayName("Giữ nguyên thứ tự thời gian của kỳ và của đợt trong kỳ")
    void keepsChronologicalOrder() {
        KpiCycle q1 = cycle("Quý 1");
        KpiCycle q2 = cycle("Quý 2");
        List<List<KpiPeriod>> groups = PersonDetailService.groupByCycle(List.of(
                period("T1", q1), period("T2", q1), period("T3", q1),
                period("T4", q2), period("T5", q2)));

        assertThat(groups).hasSize(2);
        assertThat(groups.get(0)).extracting(KpiPeriod::getName).containsExactly("T1", "T2", "T3");
        assertThat(groups.get(1)).extracting(KpiPeriod::getName).containsExactly("T4", "T5");
    }

    @Test
    @DisplayName("Đợt không thuộc kỳ nào gom thành MỘT nhóm và luôn đứng cuối")
    void loosePeriodsGoLast() {
        KpiCycle q1 = cycle("Quý 1");
        // Đợt lẻ nằm GIỮA về thời gian — vẫn phải rơi xuống cuối, không chen vào kỳ nào.
        List<List<KpiPeriod>> groups = PersonDetailService.groupByCycle(List.of(
                period("T1", q1), period("Lẻ A", null), period("T2", q1), period("Lẻ B", null)));

        assertThat(groups).hasSize(2);
        assertThat(groups.get(0)).extracting(KpiPeriod::getName).containsExactly("T1", "T2");
        assertThat(groups.get(1)).extracting(KpiPeriod::getName).containsExactly("Lẻ A", "Lẻ B");
    }

    @Test
    @DisplayName("Không có đợt lẻ thì không sinh nhóm rỗng")
    void noEmptyLooseGroup() {
        KpiCycle q1 = cycle("Quý 1");
        assertThat(PersonDetailService.groupByCycle(List.of(period("T1", q1)))).hasSize(1);
        assertThat(PersonDetailService.groupByCycle(List.of())).isEmpty();
    }
}
