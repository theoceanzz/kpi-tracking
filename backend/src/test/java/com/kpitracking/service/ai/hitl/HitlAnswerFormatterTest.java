package com.kpitracking.service.ai.hitl;

import com.kpitracking.service.ai.hitl.HitlAnswerFormatter.ItemAnswer;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Câu trả lời của thẻ hỏi -> văn bản cho model. Chốt hai điều: chỉ lựa chọn CÓ THẬT trong thẻ lọt
 * vào prompt, và "mọi câu đều trống" nghĩa là người dùng bỏ qua.
 */
class HitlAnswerFormatterTest {

    private static final PendingQuestion.Option BE = PendingQuestion.Option.of("Team Backend", "Team Backend");
    private static final PendingQuestion.Option DS = PendingQuestion.Option.of("Team Design", "Team Design");

    private PendingQuestion card(PendingQuestion.Item... items) {
        return new PendingQuestion("q", "t", UUID.randomUUID(), List.of(items));
    }

    @Test
    @DisplayName("chọn nhiều -> nối các lựa chọn; chữ tự nhập đi kèm")
    void multiSelectWithText() {
        PendingQuestion q = card(new PendingQuestion.Item("Chọn team?", List.of(BE, DS), true));

        assertThat(HitlAnswerFormatter.format(q, List.of(new ItemAnswer(List.of("Team Backend", "Team Design"), " quý 3 "))))
                .isEqualTo("Team Backend, Team Design; ghi thêm: quý 3");
    }

    @Test
    @DisplayName("chọn một mà client gửi hai -> chỉ lấy cái đầu; giá trị lạ bị bỏ")
    void singleSelectKeepsOneAndDropsUnknownValues() {
        PendingQuestion q = card(new PendingQuestion.Item("Chọn team?", List.of(BE, DS), false));

        assertThat(HitlAnswerFormatter.format(q, List.of(new ItemAnswer(List.of("Team Lạ", "Team Design", "Team Backend"), null))))
                .isEqualTo("Team Design");
    }

    @Test
    @DisplayName("chỉ tự nhập (hỏi mở) -> chính chữ đó")
    void freeTextOnly() {
        PendingQuestion q = card(new PendingQuestion.Item("Mục tiêu bao nhiêu %?", List.of(), false));

        assertThat(HitlAnswerFormatter.format(q, List.of(new ItemAnswer(null, "97,5%")))).isEqualTo("97,5%");
    }

    @Test
    @DisplayName("nhiều câu -> mỗi dòng 'câu hỏi → trả lời', câu trống ghi (bỏ qua)")
    void severalQuestions() {
        PendingQuestion q = card(
                new PendingQuestion.Item("Chọn team?", List.of(BE, DS), true),
                new PendingQuestion.Item("Kỳ nào?", List.of(), false));

        assertThat(HitlAnswerFormatter.format(q, List.of(new ItemAnswer(List.of("Team Backend"), null), new ItemAnswer(null, ""))))
                .isEqualTo("Chọn team? → Team Backend\nKỳ nào? → (bỏ qua)");
    }

    @Test
    @DisplayName("mọi câu đều trống -> null (= bỏ qua)")
    void allEmptyMeansSkipped() {
        PendingQuestion q = card(new PendingQuestion.Item("Chọn team?", List.of(BE, DS), false));

        assertThat(HitlAnswerFormatter.format(q, List.of(new ItemAnswer(List.of(), "  ")))).isNull();
    }
}
