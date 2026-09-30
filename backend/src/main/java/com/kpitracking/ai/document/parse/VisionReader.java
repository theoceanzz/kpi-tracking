package com.kpitracking.ai.document.parse;

import com.kpitracking.ai.config.TokenUsageListener;
import dev.langchain4j.data.message.ImageContent;
import dev.langchain4j.data.message.TextContent;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.response.ChatResponse;
import dev.langchain4j.model.openai.OpenAiChatModel;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/**
 * Giai đoạn 3: chép lại chữ và số liệu trong ẢNH minh chứng (jpg/png/webp, trang PDF scan) bằng một mô hình
 * đọc được ảnh, qua ĐÚNG nhà cung cấp đang dùng (HF router) — quyết định của người dùng ngày 26/09/2026.
 *
 * <p><b>Mô hình thứ hai, cố ý KHÔNG là bean {@link ChatModel}.</b> Cả hệ thống đang tiêm {@code ChatModel}
 * theo kiểu; thêm một bean cùng kiểu là mọi chỗ đó mơ hồ. Mô hình này chỉ phục vụ một việc nên nằm gọn
 * trong lớp này.
 *
 * <p>Mô hình chỉ CHÉP LẠI, không nhận xét — nhận xét là việc của {@code CriterionReviewAgent}, trên chữ đã
 * chép. Số liệu đọc từ ảnh được đánh dấu nguồn {@code IMAGE} và KHÔNG BAO GIỜ vào điểm (điểm do mã nguồn
 * tính từ dữ liệu có cấu trúc) — tài liệu kế hoạch mục 7.
 */
@Component
@Slf4j
public class VisionReader {

    static final String INSTRUCTION = """
            Đây là ảnh (minh chứng, hoặc trang tài liệu bản scan). Chép lại NGUYÊN VĂN mọi chữ và con số
            đọc được trong ảnh, giữ thứ tự từ trên xuống. Bảng thì chép thành từng dòng "| ô | ô |".
            Chỗ nào không đọc rõ thì ghi [không rõ] — TUYỆT ĐỐI không đoán. Không nhận xét, không tóm tắt,
            không thêm lời dẫn. Ảnh không có chữ thì trả đúng một dòng: (ảnh không có chữ)""";

    @Value("${app.ai.vision.enabled:true}") boolean enabled;
    @Value("${app.ai.vision.model:Qwen/Qwen3-VL-30B-A3B-Instruct}") String modelName;
    @Value("${app.ai.model.base-url}") String baseUrl;
    @Value("${app.ai.model.api-key}") String apiKey;
    @Value("${app.ai.vision.timeout-seconds:60}") int timeoutSeconds;
    @Value("${app.ai.vision.max-tokens:2000}") int maxTokens;

    private final TokenUsageListener tokenUsageListener;
    private ChatModel model;

    public VisionReader(TokenUsageListener tokenUsageListener) {
        this.tokenUsageListener = tokenUsageListener;
    }

    @PostConstruct
    void init() {
        if (!enabled) return;
        model = OpenAiChatModel.builder()
                .baseUrl(baseUrl)
                .apiKey(apiKey)
                .modelName(modelName)
                .temperature(0.0)
                .maxTokens(maxTokens)
                .timeout(Duration.ofSeconds(timeoutSeconds))
                // Cùng sổ token với mọi lời gọi AI khác — nhãn tính năng do luồng gọi đặt.
                .listeners(List.of(tokenUsageListener))
                .build();
        log.info("Mô hình đọc ảnh tài liệu: {}", modelName);
    }

    public boolean enabled() {
        return enabled && model != null;
    }

    public String modelName() {
        return modelName;
    }

    /**
     * Chép lại chữ trong một hoặc vài ảnh (các trang của cùng một tệp).
     *
     * @return văn bản đã chép; {@code null} khi ảnh không có chữ
     */
    public String transcribe(List<byte[]> images, String mimeType) {
        if (!enabled()) throw new IllegalStateException("Mô hình đọc ảnh đang tắt");
        List<dev.langchain4j.data.message.Content> contents = new ArrayList<>();
        contents.add(TextContent.from(INSTRUCTION));
        for (byte[] img : images) {
            contents.add(ImageContent.from(Base64.getEncoder().encodeToString(img), mimeType));
        }
        ChatResponse res = model.chat(UserMessage.from(contents));
        String text = res.aiMessage() == null ? null : res.aiMessage().text();
        if (text == null || text.isBlank() || text.strip().equals("(ảnh không có chữ)")) return null;
        return text.strip();
    }
}
