package com.kpitracking.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Quy tắc của phân rã cả bộ tiêu chí: chặn vòng lặp, khớp đợt, trọng số hợp lệ.
 * {@code upstream} giả lập "thẻ X đang lấy số từ những thẻ nào" (thẻ cha + thẻ nguồn của dòng E).
 */
class BscWholeCascadeRulesTest {

    static final UUID COMPANY = UUID.randomUUID(), DEPT = UUID.randomUUID(), TEAM = UUID.randomUUID();

    static Function<UUID, java.util.Collection<UUID>> upstream(Map<UUID, List<UUID>> edges) {
        return id -> edges.getOrDefault(id, List.of());
    }

    @Test
    @DisplayName("Giao cho chính nó là vòng lặp")
    void selfIsLoop() {
        assertThat(BscWholeCascadeRules.createsLoop(DEPT, DEPT, upstream(Map.of()))).isTrue();
    }

    @Test
    @DisplayName("Cây bình thường công ty → phòng → tổ: giao xuống không tạo vòng")
    void normalTreeHasNoLoop() {
        Map<UUID, List<UUID>> edges = Map.of(DEPT, List.of(COMPANY), TEAM, List.of(DEPT));
        assertThat(BscWholeCascadeRules.createsLoop(COMPANY, DEPT, upstream(edges))).isFalse();
        assertThat(BscWholeCascadeRules.createsLoop(DEPT, TEAM, upstream(edges))).isFalse();
    }

    @Test
    @DisplayName("A → B → A: thẻ nhận đang là nguồn (trực tiếp) của thẻ giao")
    void directLoop() {
        // Phòng đang lấy kết quả của tổ; giờ tổ lại muốn nhận kết quả của phòng.
        Map<UUID, List<UUID>> edges = Map.of(DEPT, List.of(TEAM));
        assertThat(BscWholeCascadeRules.createsLoop(DEPT, TEAM, upstream(edges))).isTrue();
    }

    @Test
    @DisplayName("Vòng gián tiếp qua nhiều tầng cũng bị bắt")
    void indirectLoop() {
        Map<UUID, List<UUID>> edges = Map.of(COMPANY, List.of(DEPT), DEPT, List.of(TEAM));
        assertThat(BscWholeCascadeRules.createsLoop(COMPANY, TEAM, upstream(edges))).isTrue();
    }

    @Test
    @DisplayName("Dữ liệu đã lỗi vòng sẵn (không dính thẻ nhận) không làm treo")
    void corruptCycleDoesNotHang() {
        Map<UUID, List<UUID>> edges = Map.of(COMPANY, List.of(DEPT), DEPT, List.of(COMPANY));
        assertThatCode(() -> assertThat(BscWholeCascadeRules.createsLoop(COMPANY, TEAM, upstream(edges))).isFalse())
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("Chuỗi sâu hơn giới hạn thì dừng thay vì đi mãi")
    void depthIsBounded() {
        Map<UUID, List<UUID>> edges = new HashMap<>();
        UUID cur = COMPANY;
        for (int i = 0; i < BscWholeCascadeRules.MAX_DEPTH * 3; i++) {
            UUID next = UUID.randomUUID();
            edges.put(cur, List.of(next));
            cur = next;
        }
        // TEAM nằm ngoài tầm với trong giới hạn độ sâu ⇒ không kết luận vòng, và hàm phải trả về.
        edges.put(cur, List.of(TEAM));
        assertThat(BscWholeCascadeRules.createsLoop(COMPANY, TEAM, upstream(edges))).isFalse();
    }

    @Test
    @DisplayName("Công ty chấm theo quý, phòng chấm theo tháng ⇒ đợt không khớp")
    void periodMismatch() {
        UUID q3 = UUID.randomUUID(), aug = UUID.randomUUID(), sep = UUID.randomUUID();
        assertThat(BscWholeCascadeRules.missingPeriods(List.of(aug, sep), List.of(q3)))
                .containsExactly(aug, sep);
    }

    @Test
    @DisplayName("Đợt của thẻ con nằm trong đợt của thẻ nguồn ⇒ khớp")
    void periodSubsetMatches() {
        UUID aug = UUID.randomUUID(), sep = UUID.randomUUID();
        assertThat(BscWholeCascadeRules.missingPeriods(List.of(sep), List.of(aug, sep))).isEmpty();
    }

    @Test
    @DisplayName("Trọng số phải trong (0, 100]")
    void weightRange() {
        assertThat(BscWholeCascadeRules.validWeight(10.0)).isTrue();
        assertThat(BscWholeCascadeRules.validWeight(100.0)).isTrue();
        assertThat(BscWholeCascadeRules.validWeight(0.0)).isFalse();
        assertThat(BscWholeCascadeRules.validWeight(-5.0)).isFalse();
        assertThat(BscWholeCascadeRules.validWeight(100.1)).isFalse();
        assertThat(BscWholeCascadeRules.validWeight(null)).isFalse();
    }
}
