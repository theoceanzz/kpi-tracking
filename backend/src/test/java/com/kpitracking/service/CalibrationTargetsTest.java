package com.kpitracking.service;

import com.kpitracking.service.UnitClassificationService.CalibrationMember;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Đề xuất hiệu chỉnh theo khung bell curve. Chỉ số mức: 0 = Loại 5 (tốt nhất) … 4 = Loại 1.
 *
 * <p>Ca "chi nhánh Hà Nội" (2026-09-25): 20 người dồn đáy — Loại 1: 6, Loại 2: 6, Loại 3: 6, Loại 4: 2,
 * Loại 5: 0; khung 9/24/34/24/9 % ±5. Thuật toán cũ ra 0 đề xuất vì (1) mức vượt trần là mức THẤP
 * NHẤT mà nó chỉ biết hạ người xuống mức kề dưới, (2) lượt lấp sàn không rút người của mức đang sát
 * sàn nên cả dây chuyền đứng im.
 */
class CalibrationTargetsTest {

    // Suất tính như UnitClassificationService: sàn round(), trần max(1, round()).
    private static final int[] MIN = {1, 4, 6, 4, 1};   // 4%, 19%, 29%, 19%, 4% của 20
    private static final int[] MAX = {3, 6, 8, 6, 3};   // 14%, 29%, 39%, 29%, 14% của 20
    private static final int[] HANOI = {0, 2, 6, 6, 6};

    @Test
    @DisplayName("chỉ gỡ trần: Loại 1 thừa 3 ⇒ dây chuyền đẩy lên các mức trên còn chỗ")
    void ceilingOnlyPushesBottomOverflowUpward() {
        int[] t = CalibrationTargets.targets(HANOI, new int[5], MAX, 20);
        // 3 người thừa của Loại 1: Loại 2 đã chạm trần 6 ⇒ Loại 3 nhận 2 (tới trần 8), Loại 4 nhận 1.
        assertThat(t).containsExactly(0, 3, 8, 6, 3);
        assertThat(Arrays.stream(t).sum()).isEqualTo(20);
        for (int i = 0; i < 5; i++) assertThat(t[i]).isLessThanOrEqualTo(MAX[i]);
    }

    @Test
    @DisplayName("gỡ cả trần lẫn sàn: về đúng khung 1/4/6/6/3")
    void fullTargetFitsFrame() {
        int[] t = CalibrationTargets.targets(HANOI, MIN, MAX, 20);
        assertThat(t).containsExactly(1, 4, 6, 6, 3);
    }

    @Test
    @DisplayName("xếp lại giữ thứ tự mạnh → yếu: ra đề xuất cho đúng người, không ai vượt qua người mạnh hơn")
    void assignmentKeepsOrderAndProducesMoves() {
        List<CalibrationMember> members = new ArrayList<>();
        Map<UUID, Integer> levelIdx = new HashMap<>();
        double score = 100;
        for (int level = 0; level < 5; level++) {
            for (int k = 0; k < HANOI[level]; k++) {
                UUID id = UUID.randomUUID();
                members.add(new CalibrationMember(id, "NV" + members.size(), "Phòng", score--, 5 - level, false, false));
                levelIdx.put(id, level);
            }
        }
        int[] target = CalibrationTargets.targets(HANOI, MIN, MAX, 20);
        Map<UUID, Integer> moves = UnitClassificationService.assignInOrder(members, levelIdx, target, new int[5]);

        assertThat(moves).isNotEmpty();
        int[] after = HANOI.clone();
        moves.forEach((id, to) -> { after[levelIdx.get(id)]--; after[to]++; });
        assertThat(after).containsExactly(1, 4, 6, 6, 3);

        // Thứ tự: sau hiệu chỉnh, người điểm cao hơn không bao giờ ở mức thấp hơn người điểm thấp hơn.
        List<CalibrationMember> byScore = members.stream()
                .sorted(Comparator.comparing(CalibrationMember::finalScore).reversed()).toList();
        int prev = -1;
        for (CalibrationMember m : byScore) {
            int lvl = moves.getOrDefault(m.userId(), levelIdx.get(m.userId()));
            assertThat(lvl).isGreaterThanOrEqualTo(prev);
            prev = lvl;
        }
    }

    @Test
    @DisplayName("người bị khoá đứng yên, suất của họ vẫn được tính")
    void lockedMembersStay() {
        List<CalibrationMember> members = new ArrayList<>();
        Map<UUID, Integer> levelIdx = new HashMap<>();
        UUID lockedId = null;
        double score = 100;
        for (int level = 0; level < 5; level++) {
            for (int k = 0; k < HANOI[level]; k++) {
                UUID id = UUID.randomUUID();
                boolean locked = level == 4 && k == 0; // một người Loại 1 thuộc đơn vị con đã khoá
                if (locked) lockedId = id;
                members.add(new CalibrationMember(id, "NV", "P", score--, 5 - level, locked, false));
                levelIdx.put(id, level);
            }
        }
        int[] fixed = {0, 0, 0, 0, 1};
        int[] target = CalibrationTargets.targets(HANOI, MIN, MAX, 20);
        Map<UUID, Integer> moves = UnitClassificationService.assignInOrder(members, levelIdx, target, fixed);
        assertThat(moves).doesNotContainKey(lockedId);
        int[] after = HANOI.clone();
        moves.forEach((id, to) -> { after[levelIdx.get(id)]--; after[to]++; });
        assertThat(after).containsExactly(1, 4, 6, 6, 3);
    }

    @Test
    @DisplayName("đã trong khung thì không đề xuất gì")
    void withinFrameNoMoves() {
        int[] ok = {1, 4, 6, 6, 3};
        assertThat(CalibrationTargets.targets(ok, MIN, MAX, 20)).containsExactly(ok);
    }

    @Test
    @DisplayName("khung làm tròn bất khả thi (tổng sàn > số người) vẫn trả đích dùng được")
    void infeasibleRoundingStillSumsToTotal() {
        int[] t = CalibrationTargets.targets(new int[]{0, 0, 3, 0, 0}, new int[]{1, 1, 1, 1, 1}, new int[]{1, 1, 1, 1, 1}, 3);
        assertThat(Arrays.stream(t).sum()).isEqualTo(3);
    }
}
