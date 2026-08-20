package com.kpitracking.service.ai.stage;

import com.kpitracking.advisor.ResponseSanitizingAdvisor;
import com.kpitracking.service.ai.AiStage;
import com.kpitracking.service.ai.AiStageChain;
import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.ChatMemoryCleaner;
import com.kpitracking.service.ai.PlanStep;
import com.kpitracking.service.ai.form.FormRegistry;
import com.kpitracking.service.ai.form.FormSpec.Descriptor;
import com.kpitracking.service.ai.form.FormSpec.Field;
import com.kpitracking.tool.ToolRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Điểm CUỐI của chuỗi: gọi model với đúng bộ công cụ đã chọn.
 *
 * <p>Là stage duy nhất không gọi {@code next} — mọi stage đứng trước nó đều bọc quanh lời gọi này.
 */
@Component
@Order(1100)
@Slf4j
public class ModelCallStage implements AiStage {

    private final ChatClient chatClient;
    private final ChatClient chatClientWithMemory;
    private final ChatMemoryCleaner chatMemoryCleaner;
    private final FormRegistry formRegistry;

    @Value("classpath:/promptTemplates/orgUnitToolSystemPromptTemplate.st")
    Resource orgUnitSystemPrompt;

    /**
     * Tên mọi @Tool có thể gửi cho model, gom một lần bằng reflection để bộ lọc câu trả lời xoá
     * được tên tool bị lọt ra ngoài mà không phải duy trì danh sách trùng lặp.
     */
    private static final Set<String> TOOL_NAMES = collectToolNames();

    private static Set<String> collectToolNames() {
        Set<String> names = new LinkedHashSet<>();
        for (Class<?> toolClass : ToolRegistry.toolClasses()) {
            for (Method m : toolClass.getDeclaredMethods()) {
                org.springframework.ai.tool.annotation.Tool tool =
                        m.getAnnotation(org.springframework.ai.tool.annotation.Tool.class);
                if (tool == null) continue;
                names.add(tool.name() != null && !tool.name().isBlank() ? tool.name() : m.getName());
            }
        }
        return names;
    }

    public ModelCallStage(@Qualifier("openAiChatClient") ChatClient chatClient,
                          @Qualifier("chatClientWithMemory") ChatClient chatClientWithMemory,
                          ChatMemoryCleaner chatMemoryCleaner,
                          FormRegistry formRegistry) {
        this.chatClient = chatClient;
        this.chatClientWithMemory = chatClientWithMemory;
        this.chatMemoryCleaner = chatMemoryCleaner;
        this.formRegistry = formRegistry;
    }

    @Override
    public String handle(AiTurn turn, AiStageChain next) {
        Object[] tools = turn.getTools().toArray();
        String result = turn.isHasMemory()
                ? chatClientWithMemory.prompt()
                    .user(turn.getQuestion())
                    .system(s -> s.text(orgUnitSystemPrompt)
                            .param("currentDateTime", turn.getCurrentDateTime())
                            .param("plan", planBlock(turn))
                            .param("form", formBlock(turn)))
                    .tools(tools)
                    .toolContext(turn.getToolCtx())
                    .advisors(spec -> spec.param("chat_memory_conversation_id", turn.getConversationId()))
                    .advisors(new ResponseSanitizingAdvisor(TOOL_NAMES))
                    .call()
                    .content()
                : chatClient.prompt()
                    .user(turn.getQuestion())
                    .system(s -> s.text(orgUnitSystemPrompt)
                            .param("currentDateTime", turn.getCurrentDateTime())
                            .param("plan", planBlock(turn))
                            .param("form", formBlock(turn)))
                    .tools(tools)
                    .toolContext(turn.getToolCtx())
                    .advisors(new ResponseSanitizingAdvisor(TOOL_NAMES))
                    .call()
                    .content();

        // Model suy luận (gpt-oss) đôi lúc tiêu hết token cho phần suy luận rồi chạm
        // finishReason=LENGTH trước khi kịp sinh text -> content rỗng. Không để lộ bong bóng
        // trống ra người dùng.
        if (result == null || result.isBlank()) {
            log.warn("AI trả nội dung rỗng (nghi finishReason=LENGTH). question={}", turn.getQuestion());
            chatMemoryCleaner.dropOrphanUserMessage(turn.memoryConversationId());
            return "Xin lỗi, mình chưa tạo được câu trả lời cho yêu cầu này (nội dung xử lý quá dài). "
                    + "Bạn thử hỏi ngắn gọn/cụ thể hơn giúp mình nhé.";
        }
        return result;
    }

    /**
     * Khối kế hoạch chèn vào cuối prompt hệ thống. Rỗng khi không có kế hoạch — tức là khi tắt
     * {@code PlanningStage} thì prompt giữ nguyên đúng như trước, không thêm một ký tự nào.
     */
    /**
     * Khối mô tả form đang mở. Rỗng khi người dùng không mở form nào — lượt chat bình thường giữ
     * nguyên prompt đúng như trước, không thêm một ký tự nào.
     */
    private String formBlock(AiTurn turn) {
        String formId = turn.getOpenFormId();
        if (formId == null || formId.isBlank()) return "";
        Descriptor form = formRegistry.find(formId);
        if (form == null) return "";

        StringBuilder sb = new StringBuilder("\n## FORM ĐANG MỞ TRÊN MÀN HÌNH\n")
                .append("Người dùng đang mở form **").append(form.label()).append("**.\n")
                .append("Các ô điền được: ")
                .append(form.fields().stream().map(Field::label).collect(Collectors.joining(", ")))
                .append(".\n")
                // Đo được: với câu "Đặt kỳ là Tháng 6/2026", model trả lời "tôi không có công cụ
                // để tạo hoặc thiết lập kỳ KPI mới" — nó hiểu ĐẶT là tạo thực thể mới trong hệ
                // thống chứ không phải điền vào ô. Nói thẳng vào đúng chỗ nhầm đó.
                .append("Người dùng bảo ĐẶT / SỬA / CHỌN / ĐIỀN bất kỳ ô nào ở trên → gọi `")
                .append(form.toolName()).append("`. Đó là điền vào form đang mở, ")
                .append("KHÔNG phải tạo dữ liệu mới trong hệ thống.\n")
                .append("Chỉ điền ô họ thực sự nêu; ô không chắc thì BỎ QUA.\n");

        Map<String, Object> values = turn.getOpenFormValues();
        if (values != null && !values.isEmpty()) {
            List<String> filled = values.entrySet().stream()
                    .filter(e -> e.getValue() != null && !String.valueOf(e.getValue()).isBlank())
                    .map(e -> {
                        Field f = form.field(e.getKey());
                        return (f != null ? f.label() : e.getKey()) + "=" + e.getValue();
                    })
                    .toList();
            if (!filled.isEmpty()) {
                sb.append("Các ô đã có sẵn giá trị: ").append(String.join("; ", filled))
                        .append(". Đừng đề xuất lại đúng những giá trị này.\n");
            }
        }
        return sb.toString();
    }

    private String planBlock(AiTurn turn) {
        List<PlanStep> steps = turn.getPlan();
        if (steps == null || steps.isEmpty()) return "";

        // Lượt hỏi LẠI: chỉ nêu phần còn thiếu. Nhắc lại cả kế hoạch chỉ khiến model gọi lại những
        // tool đã chạy xong, tốn token mà không thêm dữ liệu.
        List<String> missing = turn.getMissingPlannedTools();
        if (missing != null && !missing.isEmpty()) {
            StringBuilder sb = new StringBuilder("\n## CÒN THIẾU\n"
                    + "Câu trả lời trước đã bỏ sót các vế sau. PHẢI gọi bằng được các tool dưới đây "
                    + "rồi trả lời LẠI cho ĐẦY ĐỦ cả câu hỏi:\n");
            int i = 1;
            for (PlanStep step : steps) {
                if (step.hasTool() && missing.contains(step.tool())) {
                    sb.append(i++).append(". ").append(step.describe()).append('\n');
                }
            }
            return sb.toString();
        }

        // Nêu rõ SỐ vế. Bản trước chỉ dặn "không được dừng sau bước đầu tiên", và model tuân thủ
        // đúng nguyên văn: nó dừng sau bước THỨ HAI. Đo được ở 5/7 lượt hỏng của nhóm C, vế bị bỏ
        // luôn là vế cuối.
        StringBuilder sb = new StringBuilder("\n## KẾ HOẠCH CHO CÂU HỎI NÀY\n"
                + "Câu hỏi này có " + steps.size() + " vế, cần " + steps.size()
                + " lời gọi tool. PHẢI gọi ĐỦ cả " + steps.size()
                + " bước dưới đây rồi mới trả lời:\n");
        int i = 1;
        for (PlanStep step : steps) {
            sb.append(i++).append(". ").append(step.describe()).append('\n');
        }
        sb.append("Trả lời mà thiếu vế cuối (bước ").append(steps.size()).append(") là SAI.\n");
        return sb.toString();
    }

    @Override
    public int getOrder() { return 1100; }
}
