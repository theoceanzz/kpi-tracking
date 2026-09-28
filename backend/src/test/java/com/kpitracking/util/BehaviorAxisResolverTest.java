package com.kpitracking.util;

import com.kpitracking.enums.F360ScoringMode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Điểm 360 chen vào trục hành vi của ma trận xếp loại. Yêu cầu số một: KHÔNG có 360 (hoặc chiến
 * dịch chỉ để phát triển) thì kết quả phải trùng khít {@link ConductAxisResolver} — tổ chức không
 * dùng 360 không được thấy xếp loại nào đổi.
 */
class BehaviorAxisResolverTest {

    @ParameterizedTest(name = "qual={0} completion={1} conduct={2}/{3}")
    @CsvSource(nullValues = "null", value = {
            "null, 80, 4, 5",
            "3.5, null, 4, 5",
            "3.5, 80, 4, 5",
            "null, null, 4, 5",
            "null, 80, null, 5",
            "4, 90, null, null",
    })
    @DisplayName("không có 360 ⇒ y hệt ConductAxisResolver")
    void identicalWithout360(Double qual, Double completion, Double conduct, Double conductMax) {
        ConductAxisResolver.Axes old = ConductAxisResolver.resolve(qual, completion, conduct, conductMax);
        for (F360ScoringMode mode : new F360ScoringMode[]{null, F360ScoringMode.DEVELOPMENT_ONLY}) {
            BehaviorAxisResolver.Result r = BehaviorAxisResolver.resolve(qual, completion, conduct, conductMax, 4.2, mode, null);
            assertThat(r.behaviorScore()).isEqualTo(old.behaviorScore());
            assertThat(r.completionPercent()).isEqualTo(old.completionPercent());
        }
        BehaviorAxisResolver.Result noScore = BehaviorAxisResolver.resolve(qual, completion, conduct, conductMax,
                null, F360ScoringMode.BEHAVIOR_AXIS, null);
        assertThat(noScore.behaviorScore()).isEqualTo(old.behaviorScore());
    }

    @Test
    @DisplayName("BEHAVIOR_AXIS: trục hành vi trống ⇒ lấy điểm 360")
    void fillsEmptyAxis() {
        BehaviorAxisResolver.Result r = BehaviorAxisResolver.resolve(null, 80.0, null, null, 4.2, F360ScoringMode.BEHAVIOR_AXIS, null);
        assertThat(r.behaviorScore()).isEqualTo(4.2);
        assertThat(r.behaviorSource()).isEqualTo(BehaviorAxisResolver.Source.FEEDBACK360);
    }

    @Test
    @DisplayName("BEHAVIOR_AXIS không đè hạnh kiểm, không đè KPI định tính")
    void doesNotOverride() {
        BehaviorAxisResolver.Result conduct = BehaviorAxisResolver.resolve(null, 80.0, 4.0, 5.0, 2.0, F360ScoringMode.BEHAVIOR_AXIS, null);
        assertThat(conduct.behaviorScore()).isEqualTo(4.0);
        assertThat(conduct.behaviorSource()).isEqualTo(BehaviorAxisResolver.Source.CONDUCT);

        BehaviorAxisResolver.Result qual = BehaviorAxisResolver.resolve(3.0, 80.0, null, null, 5.0, F360ScoringMode.BLEND_CONDUCT, 50);
        assertThat(qual.behaviorScore()).isEqualTo(3.0);
        assertThat(qual.behaviorSource()).isEqualTo(BehaviorAxisResolver.Source.QUALITATIVE);
    }

    @Test
    @DisplayName("BLEND_CONDUCT: a% hạnh kiểm + (100−a)% 360, cả hai trên thang 0..5")
    void blends() {
        // Hạnh kiểm 8/10 ⇒ 4.0 trên trục; 360 = 3.0; a = 60 ⇒ 0.6·4 + 0.4·3 = 3.6
        BehaviorAxisResolver.Result r = BehaviorAxisResolver.resolve(null, 70.0, 8.0, 10.0, 3.0, F360ScoringMode.BLEND_CONDUCT, 60);
        assertThat(r.behaviorScore()).isCloseTo(3.6, within(1e-9));
        assertThat(r.behaviorSource()).isEqualTo(BehaviorAxisResolver.Source.BLENDED);
        assertThat(r.completionPercent()).isEqualTo(70.0);
    }

    @Test
    @DisplayName("BLEND_CONDUCT không có hạnh kiểm ⇒ lấy thẳng 360")
    void blendWithoutConduct() {
        BehaviorAxisResolver.Result r = BehaviorAxisResolver.resolve(null, 70.0, null, null, 3.0, F360ScoringMode.BLEND_CONDUCT, 60);
        assertThat(r.behaviorScore()).isEqualTo(3.0);
    }

    @Test
    @DisplayName("quy đổi thang 360 về 1..5 (dữ liệu cũ thang 10)")
    void normalizes() {
        assertThat(BehaviorAxisResolver.normalize360(10.0, 10)).isEqualTo(5.0);
        assertThat(BehaviorAxisResolver.normalize360(1.0, 10)).isEqualTo(1.0);
        assertThat(BehaviorAxisResolver.normalize360(5.5, 10)).isCloseTo(3.0, within(1e-9));
        assertThat(BehaviorAxisResolver.normalize360(4.0, 5)).isEqualTo(4.0);
        assertThat(BehaviorAxisResolver.normalize360(null, 5)).isNull();
    }
}
