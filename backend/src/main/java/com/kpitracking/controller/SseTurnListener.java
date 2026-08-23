package com.kpitracking.controller;

import com.kpitracking.dto.response.ai.AiChatResponse;
import com.kpitracking.service.ai.TurnListener;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;

/**
 * Đẩy tiến độ của một lượt hỏi ra client qua SSE.
 *
 * <p>Đây là chỗ DUY NHẤT trong dự án biết cả hai thứ: chuỗi công đoạn và giao thức truyền. Stage và
 * {@code AiTurnPipeline} chỉ nói chuyện qua {@link TurnListener}, nên đổi sang WebSocket sau này chỉ
 * là viết một cài đặt khác của interface đó.
 *
 * <p>Bốn loại sự kiện:
 * <ul>
 *   <li>{@code stage} — vào một công đoạn hoặc trợ lý vừa tra cứu xong một thứ, kèm mã và nhãn</li>
 *   <li>{@code token} — một mẩu chữ. <b>BẢN XEM TRƯỚC</b>, chưa qua lọc</li>
 *   <li>{@code done} — câu trả lời CHÍNH THỨC đã lọc, kèm options/formPatch/followups như đường JSON</li>
 *   <li>{@code error} — lượt hỏng</li>
 * </ul>
 *
 * <p><b>Gửi hỏng không được làm hỏng lượt.</b> Client đóng tab giữa chừng là chuyện thường; lúc đó
 * mọi lời gửi đều ném, nhưng lượt vẫn phải chạy nốt để ghi cho đúng mức tiêu thụ token.
 */
@Slf4j
class SseTurnListener implements TurnListener {

    private final SseEmitter emitter;
    private volatile boolean broken;

    SseTurnListener(SseEmitter emitter) {
        this.emitter = emitter;
    }

    @Override
    public void stageStarted(String code, String label) {
        send("stage", Map.of("code", code, "label", label));
    }

    @Override
    public void token(String chunk) {
        send("token", Map.of("text", chunk));
    }

    /** Câu trả lời chính thức — client phải THAY bản xem trước bằng nội dung này. */
    void done(AiChatResponse response) {
        send("done", response);
    }

    void failed(Exception e) {
        log.error("Lượt hỏi streaming thất bại: {}", e.getMessage(), e);
        send("error", Map.of("message",
                "Xin lỗi, mình gặp trục trặc khi xử lý yêu cầu này. Bạn thử lại giúp mình nhé."));
    }

    private void send(String event, Object data) {
        if (broken) return;
        try {
            emitter.send(SseEmitter.event().name(event).data(data));
        } catch (IOException | IllegalStateException e) {
            // Client đã ngắt. Ghi nhớ để khỏi thử gửi tiếp cho từng mẩu chữ còn lại.
            broken = true;
            log.debug("Client ngắt kết nối streaming, ngừng gửi: {}", e.getMessage());
        }
    }
}
