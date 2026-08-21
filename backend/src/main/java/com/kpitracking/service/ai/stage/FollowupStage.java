package com.kpitracking.service.ai.stage;

import com.kpitracking.dto.response.ai.FollowupResponse;
import com.kpitracking.entity.AiTokenUsage;
import com.kpitracking.service.AiTokenUsageRecorder;
import com.kpitracking.service.FollowupService;
import com.kpitracking.service.ai.AiStage;
import com.kpitracking.service.ai.AiStageChain;
import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.form.FormPatchStore;
import com.kpitracking.tool.ToolCallTracker;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Sinh các câu hỏi gợi ý tiếp theo cho lượt vừa trả lời.
 *
 * <p>Trước đây đây là một endpoint riêng ({@code POST /ai/followups}) và client phải gọi HAI lần
 * cho mỗi lượt chat. Gộp vào chuỗi để một lượt chat là một request, và để nó đi qua
 * {@code RateLimitStage}/{@code QuotaStage} như mọi thứ khác thay vì tự gọi.
 *
 * <p><b>Vì sao đứng ở thứ tự 500.</b> Ba ràng buộc kẹp nó vào đúng chỗ này:
 * <ul>
 *   <li>Phải bọc NGOÀI {@code ModelCallStage} — dữ liệu tool để neo câu gợi ý chỉ có sau vòng gọi tool.</li>
 *   <li>Phải bọc NGOÀI {@code ValidationStage} (600) — công đoạn đó có thể CHẶN câu trả lời, và sinh
 *       gợi ý cho một câu đã bị chặn vừa tốn một lời gọi model vừa gợi ý sai hướng.</li>
 *   <li>Phải nằm TRONG {@code TurnSetupStage} (400) — công đoạn đó gọi
 *       {@code followupContextStore.startTurn(...)} để xoá dữ liệu tool của lượt trước; chạy trước
 *       nó là đọc nhầm dữ liệu lượt cũ.</li>
 * </ul>
 *
 * <p><b>Không bao giờ được làm hỏng lượt.</b> Sinh gợi ý lỗi thì lượt vẫn trả câu trả lời bình
 * thường — cùng kỷ luật với {@code PlanningStage} và {@code IntentStrategy}.
 */
@Component
@Order(500)
@Slf4j
public class FollowupStage implements AiStage {

    private final FollowupService followupService;
    private final boolean enabled;

    /**
     * Mặc định BẬT, ngược với các công tắc công đoạn khác — và đó là chủ đích. Những công tắc kia
     * mặc định tắt vì chúng THÊM chi phí mới và phải đo trước khi bật; công đoạn này chỉ DỜI một
     * tính năng đang chạy, nên tắt mặc định là lấy mất tính năng của người dùng.
     */
    public FollowupStage(FollowupService followupService,
                         @Value("${app.ai.followups.enabled:true}") boolean enabled) {
        this.followupService = followupService;
        this.enabled = enabled;
    }

    @Override
    public String handle(AiTurn turn, AiStageChain next) {
        String answer = next.proceed(turn);
        if (!enabled) return answer;

        // Không tool nào chạy thành công nghĩa là lượt này không phải câu phân tích (chào hỏi, từ
        // chối, hỏi lại, hoặc bị ValidationStage chặn). FollowupService cũng tự nhận ra điều đó qua
        // kho dữ liệu tool, nhưng chặn sớm ở đây thì khỏi vào hàm.
        if (!ToolCallTracker.anyCalled()) return answer;

        // Lượt kết thúc bằng một đề xuất ĐIỀN FORM: việc tiếp theo của người dùng là kiểm lại các ô
        // rồi bấm Lưu, không phải hỏi tiếp chuyện khác.
        //
        // Không chặn thì gợi ý sinh ra lạc đề hẳn, và đó là lỗi ĐO ĐƯỢC: lượt điền form vẫn chạy các
        // tool tra cứu phụ (resolve tên đơn vị, tên kỳ → kéo về cả danh sách kỳ), model thấy dữ liệu
        // kỳ nên đẻ ra câu kiểu "Hiệu suất KPI tháng 6 so với tháng 4 giảm bao nhiêu phần trăm?"
        // ngay dưới dòng "Đã điền vào form".
        //
        // Đọc được FormPatchStore ở đây vì công đoạn này chạy TRƯỚC khối finally dọn ThreadLocal của
        // AiTurnPipeline.run(). Cùng tinh thần với FollowupService.isDisambiguating: im lặng còn hơn
        // gợi ý sai chỗ — và bớt luôn một lời gọi model.
        if (FormPatchStore.get() != null) return answer;

        // Báo ở ĐÂY chứ không qua label(): công đoạn này vào chuỗi ngay đầu lượt nhưng chỉ làm việc
        // sau khi model đã trả lời xong, nên nhãn phát lúc vào sẽ sớm hơn thực tế 10-15 giây.
        turn.progress(this, "Đang nghĩ vài câu hỏi tiếp theo");

        AiTokenUsage.AiFeature previous = AiTokenUsageRecorder.currentFeature();
        try {
            // Lời gọi này thuộc tính năng FOLLOWUP dù đang nằm trong lượt CHAT.
            AiTokenUsageRecorder.setFeature(AiTokenUsage.AiFeature.FOLLOWUP);
            FollowupResponse pools = followupService.generate(topic(turn), turn.memoryConversationId());
            if (pools != null && hasAny(pools)) {
                turn.setFollowups(pools);
            }
        } catch (Exception e) {
            log.warn("Sinh câu hỏi gợi ý lỗi ({}), bỏ qua gợi ý cho lượt này", e.getMessage());
        } finally {
            restore(previous);
        }
        return answer;
    }

    /**
     * Chủ đề để định hướng câu gợi ý: câu hỏi, kèm tiền tố tên đơn vị khi người dùng bấm từ một thẻ
     * Insight. Giữ đúng cách client cũ dựng chuỗi này, nên hành vi không đổi.
     */
    private String topic(AiTurn turn) {
        String unit = turn.getFocusUnitName();
        return unit == null || unit.isBlank()
                ? turn.getQuestion()
                : "[" + unit + "] " + turn.getQuestion();
    }

    private static boolean hasAny(FollowupResponse pools) {
        return (pools.getTechnical() != null && !pools.getTechnical().isEmpty())
                || (pools.getManagement() != null && !pools.getManagement().isEmpty());
    }

    private static void restore(AiTokenUsage.AiFeature previous) {
        if (previous == null) {
            AiTokenUsageRecorder.clearFeature();
        } else {
            AiTokenUsageRecorder.setFeature(previous);
        }
    }
    @Override
    public int getOrder() { return 500; }
}
