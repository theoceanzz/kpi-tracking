package com.kpitracking.controller;

import com.kpitracking.dto.response.ai.AiChatResponse;
import com.kpitracking.exception.AiQuotaExceededException;
import com.kpitracking.exception.AiRateLimitException;
import com.kpitracking.exception.AiTokenQuotaExceededException;
import com.kpitracking.exception.ForbiddenException;
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
        send("error", Map.of("message", userMessageFor(e)));
    }

    /**
     * Câu báo lỗi cho người dùng, khớp với thứ {@code GlobalExceptionHandler} trả trên đường JSON.
     *
     * <p><b>Vì sao không dùng một câu chung cho tất cả.</b> Đường JSON để ngoại lệ NGHIỆP VỤ nổi lên
     * {@code GlobalExceptionHandler} và trả đúng lý do; đường SSE thì bắt mọi ngoại lệ trong
     * executor, nên trước đây người hết hạn mức token nhận được "mình gặp trục trặc" và không hiểu
     * vì sao — cùng một nguyên nhân, hai câu trả lời khác hẳn nhau tuỳ endpoint. Đo bộ 21 ca qua SSE
     * làm lộ ra điều này: hai lượt bị nhà cung cấp chặn 429 hiện ra y như một lỗi lập trình.
     *
     * <p>Chỉ nêu lý do cho các lỗi NGHIỆP VỤ đã biết. Lỗi lạ vẫn về câu chung — chi tiết của một
     * ngoại lệ không lường trước không phải thứ nên đẩy ra ngoài.
     */
    private static String userMessageFor(Exception e) {
        if (e instanceof AiQuotaExceededException) {
            return "Hệ thống AI đã đạt giới hạn sử dụng. Vui lòng thử lại sau ít phút.";
        }
        if (e instanceof AiTokenQuotaExceededException || e instanceof AiRateLimitException
                || e instanceof ForbiddenException) {
            return e.getMessage();
        }
        return "Xin lỗi, mình gặp trục trặc khi xử lý yêu cầu này. Bạn thử lại giúp mình nhé.";
    }

    private void send(String event, Object data) {
        if (broken) {
            // Sự kiện KẾT QUẢ mà rơi vào đây nghĩa là người dùng không nhận được câu trả lời nào,
            // dù model đã trả lời xong. Phải kêu lên: bản trước im lặng ở mức DEBUG, và đó là lý do
            // các ca "luồng SSE không có sự kiện done" tra mãi không ra nguồn.
            if ("done".equals(event) || "error".equals(event)) {
                log.warn("BỎ sự kiện '{}' vì luồng SSE đã hỏng từ trước — người dùng MẤT câu trả lời", event);
            }
            return;
        }
        try {
            emitter.send(SseEmitter.event().name(event).data(data));
        } catch (IOException | IllegalStateException e) {
            broken = true;
            // Mức WARN chứ không DEBUG, và nêu rõ sự kiện nào chết: mất một mẩu chữ là chuyện nhỏ,
            // mất 'done' là mất trắng câu trả lời — hai thứ đó không được lẫn vào cùng một dòng log
            // mà mặc định còn không in ra.
            log.warn("Gửi sự kiện '{}' hỏng ({}: {}), ngừng gửi phần còn lại của lượt",
                    event, e.getClass().getSimpleName(), e.getMessage());
        }
    }
}
