package com.kpitracking.service.ai.agent;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Chạy đồ thị agent: đi từ đỉnh này sang đỉnh kế tiếp mà chính đỉnh vừa chạy chỉ ra.
 *
 * <p><b>Vì sao cần một đồ thị chứ không phải một chuỗi.</b> Chuỗi {@code AiStage} có thứ tự cố định
 * theo {@code @Order} và không có cạnh nào rẽ. Hai chỗ trông như chu trình thực ra là
 * <b>chạy lại toàn bộ phần chuỗi còn lại</b>: {@code EscapeHatchStage} và
 * {@code PlanCompletionStage} đều gọi {@code next.proceed} thêm một lần. Giá phải trả là định tuyến
 * lại từ đầu, dựng lại prompt, bắn trùng sự kiện tiến độ, và phải xoá cặp hỏi-đáp mà chính lần chạy
 * lại ấy vừa ghi vào bộ nhớ hội thoại. Ở đây quay lui là một CẠNH, nên chỉ đúng phần cần chạy lại
 * mới chạy lại.
 *
 * <p><b>Đồ thị có chu trình thì phải có điều kiện dừng, và ở đây có hai lớp.</b> Lớp thật là mỗi
 * cạnh quay lui chỉ đi được một lần ({@code escapeUsed}, {@code planNudgeUsed}) cộng ngân sách bước
 * của {@code ModelNode}. Lớp thứ hai là trần số lần chuyển đỉnh dưới đây — nó không bảo vệ nghiệp
 * vụ mà bảo vệ khỏi LỖI LẬP TRÌNH: một cặp đỉnh trỏ vòng vào nhau sẽ treo cả luồng Tomcat, và đó
 * là kiểu lỗi mà chuỗi tuyến tính trước đây không thể có.
 */
@Component
@Slf4j
public class AgentGraph {

    /**
     * Trần số lần chuyển đỉnh. Rộng gấp nhiều lần đường đi dài nhất có thật (3 lần hỏi × 10 bước ×
     * 2 đỉnh mỗi bước ≈ 60) vì nó không phải van điều tiết — chạm tới nó nghĩa là đồ thị sai.
     */
    static final int MAX_TRANSITIONS = 200;

    /** Đỉnh vào. PLAN trước ROUTE — xem {@link AgentNode}. */
    static final AgentNode ENTRY = AgentNode.PLAN;

    private final Map<AgentNode, Node> nodes = new EnumMap<>(AgentNode.class);

    public AgentGraph(List<Node> nodes) {
        for (Node node : nodes) {
            Node clash = this.nodes.put(node.id(), node);
            if (clash != null) {
                throw new IllegalStateException("Hai bean cùng phụ trách đỉnh " + node.id() + ": "
                        + clash.getClass().getSimpleName() + " và " + node.getClass().getSimpleName());
            }
        }
        // Thiếu một đỉnh là lỗi cấu hình, và phải nổ lúc khởi động chứ không phải giữa một lượt hỏi
        // của người dùng thật.
        for (AgentNode id : AgentNode.values()) {
            if (!this.nodes.containsKey(id)) {
                throw new IllegalStateException("Đồ thị agent thiếu đỉnh " + id);
            }
        }
        log.info("Đồ thị agent gồm {} đỉnh, vào ở {}", this.nodes.size(), ENTRY);
    }

    /**
     * Chạy đồ thị cho một lượt.
     *
     * @return câu trả lời cho người dùng — luôn khác {@code null} vì {@code FinishNode} tự lo phần
     *         câu trả lời thay thế khi model không sinh được gì
     */
    public String run(AgentState state) {
        AgentNode current = ENTRY;
        for (int hop = 0; hop < MAX_TRANSITIONS; hop++) {
            AgentNode next = nodes.get(current).run(state);
            if (next == null) return state.getAnswer();
            current = next;
        }

        // Không bao giờ nên tới đây. Ép qua đỉnh chốt để người dùng vẫn nhận được một câu trả lời
        // tử tế, và ghi mức error vì đây là lỗi của ta chứ không phải của model.
        log.error("Đồ thị agent vượt {} lần chuyển đỉnh — nghi có cạnh trỏ vòng. question='{}'",
                MAX_TRANSITIONS, state.questionOrNa());
        state.setBudgetExhausted(true);
        nodes.get(AgentNode.FINISH).run(state);
        return state.getAnswer();
    }

    /** Bảng đỉnh đang chạy — dùng cho test và chẩn đoán. */
    public Map<AgentNode, Node> nodes() {
        return Map.copyOf(nodes);
    }
}
