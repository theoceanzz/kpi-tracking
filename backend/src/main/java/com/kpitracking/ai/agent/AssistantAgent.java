package com.kpitracking.ai.agent;

import dev.langchain4j.invocation.InvocationParameters;
import dev.langchain4j.service.MemoryId;
import dev.langchain4j.service.Result;
import dev.langchain4j.service.TokenStream;
import dev.langchain4j.service.UserMessage;

/**
 * Agent chính: trả lời câu hỏi bằng cách gọi tool trên dữ liệu thật của KeyGo.
 *
 * <p>Là interface thuần; langchain4j dựng phần cài đặt ở {@code AgentFactory}: prompt hệ thống
 * theo lượt ({@code SystemPromptRenderer}), bộ tool theo lượt và theo quyền
 * ({@code KeyGoToolProvider}), bộ nhớ theo lượt ({@code TurnChatMemory}), vòng gọi tool tối đa
 * {@code maxSequentialToolsInvocations}. Thay cho {@code ModelNode/ActNode/ModelGateway}.
 *
 * <p>Ba tham số của mỗi lời gọi:
 * <ul>
 *   <li>{@code turnId} — {@code @MemoryId}, khoá tra {@code TurnChatMemory} của lượt;</li>
 *   <li>{@code question} — câu hỏi;</li>
 *   <li>{@code params} — ngữ cảnh lượt (đơn vị, người dùng, form đang mở, {@code AgentState}...),
 *       langchain4j chuyển thẳng vào tham số {@code InvocationParameters} của từng tool.</li>
 * </ul>
 *
 * <p>Hai bản: {@link #chat} chờ trọn câu; {@link #chatStream} phát chữ dần qua {@link TokenStream}.
 * Cùng một prompt, cùng bộ tool — chỉ khác cách nhận kết quả.
 */
public interface AssistantAgent {

    Result<String> chat(@MemoryId String turnId, @UserMessage String question, InvocationParameters params);

    TokenStream chatStream(@MemoryId String turnId, @UserMessage String question, InvocationParameters params);
}
