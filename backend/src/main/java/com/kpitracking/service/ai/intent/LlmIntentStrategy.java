package com.kpitracking.service.ai.intent;

import com.kpitracking.tool.ToolRegistry.Group;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Chọn nhóm tool cần gửi cho model, dựa trên câu hỏi.
 *
 * <p>Một lần gọi LLM riêng với prompt rất nhỏ (~700 ký tự) thay vì gửi cả bộ tool. Rẻ hơn nhiều so
 * với ~15.500 ký tự định nghĩa tool đang gửi mỗi lượt, và cắt được phần lớn tải cho lần gọi chính.
 *
 * <p>Không dùng luật từ khoá làm cơ chế chính: tiếng Việt có dấu/không dấu, viết tắt, từ đồng nghĩa
 * — luật sẽ vỡ và vỡ âm thầm.
 *
 * <p><b>Nguyên tắc an toàn:</b> mọi trường hợp không chắc chắn (model trả rác, lỗi mạng, không khớp
 * nhóm nào) đều lùi về TOÀN BỘ nhóm đọc, tức đúng hành vi khi tắt router. Định tuyến sai chỉ có thể
 * làm chậm/tốn hơn, không bao giờ làm model mất công cụ một cách im lặng.
 */
@Component
@Slf4j
public class LlmIntentStrategy implements IntentStrategy {

    private static final String PROMPT = """
            Phân loại câu hỏi của người dùng vào một hoặc nhiều nhóm công cụ.

            LOOKUP  - cơ cấu tổ chức, đơn vị, nhân sự, chức vụ, hồ sơ cá nhân
            KPI     - chỉ tiêu KPI, kỳ đánh giá, bài nộp, ai chưa nộp, tổng quan KPI của đơn vị
            INSIGHT - xếp hạng, so sánh đơn vị, xu hướng theo thời gian, cảnh báo rủi ro,
                      bức tranh toàn đơn vị (quân số + số đơn vị con + số kỳ)
            BSC     - thẻ điểm cân bằng, viễn cảnh (tài chính/khách hàng/quy trình/học hỏi),
                      cân bằng viễn cảnh, điểm BSC
            OKR     - mục tiêu (objective), kết quả then chốt (key result), tiến độ mục tiêu
            ACTION  - người dùng RA LỆNH thay đổi dữ liệu: duyệt / phê duyệt / từ chối bài nộp,
                      duyệt chỉ tiêu, duyệt yêu cầu điều chỉnh, nhắc người chưa nộp.
                      CHỈ chọn khi họ bảo LÀM, không chọn khi họ chỉ HỎI về những thứ đó.

            Chỉ trả về tên nhóm, phân tách bằng dấu phẩy. Không giải thích.
            Câu hỏi cần nhiều loại dữ liệu thì trả nhiều nhóm.
            Không chắc thì trả: LOOKUP,KPI,INSIGHT

            Câu hỏi: {question}
            """;

    private final ChatClient chatClient;
    private final boolean enabled;

    public LlmIntentStrategy(@Qualifier("openAiChatClient") ChatClient chatClient,
                        @Value("${app.ai.tool-routing.enabled:false}") boolean enabled) {
        this.chatClient = chatClient;
        this.enabled = enabled;
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }

    /** Nhóm cần mở cho câu hỏi này. Luôn trả về tập KHÔNG rỗng. */
    @Override
    public Set<Group> route(String question) {
        // Lùi về phải gồm CẢ hai nhóm mới. Bỏ sót là router lưỡng lự sẽ im lặng lấy mất công cụ
        // BSC/OKR của model — đúng kiểu hỏng âm thầm mà cửa thoát hiểm sinh ra để chống.
        // Tập lùi về CHỈ gồm nhóm ĐỌC. Không bao giờ có ACTION ở đây: lùi về nghĩa là router không
        // chắc, mà "không chắc" thì tuyệt đối không phải lúc trao tool GHI cho model.
        Set<Group> all = Set.of(Group.LOOKUP, Group.KPI, Group.INSIGHT, Group.BSC, Group.OKR);
        if (!enabled || question == null || question.isBlank()) return all;

        try {
            String raw = chatClient.prompt()
                    .user(PROMPT.replace("{question}", question))
                    .call()
                    .content();
            if (raw == null) return all;

            Set<Group> picked = new LinkedHashSet<>();
            String upper = raw.toUpperCase(Locale.ROOT);
            // Phải quét ĐỦ mọi nhóm nêu trong prompt. Bản trước chỉ quét ba nhóm đầu, nên router
            // trả đúng "BSC" vẫn bị coi là không nhận ra và lùi về toàn bộ nhóm đọc — định tuyến
            // thành vô dụng đúng ở những câu nó đoán trúng.
            for (Group g : new Group[]{Group.LOOKUP, Group.KPI, Group.INSIGHT,
                    Group.BSC, Group.OKR, Group.ACTION}) {
                if (upper.contains(g.name())) picked.add(g);
            }
            if (picked.isEmpty()) {
                log.warn("Router không nhận ra nhóm nào từ '{}', lùi về toàn bộ nhóm đọc", raw.strip());
                return all;
            }
            log.debug("Router chọn {} cho câu hỏi: {}", picked, question);
            return picked;
        } catch (Exception e) {
            // Router hỏng không được làm hỏng cả tính năng chat.
            log.warn("Router lỗi ({}), lùi về toàn bộ nhóm đọc", e.getMessage());
            return all;
        }
    }
}
