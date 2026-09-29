package com.kpitracking.service.ai.review;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;

/**
 * Bóc JSON từ câu trả lời của mô hình.
 *
 * <p>Mô hình hay kèm lời dẫn ("Dưới đây là kết quả…") hoặc rào ```json — bóc khối từ dấu {@code {}
 * đầu tiên tới dấu {@code }} cuối cùng thay vì đòi nó trả sạch (cùng cách {@code ChartAgent.parse}).
 * Không bóc được thì trả {@code null} — bên gọi ghi lỗi cho chỉ tiêu đó, không làm hỏng cả lượt.
 */
@Slf4j
public final class ReviewResultParser {

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
            .configure(DeserializationFeature.ACCEPT_SINGLE_VALUE_AS_ARRAY, true);

    private ReviewResultParser() {}

    public static ReviewResults.CriterionAssessment criterion(String raw) {
        return parse(raw, ReviewResults.CriterionAssessment.class);
    }

    public static ReviewResults.Summary summary(String raw) {
        return parse(raw, ReviewResults.Summary.class);
    }

    static <T> T parse(String raw, Class<T> type) {
        if (raw == null || raw.isBlank()) return null;
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) return null;
        try {
            return MAPPER.readValue(raw.substring(start, end + 1), type);
        } catch (Exception e) {
            log.warn("Không bóc được JSON {} từ câu trả lời của mô hình: {}", type.getSimpleName(), e.getMessage());
            return null;
        }
    }
}
