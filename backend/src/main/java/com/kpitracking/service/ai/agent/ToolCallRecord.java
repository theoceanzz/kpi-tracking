package com.kpitracking.service.ai.agent;

/**
 * Một lời gọi tool đã xảy ra trong lượt, kèm kết cục của nó.
 *
 * <p>Thay cho {@code ToolCallTracker} — kho ThreadLocal chỉ ghi được TÊN tool và chỉ ghi khi tool
 * chạy THÀNH CÔNG. Ở đây ghi ngay lúc model YÊU CẦU, kèm bước thứ mấy.
 *
 * <p>Đối chiếu với {@code AgentState.getSucceeded()} (chỉ gồm tool CHẠY XONG) thì phân biệt được
 * "model không thử lấy dữ liệu" với "model có thử nhưng tool hỏng" — hai thứ trước đây trông giống
 * hệt nhau. Chính hai danh sách tách rời làm được việc đó, không cần cờ trên từng bản ghi.
 *
 * @param step vòng lặp thứ mấy, đếm từ 1
 * @param id   id lời gọi do model đặt, để đối chiếu với kết quả trả về
 * @param name tên tool
 */
public record ToolCallRecord(int step, String id, String name) {
}
