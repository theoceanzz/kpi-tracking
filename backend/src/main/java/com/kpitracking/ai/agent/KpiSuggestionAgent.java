package com.kpitracking.ai.agent;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.dto.response.ai.AiKpiSuggestionResponse;
import dev.langchain4j.invocation.InvocationParameters;
import dev.langchain4j.service.MemoryId;
import dev.langchain4j.service.SystemMessage;
import dev.langchain4j.service.UserMessage;

import java.util.List;

/**
 * Agent gợi ý KPI cho một đơn vị: đọc số liệu qua tool ĐỌC (và mô tả công việc/chiến lược của tổ
 * chức qua RAG — xem {@code KpiSuggestionRag}) rồi trả danh sách có cấu trúc.
 *
 * <p>Dùng chung {@code KeyGoToolProvider} với agent chính nên cùng một bộ lọc quyền; không có bộ nhớ
 * hội thoại ({@code @MemoryId} chỉ để tách đệm giữa các lượt đồng thời).
 *
 * <p><b>Trả {@code String} rồi tự bóc JSON</b>, không trả {@code List<Pojo>}: langchain4j 1.20 chỉ
 * cho kiểu trả là bộ sưu tập khi model nhận JSON-schema có cấu trúc; với router OpenAI-tương thích
 * (không khai báo năng lực đó) nó ném {@code IllegalStateException} ngay trước khi gọi model — đo
 * được: gợi ý KPI hỏng hoàn toàn từ khi chuyển lõi. Prompt hệ thống vốn đã đòi thuần JSON, nên bóc
 * ở {@link #parse} là đủ và không phụ thuộc nhà cung cấp.
 */
public interface KpiSuggestionAgent {

    @SystemMessage(fromResource = "promptTemplates/kpiSuggestionSystemPrompt.st")
    String suggest(@MemoryId String turnId, @UserMessage String prompt, InvocationParameters params);

    ObjectMapper JSON = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    /**
     * Mảng JSON trong câu trả lời. Model hay bọc trong ```json … ``` hoặc thêm một câu dẫn dù đã
     * dặn không — lấy từ dấu {@code [} đầu tới {@code ]} cuối. Không có mảng nào thì danh sách rỗng.
     */
    static List<AiKpiSuggestionResponse> parse(String raw) {
        if (raw == null) return List.of();
        int from = raw.indexOf('[');
        int to = raw.lastIndexOf(']');
        if (from < 0 || to <= from) return List.of();
        try {
            return JSON.readValue(raw.substring(from, to + 1), new TypeReference<List<AiKpiSuggestionResponse>>() {});
        } catch (Exception e) {
            throw new IllegalStateException("Gợi ý KPI không phải JSON hợp lệ: " + e.getMessage(), e);
        }
    }
}
