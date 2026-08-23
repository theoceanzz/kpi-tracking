package com.kpitracking.service.ai.stage;

import com.kpitracking.service.ai.AiStageChain;
import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.ChatMemoryCleaner;
import com.kpitracking.service.ai.PlanStep;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import com.kpitracking.service.ai.agent.AgentState;

/**
 * Test cho lưới an toàn: model bỏ sót bước đã lên kế hoạch thì hỏi lại đúng MỘT lần.
 *
 * <p>Đây là biện pháp cứng thay cho việc trông chờ model nghe lời prompt — 5/7 lượt hỏng của nhóm C
 * là model có đủ tool trong tay mà vẫn bỏ vế cuối.
 */
class PlanCompletionStageTest {

    private final List<String> promptsSeen = new ArrayList<>();
    private final ChatMemoryCleaner cleaner = mock(ChatMemoryCleaner.class);

    @AfterEach
    void tearDown() {
    }

    private AiTurn turnWithPlan(String... tools) {
        return turnWithMemoryAndPlan(null, tools);
    }

    private AiTurn turnWithMemoryAndPlan(String conversationId, String... tools) {
        AiTurn turn = new AiTurn("Team Backend mấy người, KPI gì, xu hướng ra sao?", conversationId, null);
        List<PlanStep> plan = new ArrayList<>();
        for (String t : tools) plan.add(new PlanStep(t, "việc của " + t));
        turn.setPlan(plan);
        // Trạng thái gắn sẵn: các test dưới đây ghi tool SAU khi dựng turn nên đọc thẳng từ đây.
        turn.setAgentState(new AgentState(turn));
        return turn;
    }

    /** Điểm cuối giả: ghi lại xem mỗi lượt gọi model thấy "còn thiếu" là gì. */
    private AiStageChain modelCall(Runnable sideEffect) {
        return t -> {
            promptsSeen.add(String.valueOf(t.getMissingPlannedTools()));
            if (sideEffect != null) sideEffect.run();
            return "câu trả lời";
        };
    }

    // ════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("tắt công tắc thì KHÔNG hỏi lại, dù thiếu bước")
    void disabledNeverRetries() {
        AiTurn turn = turnWithPlan("get_people", "get_kpi", "get_analytics");
        turn.getAgentState().recordSuccess("get_people");

        assertThat(new PlanCompletionStage(false, cleaner).handle(turn, modelCall(null)))
                .isEqualTo("câu trả lời");
        assertThat(promptsSeen).as("đúng một lần gọi model").hasSize(1);
    }

    @Test
    @DisplayName("gọi ĐỦ tool đã lên kế hoạch thì không hỏi lại")
    void completePlanDoesNotRetry() {
        AiTurn turn = turnWithPlan("get_people", "get_kpi");
        turn.getAgentState().recordSuccess("get_people");
        turn.getAgentState().recordSuccess("get_kpi");

        new PlanCompletionStage(true, cleaner).handle(turn, modelCall(null));

        assertThat(promptsSeen).hasSize(1);
    }

    @Test
    @DisplayName("thiếu tool -> hỏi lại đúng MỘT lần, và lượt hai chỉ nêu phần còn thiếu")
    void missingToolTriggersOneRetry() {
        AiTurn turn = turnWithPlan("get_people", "get_kpi", "get_analytics");
        turn.getAgentState().recordSuccess("get_people");
        turn.getAgentState().recordSuccess("get_kpi");

        // Lượt hỏi lại model vẫn bướng, không gọi get_analytics -> vẫn chỉ được hỏi lại một lần.
        new PlanCompletionStage(true, cleaner).handle(turn, modelCall(null));

        assertThat(promptsSeen).hasSize(2);
        assertThat(promptsSeen.get(0)).as("lượt đầu chưa biết thiếu gì").isEqualTo("null");
        assertThat(promptsSeen.get(1)).contains("get_analytics")
                .doesNotContain("get_people", "get_kpi");
    }

    @Test
    @DisplayName("hỏi lại TỐI ĐA một lần dù còn thiếu nhiều tool")
    void retriesAtMostOnce() {
        AiTurn turn = turnWithPlan("get_people", "get_kpi", "get_analytics", "rank");

        new PlanCompletionStage(true, cleaner).handle(turn, modelCall(null));

        assertThat(promptsSeen).as("model bỏ qua hai lần thì lần ba cũng vậy").hasSize(2);
    }

    @Test
    @DisplayName("lượt hỏi lại có gọi bù thì cờ 'còn thiếu' vẫn được dọn sau khi xong")
    void flagIsClearedAfterRetry() {
        AiTurn turn = turnWithPlan("get_people", "get_analytics");
        turn.getAgentState().recordSuccess("get_people");

        new PlanCompletionStage(true, cleaner).handle(turn, modelCall(() -> turn.getAgentState().recordSuccess("get_analytics")));

        assertThat(turn.getMissingPlannedTools())
                .as("để sót cờ là nhánh sau của chuỗi hiểu nhầm thành lượt hỏi lại")
                .isNull();
    }

    @Test
    @DisplayName("không có kế hoạch thì không bao giờ hỏi lại")
    void noPlanNoRetry() {
        AiTurn turn = new AiTurn("Phòng IT có mấy người?", null, null);

        new PlanCompletionStage(true, cleaner).handle(turn, modelCall(null));

        assertThat(promptsSeen).hasSize(1);
    }

    @Test
    @DisplayName("lượt CÓ bộ nhớ: xoá cặp hỏi-đáp thiếu sót trước khi hỏi lại")
    void retryDropsIncompleteExchangeFromMemory() {
        // Không xoá thì hội thoại đọng lại cùng câu hỏi hai lần kèm chính câu trả lời hỏng,
        // và mọi lượt sau đều phải trả tiền cho nó.
        AiTurn turn = turnWithMemoryAndPlan("conv-1","get_people", "get_analytics");
        turn.getAgentState().recordSuccess("get_people");

        new PlanCompletionStage(true, cleaner).handle(turn, modelCall(null));

        verify(cleaner).dropLastExchange("conv-1");
    }

    @Test
    @DisplayName("gọi đủ tool thì KHÔNG đụng vào bộ nhớ hội thoại")
    void noRetryLeavesMemoryAlone() {
        AiTurn turn = turnWithMemoryAndPlan("conv-1","get_people");
        turn.getAgentState().recordSuccess("get_people");

        new PlanCompletionStage(true, cleaner).handle(turn, modelCall(null));

        verify(cleaner, never()).dropLastExchange(anyString());
    }

    @Test
    @DisplayName("hỏi lại NÉM LỖI thì giữ câu trả lời của lượt đầu, không để cả lượt thành xin lỗi")
    void failedRetryKeepsFirstAnswer() {
        AiTurn turn = turnWithPlan("get_people", "get_analytics");
        turn.getAgentState().recordSuccess("get_people");
        int[] calls = {0};
        AiStageChain chain = t -> {
            if (++calls[0] == 1) return "câu trả lời thiếu một vế";
            throw new RuntimeException("provider trả 400 ở lượt hỏi lại");
        };

        assertThat(new PlanCompletionStage(true, cleaner).handle(turn, chain))
                .as("cơ chế cải thiện không được phép làm kết quả tệ hơn khi chưa có nó")
                .isEqualTo("câu trả lời thiếu một vế");
        assertThat(calls[0]).isEqualTo(2);
    }

    @Test
    @DisplayName("bước không nêu tool thì bỏ qua — không có gì để đối chiếu, hỏi lại là vô ích")
    void stepsWithoutToolAreIgnored() {
        AiTurn turn = new AiTurn("câu hỏi", null, null);
        turn.setPlan(List.of(new PlanStep(null, "làm gì đó"), new PlanStep(null, "làm gì nữa")));

        new PlanCompletionStage(true, cleaner).handle(turn, modelCall(null));

        assertThat(promptsSeen).hasSize(1);
    }
}
