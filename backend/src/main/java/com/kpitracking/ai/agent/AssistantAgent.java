package com.kpitracking.ai.agent;

import com.kpitracking.ai.workflow.TurnSteps;
import dev.langchain4j.agentic.Agent;
import dev.langchain4j.invocation.InvocationParameters;
import dev.langchain4j.service.MemoryId;
import dev.langchain4j.service.TokenStream;
import dev.langchain4j.service.UserMessage;
import dev.langchain4j.service.V;

/**
 * Agent chính: trả lời câu hỏi bằng cách gọi tool trên dữ liệu thật của KeyGo.
 *
 * <p>Là một {@code @Agent} của mô-đun agentic, đặt thẳng vào vòng lặp của {@code KeyGoAssistant}.
 * Mô-đun tự điền ba tham số từ {@code AgenticScope} của lượt:
 * <ul>
 *   <li>{@code question} — state khoá {@value TurnSteps#QUESTION}, bước {@code context} ghi;</li>
 *   <li>{@code turnId} — {@code @MemoryId} = {@code scope.memoryId()}, khoá tra {@code AiTurn} và
 *       {@code TurnChatMemory} trong {@code TurnRegistry};</li>
 *   <li>{@code params} — execution context của scope (bước {@code context} ghi bằng
 *       {@code writeExecutionContext}), langchain4j chuyển thẳng vào tham số
 *       {@code InvocationParameters} của từng tool.</li>
 * </ul>
 * Phần còn lại (prompt hệ thống theo lượt, bộ tool theo quyền, bộ nhớ, trần vòng gọi tool) do
 * {@code AgentFactory} gắn vào lúc dựng.
 *
 * <p>Luôn trả {@link TokenStream}: mô-đun agentic tự tiêu thụ luồng và ghi câu trả lời hoàn chỉnh
 * vào state {@value TurnSteps#ANSWER}. Chữ chạy dần ra SSE đi qua {@code TurnStreamingChatModel}
 * chứ không qua luồng này — nên đường JSON và đường SSE dùng chung một lời gọi.
 */
public interface AssistantAgent {

    @Agent(name = "assistant", description = "Trả lời câu hỏi nghiệp vụ KeyGo bằng tool trên dữ liệu thật",
            outputKey = TurnSteps.ANSWER)
    @UserMessage("{{question}}")
    TokenStream chat(@V(TurnSteps.QUESTION) String question, @MemoryId String turnId, InvocationParameters params);
}
