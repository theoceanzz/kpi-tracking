package com.kpitracking.ai.agent.help;

import dev.langchain4j.invocation.InvocationParameters;
import dev.langchain4j.service.Result;
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
 * <p>Trả {@link Result} thay vì {@code String} để đọc được {@code sources()} — client hiện
 * "Nguồn: Hướng dẫn › 2.4. Trang Tổng quan" kèm nút mở đúng đường dẫn.
 */
public interface HelpAgent {

    @SystemMessage(fromResource = "promptTemplates/helpAgentSystem.txt")
    Result<String> answer(@UserMessage String question, InvocationParameters params);
}
