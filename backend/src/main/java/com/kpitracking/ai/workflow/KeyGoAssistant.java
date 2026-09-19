package com.kpitracking.ai.workflow;

import com.kpitracking.ai.agent.AssistantAgent;
import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.agent.AgentState;
import dev.langchain4j.agentic.AgenticServices;
import dev.langchain4j.agentic.UntypedAgent;
import dev.langchain4j.agentic.scope.AgenticScope;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Trợ lý KeyGo — đồ thị agent dựng bằng các builder của {@code langchain4j-agentic}.
 *
 * <pre>
 *   sequence [
 *     context      (agentAction)  nạp ngữ cảnh, bộ nhớ, ngày giờ
 *     plan         (agentAction)  PlannerAgent → kế hoạch (câu nhiều vế)
 *     route        (agentAction)  RouterAgent  → nhóm tool, hoặc ý định của một IntentHandler
 *     conditional [
 *       intent == X    → bước của IntentHandler X          (vd HELP: RAG)
 *       không khớp gì  → loop [ prepareRound (agentAction), AssistantAgent (@Agent) ]
 *                        tới khi !needsAnotherRound, tối đa 3 vòng
 *     ]
 *     finish       (agentAction)  lọc, dự phòng, ghi bộ nhớ
 *     parallel [ validate, followups ]
 *   ]
 * </pre>
 *
 * <p>Đây là {@code AgentGraph} + 7 stage cũ gói thành MỘT chỗ khai báo. Các bước là code thuần
 * ({@link TurnSteps}); agent LLM là interface; thứ tự và điều kiện rẽ nhánh nằm hết ở đây.
 * Thêm nhánh mới = thêm bean {@link IntentHandler}, lớp này không đổi.
 *
 * <p>Agent chính là {@code @Agent} thật của mô-đun agentic, đặt thẳng vào vòng lặp. Mô-đun điền
 * tham số cho nó từ scope: câu hỏi (state {@code question}), khoá lượt ({@code scope.memoryId()}
 * làm {@code @MemoryId}) và ngữ cảnh tool (execution context {@code InvocationParameters}) — bước
 * {@code context} ghi cả ba. Đầu ra ({@code TokenStream}) mô-đun tự tiêu thụ và ghi vào state
 * {@code answer}; chữ chạy dần ra SSE đi qua model bọc (xem {@code AgentFactory}).
 *
 * <p>Một ngoại lệ trong sub-agent nổi lên qua {@code invoke} và cắt ngang đồ thị — nên "hết ngân
 * sách vòng gọi tool" bắt ở {@link #answer}: trả câu dự phòng, không ghi bộ nhớ, không gợi ý.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class KeyGoAssistant {

    /** Trần số vòng của agent chính: một lần trả lời + hỏi lại vì thiếu vế + hỏi lại vì mở thêm tool. */
    static final int MAX_ROUNDS = 3;

    private final TurnSteps steps;
    private final AssistantAgent assistantAgent;
    private final List<IntentHandler> handlers;

    private UntypedAgent workflow;
    private ExecutorService parallelExecutor;

    @PostConstruct
    void build() {
        parallelExecutor = Executors.newCachedThreadPool(r -> {
            Thread t = new Thread(r, "kg-ai-parallel");
            t.setDaemon(true);
            return t;
        });

        var conditional = AgenticServices.conditionalBuilder().name("branch");
        for (IntentHandler h : handlers) {
            String intent = h.intent();
            conditional.subAgents(intent, scope -> intent.equals(scope.readState(TurnSteps.INTENT)),
                    AgenticServices.agentAction(h.step()::accept));
        }
        Object assistantLoop = AgenticServices.loopBuilder()
                .name("assistant-loop")
                .subAgents(AgenticServices.agentAction(steps::prepareRound), assistantAgent)
                .maxIterations(MAX_ROUNDS)
                // Mặc định mô-đun kiểm điều kiện thoát sau MỖI sub-agent — tức ngay sau prepareRound,
                // khi chưa có câu trả lời nào: vòng lặp thoát mà agent chưa hề chạy (đo được: câu
                // trả lời rỗng sau 1,5 s). Chỉ kiểm ở cuối vòng.
                .testExitAtLoopEnd(true)
                .exitCondition(scope -> !steps.needsAnotherRound(scope))
                .build();
        conditional.subAgents("assistant", scope -> scope.readState(TurnSteps.INTENT) == null, assistantLoop);

        Object tail = AgenticServices.parallelBuilder()
                .name("tail")
                .subAgents(AgenticServices.agentAction(steps::validate),
                        AgenticServices.agentAction(steps::followups))
                .executor(parallelExecutor)
                .build();

        workflow = AgenticServices.sequenceBuilder()
                .name("keygo-assistant")
                .subAgents(
                        AgenticServices.agentAction(steps::context),
                        AgenticServices.agentAction(steps::plan),
                        AgenticServices.agentAction(scope -> steps.route(scope, handlers)),
                        conditional.build(),
                        AgenticServices.agentAction(steps::finish),
                        tail)
                .output(scope -> answerOf(scope))
                .build();

        log.info("Trợ lý KeyGo: {} nhánh ý định {} + nhánh agent chính (tối đa {} vòng)",
                handlers.size(), handlers.stream().map(IntentHandler::intent).toList(), MAX_ROUNDS);
    }

    /**
     * langchain4j ném khi vượt trần vòng gọi tool; thông điệp là chỗ nhận ra duy nhất. Bản 1.20 nói
     * "exceeded N tool calling round trips (maxToolCallingRoundTrips)"; bản cũ nói "sequential tool"
     * — khớp cả hai, vì bản Pha 1 chỉ khớp chữ cũ nên đường dự phòng này chưa từng chạy.
     */
    static boolean isToolBudgetExceeded(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            String m = t.getMessage() == null ? "" : t.getMessage().toLowerCase(Locale.ROOT);
            if (m.contains("tool calling round trips") || m.contains("sequential tool")) return true;
        }
        return false;
    }

    private static String answerOf(AgenticScope scope) {
        AgentState state = TurnSteps.turnOf(scope).getAgentState();
        return state == null ? null : state.getAnswer();
    }

    /**
     * Chạy trọn một lượt. Người gọi đã kiểm hạn mức và quyền; kết quả phụ (đề xuất điền form, lời
     * mời xác nhận, nguồn trích dẫn, gợi ý) nằm trên chính {@link AiTurn}.
     */
    public String answer(AiTurn turn) {
        try {
            Object out = workflow.invoke(Map.of(TurnSteps.TURN, turn));
            return out == null ? null : out.toString();
        } catch (RuntimeException e) {
            AgentState state = turn.getAgentState();
            if (state == null || !isToolBudgetExceeded(e)) throw e;
            state.setBudgetExhausted(true);
            log.warn("Hết ngân sách vòng gọi tool. question='{}', đã gọi: {}", turn.getQuestion(), state.getSucceeded());
            String fallback = TurnSteps.fallbackAnswer(state);
            state.setAnswer(fallback);
            return fallback;
        } finally {
            steps.release(turn);
            AgentState state = turn.getAgentState();
            if (state != null) {
                turn.setFormPatch(state.getFormPatch());
                turn.setPendingAction(state.getPendingAction());
                turn.setConsumedActionId(state.getConsumedActionId());
                turn.setEvidenceRequested(state.isEvidenceRequested());
                turn.setFilesAttached(state.isFilesAttached());
            }
        }
    }
}
