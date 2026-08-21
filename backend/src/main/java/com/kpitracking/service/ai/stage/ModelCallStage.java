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
import org.springframework.ai.openai.OpenAiChatOptions;
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
 *
 * <p><b>Vì sao mặc định KHÔNG dùng {@code .stream()}.</b> Đo được, tất định 3/3 lần mỗi bên: với câu
 * <i>"So sánh Team Backend và Team Frontend về số thành viên, rồi cho biết đơn vị nào nhiều KPI
 * hơn"</i>, {@code .call()} gọi 3 tool còn {@code .stream()} chỉ gọi 1. Câu trả lời qua luồng vì thế
 * MỎNG HƠN mà không báo lỗi gì — đúng loại hỏng âm thầm mà cả {@code ValidationStage} lẫn
 * {@code PlanCompletionStage} sinh ra để chống. Cũng chính nó khiến đề xuất điền form qua luồng hay
 * trượt: lời gọi tool đầu tiên hỏng thì không còn đủ vòng để model sửa.
 *
 * <p><b>Nghi phạm: gọi tool SONG SONG.</b> {@code OpenAiChatModel.internalStream} CÓ tự gọi lại sau
 * khi chạy tool, nên khung không thiếu vòng lặp. Nhưng
 * {@code OpenAiStreamFunctionCallingHelper.merge} phân định tool call chỉ dựa vào {@code id} và bỏ
 * qua {@code index}, lại còn ném {@code IllegalStateException} nếu một chunk chứa nhiều tool call —
 * tức nó tự nhận là không gộp nổi nhiều tool call trong một message. Vì vậy khi bật cờ
 * {@code app.ai.streaming.enabled} thì gửi kèm {@code parallel_tool_calls=false} để mỗi vòng chỉ
 * một tool call, nhường phần còn lại cho đoạn đệ quy vốn đã đúng.
 *
 * <p>Cờ mặc định TẮT. Chỉ bật khi đo lại thấy số tool đường luồng BẰNG đường {@code .call()}. Đến
 * lúc đó mới nối lại phần phát chữ dần; hiện tại nhánh luồng chỉ gom chữ, để nếu bản vá không ăn
 * thì gỡ đúng một nhánh chứ không phải hoàn tác cả TurnListener / SSE / frontend.
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

    /** Xem ghi chú ở đầu lớp: mặc định TẮT cho tới khi đo được số tool hai đường bằng nhau. */
    @Value("${app.ai.streaming.enabled:false}")
    boolean streamingEnabled;

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
        ResponseSanitizingAdvisor sanitizer = new ResponseSanitizingAdvisor(TOOL_NAMES);
        ChatClient.ChatClientRequestSpec spec = requestSpec(turn, sanitizer);

        String result = streamingEnabled ? streamContent(spec, turn, sanitizer) : spec.call().content();

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
     * Dựng lời gọi model. Tách riêng cho dễ đọc: phần thân {@code handle} chỉ còn việc gọi và xử lý
     * câu trả lời rỗng.
     */
    private ChatClient.ChatClientRequestSpec requestSpec(AiTurn turn, ResponseSanitizingAdvisor sanitizer) {
        ChatClient client = turn.isHasMemory() ? chatClientWithMemory : chatClient;
        ChatClient.ChatClientRequestSpec spec = client.prompt()
                .user(turn.getQuestion())
                .system(s -> s.text(orgUnitSystemPrompt)
                        .param("currentDateTime", turn.getCurrentDateTime())
                        .param("plan", planBlock(turn))
                        .param("form", formBlock(turn)))
                .tools(turn.getTools().toArray())
                .toolContext(turn.getToolCtx())
                .advisors(sanitizer);
        if (streamingEnabled) {
            // CHỈ đặt trên nhánh luồng: đường .call() đã đo kỹ, không đụng tới. An toàn vì
            // OpenAiChatModel.createRequest gộp bằng ModelOptionsUtils.merge(runtime, default) —
            // trường không đặt rơi về mặc định yaml, nên model/temperature/max-tokens giữ nguyên.
            spec = spec.options(OpenAiChatOptions.builder().parallelToolCalls(false).build());
        }
        return turn.isHasMemory()
                ? spec.advisors(a -> a.param("chat_memory_conversation_id", turn.getConversationId()))
                : spec;
    }

    /**
     * Gom toàn văn trong lúc phát từng mẩu chữ cho client.
     *
     * <p>Chặn tới khi luồng xong ({@code blockLast}) nên chuỗi công đoạn vẫn đồng bộ — các công đoạn
     * bọc ngoài không phải biết gì về streaming.
     *
     * <p>Phải tự lọc ở đây vì {@code ResponseSanitizingAdvisor} chạy trên TOÀN VĂN (sửa bảng
     * Markdown, xoá tên tool) nên không thể lọc theo từng mẩu — một tên tool bị cắt đôi qua hai mẩu
     * sẽ lọt lưới. Hệ quả: chữ đã phát là BẢN XEM TRƯỚC, còn thứ trả về đây mới là bản chính thức.
     */
    private String streamContent(ChatClient.ChatClientRequestSpec spec, AiTurn turn,
                                 ResponseSanitizingAdvisor sanitizer) {
        StringBuilder full = new StringBuilder();
        spec.stream()
                .content()
                .doOnNext(chunk -> {
                    if (chunk == null || chunk.isEmpty()) return;
                    // Mẩu chữ ĐẦU TIÊN là ranh giới thật giữa "còn tra cứu" và "đang viết".
                    if (full.isEmpty()) turn.progress(this, "Đang soạn câu trả lời");
                    full.append(chunk);
                    emit(turn, chunk);
                })
                .blockLast();
        return sanitizer.sanitizeText(full.toString());
    }

    /** Phát chữ hỏng KHÔNG được làm hỏng lượt — câu trả lời mới là thứ người dùng cần. */
    private void emit(AiTurn turn, String chunk) {
        try {
            turn.getListener().token(chunk);
        } catch (Exception e) {
            log.warn("Phát mẩu chữ lỗi ({}), bỏ qua", e.getMessage());
        }
    }

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

    /**
     * Khối kế hoạch chèn vào cuối prompt hệ thống. Rỗng khi không có kế hoạch — tức là khi tắt
     * {@code PlanningStage} thì prompt giữ nguyên đúng như trước, không thêm một ký tự nào.
     */
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
    public String label() { return "Đang tra cứu dữ liệu"; }

    @Override
    public int getOrder() { return 1100; }
}
