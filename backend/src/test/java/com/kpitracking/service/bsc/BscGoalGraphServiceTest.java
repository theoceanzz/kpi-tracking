package com.kpitracking.service.bsc;

import com.kpitracking.dto.response.stats.BscGoalGraphResponses.GraphObjective;
import com.kpitracking.dto.response.stats.BscGoalGraphResponses.GraphPerspective;
import com.kpitracking.enums.bsc.BscFixedPerspective;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Phép gộp %đạt theo lĩnh vực của đồ thị mục tiêu phải TRÙNG phép gộp mà
 * {@code BscCascadeService.recompute} dùng cho %đạt tổng — nếu không, các dải trên bản đồ chiến
 * lược không cộng khớp con số gốc và người đọc không có cách nào biết bên nào đúng.
 */
class BscGoalGraphServiceTest {

    private static final Map<BscFixedPerspective, String[]> LABELS = labels();

    private static Map<BscFixedPerspective, String[]> labels() {
        Map<BscFixedPerspective, String[]> m = new EnumMap<>(BscFixedPerspective.class);
        for (BscFixedPerspective fp : BscFixedPerspective.values()) m.put(fp, new String[]{fp.getDisplayName(), fp.getColor()});
        return m;
    }

    private static GraphObjective obj(String perspectiveCode, Double weight, Double achievement) {
        return GraphObjective.builder()
                .id(UUID.randomUUID()).perspectiveCode(perspectiveCode)
                .weightPercentage(weight).achievementPercent(achievement).build();
    }

    private static GraphPerspective of(List<GraphPerspective> list, String code) {
        return list.stream().filter(p -> code.equals(p.getCode())).findFirst().orElse(null);
    }

    @Test
    @DisplayName("RENORMALIZE: chia cho trọng số CÓ mặt, chỉ tiêu chưa có kết quả không kéo xuống")
    void renormalizeDividesByPresentWeight() {
        var list = BscGoalGraphService.buildPerspectives(List.of(
                obj("FINANCIAL", 30.0, 90.0),
                obj("FINANCIAL", 10.0, null)),      // chưa có kết quả
                LABELS, false);

        assertThat(of(list, "FINANCIAL").getAchievementPercent()).isEqualTo(90.0);
        assertThat(of(list, "FINANCIAL").getWeightPercentage()).isEqualTo(40.0);
    }

    @Test
    @DisplayName("ZERO_FILL: chia cho TỔNG trọng số, chỉ tiêu chưa có kết quả tính như 0")
    void zeroFillDividesByTotalWeight() {
        var list = BscGoalGraphService.buildPerspectives(List.of(
                obj("FINANCIAL", 30.0, 90.0),
                obj("FINANCIAL", 10.0, null)),
                LABELS, true);

        // 30×90 ÷ 40 = 67.5
        assertThat(of(list, "FINANCIAL").getAchievementPercent()).isEqualTo(67.5);
    }

    @Test
    @DisplayName("Trọng số 0 đóng góp 0, không được thay bằng 1.0")
    void zeroWeightContributesNothing() {
        var list = BscGoalGraphService.buildPerspectives(List.of(
                obj("CUSTOMER", 50.0, 80.0),
                obj("CUSTOMER", 0.0, 10.0)),        // trọng số 0: không được kéo đường xuống
                LABELS, false);

        assertThat(of(list, "CUSTOMER").getAchievementPercent()).isEqualTo(80.0);
    }

    @Test
    @DisplayName("Chỉ tiêu không gắn lĩnh vực vào rổ riêng, không biến mất")
    void unclassifiedGetsItsOwnBucket() {
        var list = BscGoalGraphService.buildPerspectives(List.of(
                obj("FINANCIAL", 60.0, 100.0),
                obj(BscGoalGraphService.UNCLASSIFIED, 40.0, 50.0)),
                LABELS, false);

        assertThat(of(list, BscGoalGraphService.UNCLASSIFIED)).isNotNull();
        assertThat(of(list, BscGoalGraphService.UNCLASSIFIED).getAchievementPercent()).isEqualTo(50.0);
        // Hai rổ cộng lại đúng bằng %đạt tổng: (60×100 + 40×50) ÷ 100 = 80
        double total = list.stream().mapToDouble(p -> p.getAchievementPercent() * p.getWeightPercentage()).sum()
                / list.stream().mapToDouble(GraphPerspective::getWeightPercentage).sum();
        assertThat(total).isEqualTo(80.0);
    }

    @Test
    @DisplayName("Lĩnh vực không có mục tiêu nào thì không xuất hiện (không vẽ dải rỗng)")
    void emptyPerspectiveIsOmitted() {
        var list = BscGoalGraphService.buildPerspectives(List.of(obj("FINANCIAL", 100.0, 70.0)), LABELS, false);

        assertThat(list).hasSize(1);
        assertThat(list.get(0).getName()).isEqualTo(BscFixedPerspective.FINANCIAL.getDisplayName());
    }
}
