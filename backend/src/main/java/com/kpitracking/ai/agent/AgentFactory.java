package com.kpitracking.ai.agent;

import com.kpitracking.ai.memory.TurnMemoryRegistry;
import com.kpitracking.ai.tool.KeyGoToolProvider;
import com.kpitracking.service.ai.agent.AgentState;
import dev.langchain4j.data.message.ToolExecutionResultMessage;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.StreamingChatModel;
import dev.langchain4j.service.AiServices;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Dựng các agent LLM từ interface của chúng.
 *
 * <p>Mỗi agent là một bean, dựng đúng một lần; mọi thứ thay đổi theo lượt (prompt hệ thống, bộ
 * tool, bộ nhớ) đi qua {@code InvocationParameters} và {@code @MemoryId} chứ không qua việc dựng
 * lại agent. Đó là lý do {@link AssistantAgent} dùng {@code systemMessageProviderWithContext} +
 * {@code toolProvider} + {@code chatMemoryProvider} thay vì giá trị cố định.
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

    @Bean
    public AssistantAgent assistantAgent(ChatModel chatModel, StreamingChatModel streamingChatModel,
                                         KeyGoToolProvider toolProvider, TurnMemoryRegistry memories,
                                         SystemPromptRenderer prompts) {
        return AiServices.builder(AssistantAgent.class)
                .chatModel(chatModel)
                .streamingChatModel(streamingChatModel)
                .systemMessageProviderWithContext(ctx -> {
                    AgentState state = ctx.invocationParameters() == null
                            ? null : ctx.invocationParameters().get(AgentState.CONTEXT_KEY);
                    if (state == null || state.getTurn() == null) {
                        throw new IllegalStateException("Gọi agent chính mà không có ngữ cảnh lượt");
                    }
                    return prompts.render(state.getTurn());
                })
                .toolProvider(toolProvider)
                .chatMemoryProvider(memories)
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
                                                 TurnMemoryRegistry memories) {
        return AiServices.builder(KpiSuggestionAgent.class)
                .chatModel(chatModel)
                .toolProvider(toolProvider)
                .chatMemoryProvider(memories)
                .maxSequentialToolsInvocations(maxSteps)
                .build();
    }
}
