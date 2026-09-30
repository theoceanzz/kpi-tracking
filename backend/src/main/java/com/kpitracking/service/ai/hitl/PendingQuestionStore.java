package com.kpitracking.service.ai.hitl;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Sổ các câu hỏi đang chờ người dùng trả lời, khoá theo {@code turnId}.
 *
 * <p>Luồng của lượt CHẶN ở {@link #await} cho tới khi client gọi {@link #answer} (qua REST) hoặc hết
 * giờ. Chọn chặn thay vì treo-rồi-phục-hồi vì kết nối SSE của lượt vẫn đang mở: người dùng đang
 * nhìn khung chat, câu trả lời tới trong vài giây, và giữ nguyên ngữ cảnh trong bộ nhớ đơn giản hơn
 * nhiều so với cất {@code AgenticScope} xuống DB rồi dựng lại cả SecurityContext lẫn luồng streaming.
 *
 * <p>Giá phải trả: một lượt đang hỏi giữ một luồng của {@code AiController.streamExecutor} (trần 32)
 * trong tối đa {@code app.ai.hitl.wait-seconds}. Bộ chặn 15 lượt/phút của hệ thống là trần thực tế
 * trước khi chạm con số đó.
 */
@Component
@Slf4j
public class PendingQuestionStore {

    /** Câu trả lời rỗng = người dùng bỏ qua hoặc hết giờ; bên gọi tự xử như "không chọn". */
    private record Waiting(PendingQuestion question, CompletableFuture<String> answer) {}

    private final Map<String, Waiting> waiting = new ConcurrentHashMap<>();

    /** Đăng ký câu hỏi và lấy về chỗ chờ. Một lượt chỉ có MỘT câu hỏi tại một thời điểm. */
    public CompletableFuture<String> register(PendingQuestion question) {
        Waiting w = new Waiting(question, new CompletableFuture<>());
        Waiting previous = waiting.put(question.turnId(), w);
        if (previous != null) previous.answer().complete(null);
        return w.answer();
    }

    /**
     * Chờ câu trả lời, tối đa {@code timeoutSeconds}. Trả {@code null} khi hết giờ, bị huỷ, hoặc
     * luồng bị ngắt — bên gọi coi như người dùng không chọn gì và kết thúc lượt cho lịch sự.
     */
    public String await(PendingQuestion question, CompletableFuture<String> answer, int timeoutSeconds) {
        try {
            return answer.get(timeoutSeconds, TimeUnit.SECONDS);
        } catch (TimeoutException e) {
            log.info("Hết {} giây chờ người dùng trả lời câu hỏi của trợ lý (turn {})", timeoutSeconds, question.turnId());
            return null;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        } catch (Exception e) {
            log.warn("Chờ câu trả lời lỗi: {}", e.getMessage());
            return null;
        } finally {
            waiting.remove(question.turnId());
        }
    }

    /**
     * Client trả lời. {@code answer} rỗng = bỏ qua (người dùng đóng thẻ hỏi).
     *
     * @return {@code false} khi lượt không còn chờ (đã hết giờ, đã trả lời, hoặc không phải người được hỏi)
     */
    public boolean answer(String turnId, String questionId, UUID userId, String answer) {
        Waiting w = waiting.get(turnId);
        if (w == null) return false;
        PendingQuestion q = w.question();
        if (!q.questionId().equals(questionId) || !q.userId().equals(userId)) {
            log.warn("Câu trả lời không khớp câu hỏi đang chờ (turn {})", turnId);
            return false;
        }
        waiting.remove(turnId);
        return w.answer().complete(answer == null || answer.isBlank() ? null : answer.strip());
    }

    /** Câu hỏi đang chờ của một lượt — để REST kiểm tra trước khi nhận câu trả lời. */
    public Optional<PendingQuestion> peek(String turnId) {
        Waiting w = waiting.get(turnId);
        return w == null ? Optional.empty() : Optional.of(w.question());
    }

    /** Số lượt đang chờ — dùng cho log và test. */
    public int size() {
        return waiting.size();
    }
}
