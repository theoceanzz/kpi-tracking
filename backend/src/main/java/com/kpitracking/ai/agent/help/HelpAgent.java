package com.kpitracking.ai.agent.help;

import dev.langchain4j.invocation.InvocationParameters;
import dev.langchain4j.service.SystemMessage;
import dev.langchain4j.service.UserMessage;

/**
 * Agent hỏi đáp về KeyGo và quy chế tổ chức, trả lời từ kho tri thức RAG.
 *
 * <p>Là một interface thuần: langchain4j dựng phần cài đặt (gọi model, truy hồi, chèn ngữ cảnh)
 * theo cấu hình ở {@code HelpAgentFactory}. Không có logic Java nào ở đây để mà sai.
 *
 * <p>{@link InvocationParameters} mang {@code orgId} của người hỏi xuống bộ lọc truy hồi — đó là
 * chốt chặn đa tổ chức: quy chế của tổ chức khác không bao giờ lọt vào câu trả lời.
 *
 * <p>Trả {@code String}: đường dẫn và ảnh minh hoạ nằm ngay trong câu trả lời (Markdown, theo
 * prompt hệ thống) — không có thẻ "Nguồn" riêng cho người dùng.
 */
public interface HelpAgent {

    @SystemMessage(fromResource = "promptTemplates/helpAgentSystem.txt")
    String answer(@UserMessage String question, InvocationParameters params);
}
