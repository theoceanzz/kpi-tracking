package com.kpitracking.service;

import com.kpitracking.entity.BscPerspective;
import com.kpitracking.entity.BscScorecardPerspective;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Phân rã từng chỉ tiêu: tối thiểu của đơn vị nhận chia theo cùng tỉ lệ với chỉ tiêu cha. */
class BscCascadeScaledMinimumTest {

    static BscScorecardPerspective parent(Double target, Double minimum, Double catalogTarget, Double catalogMinimum) {
        BscPerspective p = BscPerspective.builder().targetValue(catalogTarget).minimumValue(catalogMinimum).build();
        return BscScorecardPerspective.builder().perspective(p).targetValue(target).minimumValue(minimum).build();
    }

    @Test
    @DisplayName("Chia 1.000 (tối thiểu 400) thành 300 + 700 ⇒ tối thiểu 120 và 280")
    void scalesWithTarget() {
        BscScorecardPerspective parent = parent(1000.0, 400.0, 1000.0, 400.0);
        assertThat(BscCascadeService.scaledMinimum(parent, 300.0)).isEqualTo(120.0);
        assertThat(BscCascadeService.scaledMinimum(parent, 700.0)).isEqualTo(280.0);
    }

    @Test
    @DisplayName("Cha có tối thiểu = mục tiêu (500/500) ⇒ con tối thiểu = mục tiêu con, không bị chặn")
    void minimumEqualsTarget() {
        BscScorecardPerspective parent = parent(500.0, 500.0, 500.0, 500.0);
        assertThat(BscCascadeService.scaledMinimum(parent, 300.0)).isEqualTo(300.0);
        assertThat(BscCascadeService.scaledMinimum(parent, 200.0)).isEqualTo(200.0);
    }

    @Test
    @DisplayName("Cha có tối thiểu 0 ⇒ con tối thiểu 0")
    void zeroMinimum() {
        assertThat(BscCascadeService.scaledMinimum(parent(500.0, 0.0, 500.0, 0.0), 300.0)).isEqualTo(0.0);
    }

    @Test
    @DisplayName("Dòng cha không đặt số riêng ⇒ lấy tỉ lệ từ mặc định của hạng mục")
    void fallsBackToCatalog() {
        BscScorecardPerspective parent = parent(null, null, 1000.0, 400.0);
        assertThat(BscCascadeService.scaledMinimum(parent, 500.0)).isEqualTo(200.0);
    }

    @Test
    @DisplayName("Dòng cha có mục tiêu riêng 500 nhưng tối thiểu theo hạng mục 400 ⇒ tỉ lệ 80%")
    void mixesRowTargetAndCatalogMinimum() {
        BscScorecardPerspective parent = parent(500.0, null, 1000.0, 400.0);
        assertThat(BscCascadeService.scaledMinimum(parent, 250.0)).isEqualTo(200.0);
    }

    @Test
    @DisplayName("Không có mục tiêu con hoặc tối thiểu cha ⇒ để trống")
    void nullWhenNothingToScale() {
        assertThat(BscCascadeService.scaledMinimum(parent(1000.0, 400.0, null, null), null)).isNull();
        assertThat(BscCascadeService.scaledMinimum(parent(1000.0, null, 1000.0, null), 300.0)).isNull();
    }

    @Test
    @DisplayName("Không bao giờ vượt mục tiêu con, kể cả khi cha không có mục tiêu")
    void neverAboveChildTarget() {
        assertThat(BscCascadeService.scaledMinimum(parent(null, 400.0, null, null), 300.0)).isEqualTo(300.0);
        assertThat(BscCascadeService.scaledMinimum(parent(3.0, 1.0, null, null), 1.0)).isEqualTo(0.33);
    }
}
