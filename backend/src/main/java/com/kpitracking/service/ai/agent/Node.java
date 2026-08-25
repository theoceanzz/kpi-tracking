package com.kpitracking.service.ai.agent;

/**
 * Một đỉnh của đồ thị agent.
 *
 * <p>Node <b>tự quyết định đi đâu tiếp</b> — đó là điểm khác duy nhất nhưng quan trọng so với
 * {@code AiStage}: stage chỉ chọn có gọi phần còn lại của chuỗi hay không, còn thứ tự thì cố định
 * theo {@code @Order}. Thứ tự cố định là lý do cửa thoát hiểm phải chạy lại CẢ phần chuỗi phía sau
 * để quay về khâu chọn công cụ.
 *
 * <p>Trạng thái đi qua {@link AgentState}, không qua tham số: node mới cần thêm dữ liệu thì đọc
 * thêm một trường ở đó chứ không phải sửa chữ ký chung.
 */
public interface Node {

    /** Đỉnh mà lớp này phụ trách. {@code AgentGraph} lập bảng tra bằng giá trị này. */
    AgentNode id();

    /**
     * Chạy đỉnh này.
     *
     * @return đỉnh đi tiếp, hoặc {@code null} để dừng đồ thị (chỉ {@link AgentNode#FINISH} trả null)
     */
    AgentNode run(AgentState state);
}
