package com.kpitracking.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.util.concurrent.atomic.AtomicLong;

@Service
@Slf4j
public class AiService {

    private final ChatClient chatClient;

    // Rate limiter: tối thiểu 4 giây giữa các request để tránh vượt quota free tier
    // Free tier gemini: 20 req/min → tool calling dùng 2-3 req/query → ~7 query/min → ~8.5s/query
    // Đặt cooldown 4s cho safe margin
    private static final long MIN_INTERVAL_MS = 4000;
    private final AtomicLong lastRequestTime = new AtomicLong(0);

    public AiService(ChatClient chatClient) {
        this.chatClient = chatClient;
    }

    public String processChat(String question) {
        // Rate limiting: chờ nếu gọi quá nhanh
        long now = System.currentTimeMillis();
        long lastTime = lastRequestTime.get();
        long elapsed = now - lastTime;
        if (elapsed < MIN_INTERVAL_MS) {
            long waitTime = MIN_INTERVAL_MS - elapsed;
            try {
                log.debug("Rate limiting: waiting {}ms before next AI call", waitTime);
                Thread.sleep(waitTime);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return "Yêu cầu đã bị hủy.";
            }
        }
        lastRequestTime.set(System.currentTimeMillis());

        try {
            log.debug("Processing AI chat question: {}", question);
            String response = chatClient.prompt()
                    .user(question)
                    .call()
                    .content();
            log.debug("AI response: {}", response);
            // Fallback nếu model không trả lời đúng format
            if (response == null || response.isBlank()) {
                return "Xin lỗi, tôi không có công cụ để trả lời câu hỏi này.";
            }
            return response;
        } catch (Exception e) {
            log.error("Error during AI chat processing", e);
            // Xử lý lỗi 429 rate limit riêng
            String errorMsg = extractErrorMessage(e);
            if (errorMsg.contains("429") || errorMsg.contains("quota") || errorMsg.contains("rate")) {
                return "⚠️ Hệ thống AI đang quá tải. Vui lòng thử lại sau 30-60 giây.";
            }
            return "Xin lỗi, đã có lỗi xảy ra khi xử lý yêu cầu của bạn.";
        }
    }

    private String extractErrorMessage(Exception e) {
        StringBuilder sb = new StringBuilder();
        Throwable current = e;
        while (current != null) {
            if (current.getMessage() != null) {
                sb.append(current.getMessage()).append(" ");
            }
            current = current.getCause();
        }
        return sb.toString().toLowerCase();
    }
}
