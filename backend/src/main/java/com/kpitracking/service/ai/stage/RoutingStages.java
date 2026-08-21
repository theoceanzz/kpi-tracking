package com.kpitracking.service.ai.stage;

import com.kpitracking.service.ai.AiStage;
import com.kpitracking.service.ai.AiStageChain;
import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.PlanStep;
import com.kpitracking.service.ai.form.FormRegistry;
import com.kpitracking.service.ai.intent.IntentStrategy;
import com.kpitracking.tool.EscapeHatchTool;
import com.kpitracking.tool.ToolRegistry;
import com.kpitracking.tool.ToolRegistry.Group;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Ba công đoạn quyết định model được cầm những công cụ nào: chọn nhóm theo ý định, lọc theo quyền,
 * và nới ra khi model báo thiếu.
 */
public final class RoutingStages {

    private RoutingStages() {}

    /** Câu hỏi cần những nhóm tool nào. Tắt định tuyến thì lấy toàn bộ nhóm đọc. */
    @Component
    @Order(800)
    @RequiredArgsConstructor
    @Slf4j
    public static class IntentStage implements AiStage {
        private final IntentStrategy intentStrategy;
        private final ToolRegistry toolRegistry;

        @Override
        public String handle(AiTurn turn, AiStageChain next) {
            if (!intentStrategy.isEnabled()) {
                turn.setGroups(toolRegistry.readGroups());
                log.info("Nhóm hiệu lực {} cho câu hỏi: {}", turn.getGroups(), turn.getQuestion());
                return next.proceed(turn);
            }

            Set<Group> groups = new LinkedHashSet<>(intentStrategy.route(turn.getQuestion()));

            // Kế hoạch (công đoạn 700) đã nêu đích danh tool cho từng vế của câu hỏi — thông tin
            // chắc chắn hơn hẳn việc router đoán nhóm từ câu hỏi thô. HỢP chứ không giao: định
            // tuyến chỉ được phép nới rộng, không bao giờ lấy mất tool của model.
            // Đo được: router bỏ sót INSIGHT ở "Tổng quan KPI đơn vị tôi, kèm ... ai chưa nộp"
            // trong CẢ HAI lần chạy, nên get_analytics không hề được gửi đi.
            Set<Group> fromPlan = ToolRegistry.groupsForTools(plannedTools(turn));
            if (groups.addAll(fromPlan)) {
                log.debug("Kế hoạch nới nhóm thêm {}", fromPlan);
            }
            turn.setGroups(groups);

            // Ghi nhóm HIỆU LỰC (sau khi hợp), không chỉ nhóm router tự chọn. "Router chọn ..."
            // của LlmIntentStrategy vẫn giữ để đo riêng độ chính xác của router, nhưng thứ quyết
            // định model cầm được tool nào là dòng này.
            log.info("Nhóm hiệu lực {} cho câu hỏi: {}", groups, turn.getQuestion());
            return next.proceed(turn);
        }

        private List<String> plannedTools(AiTurn turn) {
            List<PlanStep> plan = turn.getPlan();
            if (plan == null) return List.of();
            return plan.stream().filter(PlanStep::hasTool).map(PlanStep::tool).toList();
        }

        @Override
        public int getOrder() { return 800; }
    }

    /**
     * Bộ tool trao cho model = nhóm đã chọn ∩ quyền của người dùng.
     *
     * <p>Lọc theo quyền ở đây chứ không phải lúc thực thi là có chủ ý: tool người dùng không có
     * quyền dùng sẽ không bao giờ xuất hiện trong danh sách gửi đi, nên model không thể gọi thứ
     * nó không nhìn thấy.
     */
    @Component
    @Order(900)
    @RequiredArgsConstructor
    @Slf4j
    public static class ToolSelectionStage implements AiStage {
        private final ToolRegistry toolRegistry;
        private final FormRegistry formRegistry;

        @Override
        public String handle(AiTurn turn, AiStageChain next) {
            List<Object> tools =
                    new ArrayList<>(toolRegistry.toolsFor(turn.getGroups(), turn.getManager().userId()));

            // Tool điền form chỉ được gửi khi người dùng ĐANG mở đúng form đó. Không mở form thì
            // model không nhìn thấy nó, nên vừa không thể đề xuất nhầm, vừa không tốn token mô tả
            // tool cho những lượt chat chẳng liên quan gì tới form.
            Object formTool = toolRegistry.formTool(formRegistry.toolNameFor(turn.getOpenFormId()));
            if (formTool != null) {
                tools.add(formTool);
                log.debug("Mở tool điền form cho form đang mở: {}", turn.getOpenFormId());
            }
            turn.setTools(tools);
            return next.proceed(turn);
        }

        @Override

        public String label() { return "Đang chọn công cụ phù hợp"; }

        @Override
        public int getOrder() { return 900; }
    }

    /**
     * Cửa thoát hiểm: model báo thiếu công cụ thì nới ra TOÀN BỘ nhóm đọc rồi hỏi lại đúng một lần.
     *
     * <p>Đây là ví dụ rõ nhất cho việc vì sao khung phải cho stage gọi {@code next} NHIỀU LẦN:
     * nó cần chạy phần sau, xem kết quả, rồi chạy lại phần sau với đầu vào khác.
     */
    @Component
    @Order(1000)
    @RequiredArgsConstructor
    @Slf4j
    public static class EscapeHatchStage implements AiStage {
        private final ToolRegistry toolRegistry;

        @Override
        public String handle(AiTurn turn, AiStageChain next) {
            String answer = next.proceed(turn);

            if (EscapeHatchTool.wasRequested()) {
                log.info("Mở rộng bộ công cụ và hỏi lại. Lý do model nêu: {}", EscapeHatchTool.reason());
                // Báo ở ĐÂY chứ không qua label(): chỉ những lượt thật sự phải nới bộ công cụ mới
                // đáng nói, và nó chỉ lộ ra sau khi model đã trả lời lượt đầu.
                turn.progress(this, "Đang mở thêm công cụ");
                EscapeHatchTool.clear();
                turn.setGroups(toolRegistry.readGroups());
                turn.setTools(toolRegistry.toolsFor(toolRegistry.readGroups(), turn.getManager().userId()));
                answer = next.proceed(turn);
            }
            return answer;
        }

        @Override
        public int getOrder() { return 1000; }
    }
}
