package com.kpitracking.service.feedback360;

import com.kpitracking.dto.response.feedback360.F360ResultSnapshot;
import com.kpitracking.enums.F360Relationship;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;

import static com.kpitracking.enums.F360Relationship.*;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Luật tính điểm và ẩn danh là thứ không được sai lặng lẽ: một con số lệch trên báo cáo 360 vừa
 * làm sai đánh giá một người, vừa có thể làm lộ ai đã chấm gì. Test ở đây chủ yếu là các ca biên
 * của hai thứ đó.
 */
class F360ScoreCalculatorTest {

    private static final UUID COMM = UUID.randomUUID();
    private static final UUID LEAD = UUID.randomUUID();
    private static final UUID Q_COMM_1 = UUID.randomUUID();
    private static final UUID Q_COMM_2 = UUID.randomUUID();
    private static final UUID Q_LEAD = UUID.randomUUID();

    private static final List<F360ScoreCalculator.QuestionDef> QUESTIONS = List.of(
            new F360ScoreCalculator.QuestionDef(Q_COMM_1, COMM, "Giao tiếp", 50.0, 1, "Truyền đạt rõ ràng", 1),
            new F360ScoreCalculator.QuestionDef(Q_COMM_2, COMM, "Giao tiếp", 50.0, 1, "Lắng nghe", 2),
            new F360ScoreCalculator.QuestionDef(Q_LEAD, LEAD, "Lãnh đạo", 50.0, 2, "Định hướng rõ ràng", 3));

    private static Map<F360Relationship, Double> weights() {
        return new EnumMap<>(F360Settings.DEFAULT_WEIGHTS);
    }

    private static F360ScoreCalculator.Answer ans(F360Relationship r, UUID q, Double score) {
        return new F360ScoreCalculator.Answer(r, q, score);
    }

    /** n người chấm của nhóm r cùng cho điểm {@code score} ở mọi câu trong {@code qs}. */
    private static List<F360ScoreCalculator.Answer> group(F360Relationship r, int n, double score, UUID... qs) {
        List<F360ScoreCalculator.Answer> out = new ArrayList<>();
        for (int i = 0; i < n; i++) for (UUID q : qs) out.add(ans(r, q, score));
        return out;
    }

    private static F360ResultSnapshot compute(List<F360ScoreCalculator.Answer> answers,
                                              Map<F360Relationship, Integer> submitted, int k,
                                              boolean managerAnonymous, Map<F360Relationship, Double> weights) {
        return F360ScoreCalculator.compute(new F360ScoreCalculator.Input(
                QUESTIONS, answers, submitted, 5, k, managerAnonymous, weights, 1.0, 1.2));
    }

    private static F360ResultSnapshot.CompetencyScore competency(F360ResultSnapshot r, UUID key) {
        return r.getCompetencies().stream().filter(c -> c.getKey().equals(key)).findFirst().orElseThrow();
    }

    @Test
    @DisplayName("nhóm đủ ngưỡng hiện riêng; điểm tổng là trung bình có trọng số theo nhóm")
    void weightsByRelationship() {
        List<F360ScoreCalculator.Answer> answers = new ArrayList<>();
        answers.addAll(group(MANAGER, 1, 4, Q_COMM_1, Q_COMM_2));
        answers.addAll(group(PEER, 3, 2, Q_COMM_1, Q_COMM_2));

        F360ResultSnapshot r = compute(answers, Map.of(MANAGER, 1, PEER, 3), 3, false, weights());

        // Giao tiếp: (40·4 + 30·2) / 70 = 3.14
        assertThat(competency(r, COMM).getOthers()).isEqualTo(3.14);
        assertThat(r.getGroups()).extracting(F360ResultSnapshot.Group::getKey).containsExactly("MANAGER", "PEER");
        assertThat(r.getInsufficient()).isFalse();
    }

    @Test
    @DisplayName("nhóm dưới ngưỡng bị gộp; nhóm gộp vẫn dưới ngưỡng thì dữ liệu KHÔNG vào con số nào")
    void hiddenGroupNeverLeaksIntoTotals() {
        List<F360ScoreCalculator.Answer> answers = new ArrayList<>();
        answers.addAll(group(MANAGER, 1, 4, Q_COMM_1, Q_COMM_2));
        answers.addAll(group(PEER, 1, 1, Q_COMM_1, Q_COMM_2)); // một đồng nghiệp chấm rất thấp

        F360ResultSnapshot r = compute(answers, Map.of(MANAGER, 1, PEER, 1), 3, false, weights());

        F360ResultSnapshot.Group merged = r.getGroups().stream()
                .filter(g -> g.getKey().equals(F360AnonymityGuard.MERGED_KEY)).findFirst().orElseThrow();
        assertThat(merged.getVisible()).isFalse();
        // Nếu điểm của đồng nghiệp lọt vào điểm tổng thì trừ ngược là ra đúng điểm người đó chấm.
        assertThat(competency(r, COMM).getOthers()).isEqualTo(4.0);
        assertThat(r.getOverallScore()).isEqualTo(4.0);
        assertThat(competency(r, COMM).getByGroup()).containsOnlyKeys("MANAGER");
    }

    @Test
    @DisplayName("hai nhóm dưới ngưỡng gộp lại đủ ngưỡng thì hiện chung thành \"Người khác\"")
    void mergedGroupVisibleWhenEnough() {
        List<F360ScoreCalculator.Answer> answers = new ArrayList<>();
        answers.addAll(group(PEER, 2, 3, Q_COMM_1, Q_COMM_2));
        answers.addAll(group(DIRECT_REPORT, 1, 5, Q_COMM_1, Q_COMM_2));

        F360ResultSnapshot r = compute(answers, Map.of(PEER, 2, DIRECT_REPORT, 1), 3, false, weights());

        assertThat(competency(r, COMM).getByGroup()).containsOnlyKeys(F360AnonymityGuard.MERGED_KEY);
        assertThat(competency(r, COMM).getByGroup().get(F360AnonymityGuard.MERGED_KEY)).isEqualTo(3.67);
        assertThat(r.getGroups()).noneMatch(g -> g.getKey().equals("PEER") || g.getKey().equals("DIRECT_REPORT"));
    }

    @Test
    @DisplayName("câu có ít hơn k câu trả lời (nhiều người chọn N/A) thì ẩn riêng ô đó")
    void cellBelowThresholdHidden() {
        List<F360ScoreCalculator.Answer> answers = new ArrayList<>();
        answers.addAll(group(PEER, 3, 4, Q_COMM_1));
        answers.add(ans(PEER, Q_COMM_2, 2.0));
        answers.add(ans(PEER, Q_COMM_2, null));
        answers.add(ans(PEER, Q_COMM_2, null));

        F360ResultSnapshot r = compute(answers, Map.of(PEER, 3), 3, false, weights());

        F360ResultSnapshot.QuestionScore q2 = r.getQuestions().stream()
                .filter(q -> q.getId().equals(Q_COMM_2)).findFirst().orElseThrow();
        assertThat(q2.getByGroup()).isEmpty();
        assertThat(q2.getHiddenGroups()).containsExactly("PEER");
        // Năng lực chỉ tính từ câu hiện — điểm 2 của một người không kéo năng lực xuống.
        assertThat(competency(r, COMM).getOthers()).isEqualTo(4.0);
    }

    @Test
    @DisplayName("trọng số nhóm chuẩn hoá lại theo TỪNG năng lực — năng lực chỉ cấp dưới trả lời không bị kéo về nhóm vắng")
    void renormalisesPerCompetency() {
        List<F360ScoreCalculator.Answer> answers = new ArrayList<>();
        answers.addAll(group(MANAGER, 1, 2, Q_COMM_1, Q_COMM_2));
        answers.addAll(group(DIRECT_REPORT, 3, 5, Q_COMM_1, Q_COMM_2, Q_LEAD));

        F360ResultSnapshot r = compute(answers, Map.of(MANAGER, 1, DIRECT_REPORT, 3), 3, false, weights());

        assertThat(competency(r, LEAD).getOthers()).isEqualTo(5.0);
        // Giao tiếp: (40·2 + 20·5) / 60 = 3.0
        assertThat(competency(r, COMM).getOthers()).isEqualTo(3.0);
        // Tổng: (50·3 + 50·5) / 100 = 4.0
        assertThat(r.getOverallScore()).isEqualTo(4.0);
    }

    @Test
    @DisplayName("năng lực không ai trả lời bị loại khỏi mẫu số điểm tổng")
    void competencyWithoutAnswersDropped() {
        List<F360ScoreCalculator.Answer> answers = group(PEER, 3, 4, Q_COMM_1, Q_COMM_2);

        F360ResultSnapshot r = compute(answers, Map.of(PEER, 3), 3, false, weights());

        assertThat(competency(r, LEAD).getOthers()).isNull();
        assertThat(r.getOverallScore()).isEqualTo(4.0);
    }

    @Test
    @DisplayName("tự đánh giá trọng số 0 không vào điểm tổng, chỉ dùng để tìm điểm mù")
    void selfOnlyForGap() {
        List<F360ScoreCalculator.Answer> answers = new ArrayList<>();
        answers.addAll(group(SELF, 1, 5, Q_COMM_1, Q_COMM_2));
        answers.addAll(group(PEER, 3, 3, Q_COMM_1, Q_COMM_2));

        F360ResultSnapshot r = compute(answers, Map.of(SELF, 1, PEER, 3), 3, false, weights());

        assertThat(r.getOverallScore()).isEqualTo(3.0);
        assertThat(r.getSelfScore()).isEqualTo(5.0);
        assertThat(r.getBlindSpots()).extracting(F360ResultSnapshot.Gap::getName).containsExactly("Giao tiếp");
        assertThat(r.getResponseCount()).isEqualTo(3);
    }

    @Test
    @DisplayName("chỉ có tự đánh giá thì báo cáo gắn cờ thiếu phản hồi")
    void onlySelfIsInsufficient() {
        F360ResultSnapshot r = compute(group(SELF, 1, 4, Q_COMM_1), Map.of(SELF, 1), 3, false, weights());

        assertThat(r.getInsufficient()).isTrue();
        assertThat(r.getOverallScore()).isNull();
    }

    @Test
    @DisplayName("bật ẩn danh cấp trên: cấp trên (1 người) bị gộp, không hiện nhãn \"Cấp trên\"")
    void anonymousManagerMerged() {
        List<F360ScoreCalculator.Answer> answers = new ArrayList<>();
        answers.addAll(group(MANAGER, 1, 1, Q_COMM_1, Q_COMM_2));
        answers.addAll(group(PEER, 2, 4, Q_COMM_1, Q_COMM_2));

        F360ResultSnapshot r = compute(answers, Map.of(MANAGER, 1, PEER, 2), 3, true, weights());

        assertThat(r.getGroups()).extracting(F360ResultSnapshot.Group::getKey)
                .containsExactly(F360AnonymityGuard.MERGED_KEY);
        F360ResultSnapshot.Group merged = r.getGroups().get(0);
        assertThat(merged.getRelationships()).containsExactlyInAnyOrder("MANAGER", "PEER");
        assertThat(merged.getWeight()).isEqualTo(70.0);
        assertThat(competency(r, COMM).getOthers()).isEqualTo(3.0);
    }
}
