package com.kpitracking.service.ai.agent.node;

import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.PlanStep;
import com.kpitracking.service.ai.agent.AgentNode;
import com.kpitracking.service.ai.agent.AgentState;
import com.kpitracking.service.ai.agent.Node;
import com.kpitracking.service.ai.form.FormRegistry;
import com.kpitracking.service.ai.intent.IntentStrategy;
import com.kpitracking.tool.ToolRegistry;
import com.kpitracking.tool.ToolRegistry.Group;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Quyết định model được cầm những công cụ nào: chọn nhóm theo ý định, hợp với nhóm mà kế hoạch nêu,
 * rồi lọc theo quyền.
 *
 * <p>Gộp {@code IntentStage} và {@code ToolSelectionStage} thành một đỉnh vì cả hai chỉ làm đúng một
 * việc — chọn tool — và tách ra chỉ có nghĩa khi thứ tự là cố định theo {@code @Order}. Nay đây là
 * đỉnh mà cạnh quay lui của cửa thoát hiểm trỏ về, nên hai nửa phải chạy cùng nhau: nới nhóm mà
 * không lọc lại quyền là mở một đường vòng qua phân quyền.
 *
 * <p><b>Lọc theo quyền nằm ở đây chứ không phải lúc thực thi</b>, và đó là chủ đích: tool người dùng
 * không có quyền dùng sẽ không bao giờ xuất hiện trong danh sách gửi đi, nên model không thể gọi
 * thứ nó không nhìn thấy.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RouteNode implements Node {

    private final IntentStrategy intentStrategy;
    private final ToolRegistry toolRegistry;
    private final FormRegistry formRegistry;

    @Override
    public AgentNode id() {
        return AgentNode.ROUTE;
    }

    @Override
    public AgentNode run(AgentState state) {
        AiTurn turn = state.getTurn();
        turn.progress(id().name(), "Đang chọn công cụ phù hợp");

        Set<Group> groups = state.isWidenTools() ? toolRegistry.readGroups() : chooseGroups(turn);

        // Ghi nhóm HIỆU LỰC (sau khi hợp), không chỉ nhóm router tự chọn. "Router chọn ..." của
        // LlmIntentStrategy vẫn giữ để đo riêng độ chính xác của router, nhưng thứ quyết định model
        // cầm được tool nào là dòng này.
        log.info("Nhóm hiệu lực {} cho câu hỏi: {}", groups, turn.getQuestion());

        List<Object> tools =
                new ArrayList<>(toolRegistry.toolsFor(groups, turn.getManager().userId()));

        // Nhóm bị lọc mất vì thiếu quyền. Ghi lại để prompt nói THẲNG là thiếu khả năng nào — lọc
        // im lặng khiến model đi tìm dữ liệu gần giống rồi gắn nhãn của thứ nó không lấy được.
        Set<Group> denied = toolRegistry.deniedGroups(groups, turn.getManager().userId());
        turn.setDeniedGroups(denied);
        if (!denied.isEmpty()) {
            log.info("Chặn vì thiếu quyền: {} (câu hỏi: {})", denied, turn.getQuestion());
        }

        // Tool điền form chỉ được gửi khi người dùng ĐANG mở đúng form đó. Không mở form thì model
        // không nhìn thấy nó, nên vừa không thể đề xuất nhầm, vừa không tốn token mô tả tool cho
        // những lượt chat chẳng liên quan gì tới form.
        //
        // Chạy cả ở lần vào THỨ HAI (sau khi nới công cụ) là một khác biệt so với bản trước:
        // EscapeHatchStage tự gọi toolsFor rồi gán thẳng, nên nó ĐÁNH RƠI tool điền form — người
        // dùng đang mở biểu mẫu mà model xin thêm công cụ thì mất luôn khả năng đề xuất điền.
        Object formTool = toolRegistry.formTool(formRegistry.toolNameFor(turn.getOpenFormId()));
        if (formTool != null) {
            tools.add(formTool);
            log.debug("Mở tool điền form cho form đang mở: {}", turn.getOpenFormId());
        }
        turn.setTools(tools);
        return AgentNode.MODEL;
    }

    /** Nhóm cho lần hỏi đầu: router chọn, HỢP với nhóm mà kế hoạch nêu đích danh. */
    private Set<Group> chooseGroups(AiTurn turn) {
        if (!intentStrategy.isEnabled()) return toolRegistry.readGroups();

        Set<Group> groups = new LinkedHashSet<>(intentStrategy.route(turn.getQuestion()));

        // Kế hoạch đã nêu đích danh tool cho từng vế của câu hỏi — thông tin chắc chắn hơn hẳn việc
        // router đoán nhóm từ câu hỏi thô. HỢP chứ không giao: định tuyến chỉ được phép nới rộng,
        // không bao giờ lấy mất tool của model.
        // Đo được: router bỏ sót INSIGHT ở "Tổng quan KPI đơn vị tôi, kèm ... ai chưa nộp" trong CẢ
        // HAI lần chạy, nên get_analytics không hề được gửi đi.
        Set<Group> fromPlan = ToolRegistry.groupsForTools(plannedTools(turn));
        if (groups.addAll(fromPlan)) {
            log.debug("Kế hoạch nới nhóm thêm {}", fromPlan);
        }
        return groups;
    }

    private List<String> plannedTools(AiTurn turn) {
        List<PlanStep> plan = turn.getPlan();
        if (plan == null) return List.of();
        return plan.stream().filter(PlanStep::hasTool).map(PlanStep::tool).toList();
    }
}
