package com.kpitracking.service.ai.stage;

import com.kpitracking.service.ai.AiStage;
import com.kpitracking.service.ai.AiStageChain;
import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.agent.AgentGraph;
import com.kpitracking.service.ai.agent.AgentState;
import lombok.RequiredArgsConstructor;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Điểm CUỐI của chuỗi: chạy đồ thị agent.
 *
 * <p>Là stage duy nhất không gọi {@code next} — mọi stage đứng trước đều bọc quanh lời gọi này.
 *
 * <p><b>Mỏng có chủ đích.</b> Năm công đoạn từng nằm sau nó ({@code PlanningStage},
 * {@code IntentStage}, {@code ToolSelectionStage}, {@code EscapeHatchStage},
 * {@code PlanCompletionStage}) và cả {@code ModelCallStage} nay là các ĐỈNH của
 * {@link AgentGraph}. Ranh giới ở đây rõ hẳn: chuỗi lo những gì bọc quanh CẢ lượt (chặn tần suất,
 * hạn mức, quyền, kiểm duyệt câu trả lời), còn đồ thị lo việc bên trong một lượt — chọn công cụ,
 * gọi model, chạy tool, quyết định hỏi lại.
 *
 * <p><b>Không khai nhãn.</b> Các đỉnh tự báo tiến độ của chúng ({@code PlanNode},
 * {@code RouteNode}, {@code ModelNode}), nên khai thêm nhãn ở đây chỉ chèn một dòng vô nghĩa vào
 * trước chúng.
 */
@Component
@Order(700)
@RequiredArgsConstructor
public class AgentStage implements AiStage {

    private final AgentGraph graph;

    @Override
    public String handle(AiTurn turn, AiStageChain next) {
        // TurnSetupStage đã tạo và gắn vào cả turn lẫn toolCtx. Nhánh dự phòng chỉ dành cho test
        // dựng AiTurn trần — nhưng vẫn phải GẮN VÀO TURN, nếu không khối finally của pipeline đọc
        // turn.getAgentState() ra null và bản đề xuất điền form mất trắng.
        AgentState state = turn.getAgentState();
        if (state == null) {
            state = new AgentState(turn);
            turn.setAgentState(state);
        }
        return graph.run(state);
    }

    @Override
    public int getOrder() { return 700; }
}
