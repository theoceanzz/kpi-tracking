package com.kpitracking.ai.agent;

import com.kpitracking.dto.response.ai.AiKpiSuggestionResponse;
import dev.langchain4j.invocation.InvocationParameters;
import dev.langchain4j.service.MemoryId;
import dev.langchain4j.service.SystemMessage;
import dev.langchain4j.service.UserMessage;

import java.util.List;

/**
 * Agent gợi ý KPI cho một đơn vị: đọc số liệu qua tool ĐỌC rồi trả danh sách có cấu trúc.
 *
 * <p>Thay phần {@code ChatClient ... .entity(List)} của {@code AiService.suggestKpis}. Dùng chung
 * {@code KeyGoToolProvider} với agent chính nên cùng một bộ lọc quyền; không có bộ nhớ hội thoại
 * ({@code @MemoryId} chỉ để tách đệm giữa các lượt đồng thời).
 */
public interface KpiSuggestionAgent {

    @SystemMessage(fromResource = "promptTemplates/kpiSuggestionSystemPrompt.st")
    List<AiKpiSuggestionResponse> suggest(@MemoryId String turnId, @UserMessage String prompt,
                                          InvocationParameters params);
}
