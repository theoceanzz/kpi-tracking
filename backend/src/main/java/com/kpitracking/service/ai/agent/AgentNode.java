package com.kpitracking.service.ai.agent;

/**
 * Các đỉnh của đồ thị agent.
 *
 * <pre>
 *   PLAN ──▶ ROUTE ──▶ MODEL ──▶ ACT ──┐
 *              ▲         │   ▲         │
 *              │         │   └─────────┘
 *              │         ▼
 *              │      OBSERVE ──▶ FINISH
 *              └─────────┘
 * </pre>
 *
 * <p><b>Vì sao PLAN đứng TRƯỚC ROUTE.</b> Kế hoạch nêu đích danh tool cho từng vế của câu hỏi, và
 * {@code RouteNode} HỢP các nhóm đó vào nhóm router tự chọn. Đảo lại thì phần hợp ấy mất, và đó là
 * thứ đã đo được: router bỏ sót nhóm INSIGHT ở câu "Tổng quan KPI đơn vị tôi, kèm ... ai chưa nộp"
 * trong cả hai lần chạy, nên {@code get_analytics} không hề được gửi đi.
 *
 * <p><b>Vì sao ba đỉnh MODEL/ACT/OBSERVE tách rời.</b> Vòng {@code MODEL → ACT → MODEL} là vòng lặp
 * agent (model gọi tool rồi đọc kết quả). Còn OBSERVE là chỗ ra quyết định SAU khi model đã trả
 * lời — nó thay cho hai công đoạn từng phải chạy lại cả phần chuỗi phía sau để làm cùng việc đó.
 */
public enum AgentNode {

    /** Chia câu hỏi thành các bước con. Thay {@code PlanningStage}. */
    PLAN,

    /** Chọn nhóm tool rồi lọc theo quyền. Thay {@code IntentStage} + {@code ToolSelectionStage}. */
    ROUTE,

    /** Một lời gọi model. */
    MODEL,

    /** Chạy các tool model vừa yêu cầu. */
    ACT,

    /**
     * Model đã trả lời — quyết định hỏi lại hay dừng.
     *
     * <p>Thay {@code EscapeHatchStage} (cạnh về ROUTE) và {@code PlanCompletionStage} (cạnh về
     * MODEL). Bản trước hai việc này phải gọi {@code next.proceed} thêm một lần, tức chạy lại cả
     * phần chuỗi phía sau: định tuyến lại từ đầu, dựng lại prompt, bắn trùng sự kiện tiến độ.
     */
    OBSERVE,

    /** Lọc câu trả lời, ghi bộ nhớ hội thoại, và dừng. */
    FINISH
}
