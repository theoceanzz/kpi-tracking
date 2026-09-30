package com.kpitracking.dto.request.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Câu trả lời của người dùng cho câu hỏi trợ lý đặt GIỮA LƯỢT (human-in-the-loop).
 *
 * <p>Lượt vẫn đang chạy trên luồng nền và chờ ở {@code PendingQuestionStore}; gửi cái này xong nó
 * làm tiếp và đẩy câu trả lời cuối qua chính kết nối SSE đang mở.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiAnswerRequest {
    /** Khoá của đúng câu hỏi đang chờ — chặn câu trả lời lạc của một thẻ hỏi cũ. */
    private String questionId;
    /** Lựa chọn người dùng chọn ({@code value} của option) hoặc câu họ tự gõ. */
    private String answer;
    /** Người dùng bấm "Bỏ qua" hoặc đóng khung chat: lượt kết thúc lịch sự bằng chính câu hỏi. */
    private Boolean cancelled;
    /**
     * Câu trả lời có cấu trúc, theo đúng thứ tự câu hỏi trong thẻ: các lựa chọn đã bấm (một hoặc
     * nhiều) và chữ tự nhập. Có thì dùng cái này thay cho {@link #answer}; máy chủ tự ghép thành văn
     * bản cho model và bỏ giá trị không có trong thẻ.
     */
    private java.util.List<Item> answers;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Item {
        private java.util.List<String> values;
        private String text;
    }
}
