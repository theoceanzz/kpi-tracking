package com.kpitracking.ai.agent;

import com.kpitracking.ai.memory.TurnRegistry;
import com.kpitracking.ai.workflow.TurnSteps;
import com.kpitracking.ai.tool.KeyGoToolProvider;
import com.kpitracking.ai.tool.RequestContextBinder;
import dev.langchain4j.agentic.AgenticServices;
import dev.langchain4j.data.message.ToolExecutionResultMessage;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.StreamingChatModel;
import dev.langchain4j.rag.RetrievalAugmentor;
import dev.langchain4j.service.AiServices;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Dựng các agent LLM từ interface của chúng.
 *
 * <p>Mỗi agent là một bean, dựng đúng một lần; mọi thứ thay đổi theo lượt (prompt hệ thống, bộ
 * tool, bộ nhớ, người nghe SSE) tra theo {@code @MemoryId} hoặc đi qua {@code InvocationParameters}
 * chứ không qua việc dựng lại agent. Đó là lý do {@link AssistantAgent} dùng
 * {@code systemMessageProvider} + {@code toolProvider} + {@code chatMemoryProvider} +
 * {@code streamingChatModel(Function<AgenticScope, …>)} thay vì giá trị cố định.
 *
 * <p>{@link AssistantAgent} dựng bằng {@code AgenticServices.agentBuilder} (là {@code @Agent} đặt
 * thẳng vào đồ thị); các agent còn lại là {@code AiServices} thường vì chúng được gọi từ code.
 */
@Configuration
@Slf4j
public class AgentFactory {

    /**
     * Trần số vòng gọi tool trong MỘT lời gọi agent chính. Giữ bằng {@code max-steps} của đồ thị cũ:
     * vượt trần gần như chắc chắn là model đang loay hoay, và mỗi vòng là một lần trả token cho
     * toàn bộ prompt.
     */
    @Value("${app.ai.agent.max-steps:10}")
    private int maxSteps;

    @Value("${app.ai.streaming.enabled:false}")
    private boolean streamingEnabled;

    @Bean
    public AssistantAgent assistantAgent(StreamingChatModel streamingChatModel,
                                         KeyGoToolProvider toolProvider, TurnRegistry turns,
                                         SystemPromptRenderer prompts, RequestContextBinder contextBinder) {
        // AgentBuilder chỉ nhận MỘT model; agent trả TokenStream nên là model streaming — chọn THEO
        // LƯỢT: bọc để mang người dùng của lượt vào từng lời gọi và phát chữ dần nếu có người nghe.
        return AgenticServices.agentBuilder(AssistantAgent.class)
                .streamingChatModel(scope -> TurnStreamingChatModel.forTurn(
                        streamingChatModel, contextBinder, TurnSteps.turnOf(scope), streamingEnabled))
                // Render lại ở MỖI lời gọi — vòng hai của vòng lặp mới có khối "còn thiếu vế".
                .systemMessageProvider(memoryId -> prompts.render(turns.turn(memoryId)))
                .toolProvider(toolProvider)
                .chatMemoryProvider(turns)
                .maxSequentialToolsInvocations(maxSteps)
                // Model bịa tên tool: trả lời như một tool lỗi để nó tự sửa trong lượt, thay vì ném
                // ngoại lệ làm hỏng cả câu trả lời vì một lần gõ sai.
                .hallucinatedToolNameStrategy(req -> ToolExecutionResultMessage.from(req,
                        "{\"error\":\"Không có tool tên '" + req.name()
                                + "'. Chỉ dùng đúng tên trong danh sách tool được cấp.\"}"))
                .build();
    }

    @Bean
    public RouterAgent routerAgent(ChatModel chatModel) {
        return AiServices.builder(RouterAgent.class).chatModel(chatModel).build();
    }

    @Bean
    public PlannerAgent plannerAgent(ChatModel chatModel) {
        return AiServices.builder(PlannerAgent.class).chatModel(chatModel).build();
    }

    @Bean
    public FollowupAgent followupAgent(ChatModel chatModel) {
        return AiServices.builder(FollowupAgent.class).chatModel(chatModel).build();
    }

    @Bean
    public KpiSuggestionAgent kpiSuggestionAgent(ChatModel chatModel, KeyGoToolProvider toolProvider,
                                                 TurnRegistry memories, RetrievalAugmentor kpiSuggestionAugmentor) {
        return AiServices.builder(KpiSuggestionAgent.class)
                .chatModel(chatModel)
                .toolProvider(toolProvider)
                .chatMemoryProvider(memories)
                .maxSequentialToolsInvocations(maxSteps)
                // Mô tả công việc + chiến lược của tổ chức (nếu có) — xem KpiSuggestionRag.
                .retrievalAugmentor(kpiSuggestionAugmentor)
                .build();
    }
}
