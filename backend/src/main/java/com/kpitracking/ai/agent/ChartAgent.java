package com.kpitracking.ai.agent;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.dto.response.ai.ChartSpec;
import dev.langchain4j.service.SystemMessage;
import dev.langchain4j.service.UserMessage;
import dev.langchain4j.service.V;

import java.util.List;

/**
 * Agent chọn BIỂU ĐỒ cho câu trả lời: đọc câu hỏi, câu trả lời và kết quả tool của lượt rồi đề nghị
 * 0–2 biểu đồ trong bộ KeyGo đã có, kèm loại, tiêu đề, nhãn trục, đơn vị và màu.
 *
 * <p>Là agent RIÊNG chạy song song với bước kiểm duyệt, không phải tool của agent chính: chọn biểu
 * đồ là việc trình bày, nó không cần quyền, không cần gọi tool, và không được phép làm chậm hay làm
 * hỏng đường trả lời. Lỗi ở đây chỉ mất biểu đồ, câu trả lời (kèm bảng) vẫn nguyên.
 *
 * <p>Trả {@code String} rồi tự bóc JSON: langchain4j 1.20 chỉ cho kiểu trả POJO khi model công bố
 * JSON-schema, router HuggingFace thì không — cùng lý do với {@code KpiSuggestionAgent} trước đây.
 */
public interface ChartAgent {

    @SystemMessage(fromResource = "promptTemplates/chartAgentSystem.st")
    @UserMessage("""
            Câu hỏi của người dùng:
            {{question}}

            Câu trả lời của trợ lý:
            {{answer}}

            Dữ liệu thật do công cụ trả về trong lượt này (CHỈ được dùng số ở đây):
            {{payloads}}
            """)
    String choose(@V("question") String question, @V("answer") String answer, @V("payloads") String payloads);

    ObjectMapper MAPPER = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    /**
     * Bóc mảng biểu đồ từ câu trả lời của model: tìm {@code "charts"} rồi lấy mảng JSON đầu tiên.
     * Model hay kèm lời dẫn hoặc rào ```json — bóc thay vì đòi nó trả sạch.
     */
    static List<ChartSpec> parse(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        int start = raw.indexOf('[');
        int end = raw.lastIndexOf(']');
        if (start < 0 || end <= start) return List.of();
        try {
            ChartSpec[] charts = MAPPER.readValue(raw.substring(start, end + 1), ChartSpec[].class);
            return charts == null ? List.of() : List.of(charts);
        } catch (Exception e) {
            return List.of();
        }
    }
}
