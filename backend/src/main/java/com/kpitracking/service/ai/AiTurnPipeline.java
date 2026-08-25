package com.kpitracking.service.ai;

import com.kpitracking.exception.AiQuotaExceededException;
import com.kpitracking.exception.AiRateLimitException;
import com.kpitracking.exception.AiTokenQuotaExceededException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.util.AiUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.AnnotationAwareOrderComparator;
import org.springframework.stereotype.Component;

import java.util.List;
import com.kpitracking.service.ai.agent.AgentState;

/**
 * Chạy chuỗi {@link AiStage} theo thứ tự, và là chỗ DUY NHẤT lo hai việc chung của mọi lượt:
 * dịch lỗi nhà cung cấp thành câu trả lời thân thiện, và chép kết quả của lượt lên {@code AiTurn}.
 *
 * <p>Trước đây hai việc này nằm trong {@code try/catch/finally} của
 * {@code AiService.processOrgUnitChat}. Chuyển ra đây để thêm công đoạn mới không phải chạm vào
 * chúng. Việc dọn ThreadLocal từng là mối lo lớn nhất ở đây; nay trạng thái nằm trong
 * {@code AgentState} gắn vào chính lượt, nên không còn gì để quên dọn.
 */
@Component
@Slf4j
public class AiTurnPipeline {

    private final List<AiStage> stages;
    private final ChatMemoryCleaner chatMemoryCleaner;

    public AiTurnPipeline(List<AiStage> stages,
                          ChatMemoryCleaner chatMemoryCleaner) {
        // Spring tiêm sẵn theo @Order, nhưng sắp lại tường minh để thứ tự không phụ thuộc
        // vào chi tiết của framework — thứ tự ở đây quyết định cả ngữ nghĩa bọc trong/bọc ngoài.
        this.stages = stages.stream()
                .sorted(AnnotationAwareOrderComparator.INSTANCE)
                .toList();
        this.chatMemoryCleaner = chatMemoryCleaner;
        log.info("Luồng xử lý AI gồm {} công đoạn: {}", this.stages.size(),
                this.stages.stream().map(s -> s.getClass().getSimpleName()).toList());
    }

    public String run(AiTurn turn) {
        try {
            return chainFrom(0).proceed(turn);
        } catch (AiQuotaExceededException | AiTokenQuotaExceededException
                 | AiRateLimitException | ForbiddenException e) {
            // Ngoại lệ NGHIỆP VỤ phải nổi lên GlobalExceptionHandler để trả đúng mã lỗi và đúng
            // thông báo. Nuốt chúng thành câu "mình gặp trục trặc" là làm người dùng hết hạn mức
            // hoặc bị chặn tần suất không hiểu vì sao — và làm chính việc chẩn đoán khó hơn.
            // (Trước khi tách pipeline, các phép kiểm này nằm NGOÀI try ở controller nên tự nổi lên.)
            chatMemoryCleaner.dropOrphanUserMessage(turn.memoryConversationId());
            throw e;
        } catch (Exception e) {
            chatMemoryCleaner.dropOrphanUserMessage(turn.memoryConversationId());
            if (AiUtils.isQuotaError(e)) {
                throw new AiQuotaExceededException("quota exceeded", e);
            }
            // Lỗi từ model/nhà cung cấp (vd gpt-oss trên groq trả HTTP 400 "output_parse_failed"
            // khi câu quá phức tạp / vòng gọi tool sinh output không parse được) -> KHÔNG ném ra
            // ngoài thành "lỗi không xác định"; log để chẩn đoán và trả câu thân thiện.
            log.error("Chat AI thất bại (question='{}'): {}", turn.getQuestion(), e.getMessage(), e);
            return "Xin lỗi, mình gặp trục trặc khi xử lý yêu cầu này (có thể do câu hỏi khá phức tạp). "
                    + "Bạn thử hỏi ngắn gọn/cụ thể hơn — ví dụ nêu rõ tên các phòng/đơn vị cần so sánh — giúp mình nhé.";
        } finally {
            // Không còn kho ThreadLocal nào để dọn. Trạng thái của lượt nằm trong AgentState —
            // nó đi cùng ToolContext, sống và chết theo lượt, nên không có đường rò sang lượt của
            // người khác trên cùng luồng Tomcat. Ở đây chỉ còn việc chép kết quả lên AiTurn cho
            // tầng gọi đọc.
            AgentState state = turn.getAgentState();
            if (state != null) {
                turn.setFormPatch(state.getFormPatch());
                turn.setPendingAction(state.getPendingAction());
                turn.setEvidenceRequested(state.isEvidenceRequested());
                turn.setFilesAttached(state.isFilesAttached());
            }
        }
    }

    /** Dựng mắt xích thứ i; hết chuỗi thì trả câu trả lời đã có trên turn (nếu stage cuối đã đặt). */
    private AiStageChain chainFrom(int index) {
        if (index >= stages.size()) {
            return t -> {
                throw new IllegalStateException(
                        "Chuỗi xử lý AI kết thúc mà không stage nào sinh câu trả lời. "
                                + "Stage cuối cùng phải là điểm cuối (không gọi next).");
            };
        }
        AiStage stage = stages.get(index);
        return turn -> {
            notifyStarted(turn, stage);
            return stage.handle(turn, chainFrom(index + 1));
        };
    }

    /**
     * Báo cho client biết đang vào công đoạn nào — chỉ với công đoạn CÓ nhãn.
     *
     * <p>Đặt ở ĐÂY chứ không trong từng stage vì chỗ này vốn đã bọc mọi stage: công đoạn chỉ cần
     * khai một nhãn là được báo tiến độ, không phải biết gì về client hay giao thức truyền.
     *
     * <p>Công đoạn không khai nhãn thì im lặng. Xem {@link AiStage#label()} — mặc định là không
     * hiện, vì nhãn này người dùng cuối đọc chứ không phải nhật ký chẩn đoán.
     *
     * <p>Báo tiến độ hỏng KHÔNG được làm hỏng lượt hỏi: nó là phần thêm, còn câu trả lời mới là thứ
     * người dùng cần.
     */
    private void notifyStarted(AiTurn turn, AiStage stage) {
        String label = stage.label();
        if (label == null) return;
        try {
            turn.getListener().stageStarted(stage.getClass().getSimpleName(), label);
        } catch (Exception e) {
            log.warn("Báo tiến độ công đoạn {} lỗi ({}), bỏ qua",
                    stage.getClass().getSimpleName(), e.getMessage());
        }
    }

    /** Danh sách stage đang chạy — dùng cho test và chẩn đoán. */
    public List<AiStage> stages() {
        return stages;
    }
}
