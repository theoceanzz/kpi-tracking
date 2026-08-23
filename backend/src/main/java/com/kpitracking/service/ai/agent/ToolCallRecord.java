package com.kpitracking.service.ai.agent;

/**
 * Một lời gọi tool đã xảy ra trong lượt, kèm kết cục của nó.
 *
 * <p>Thay cho {@code ToolCallTracker} — kho ThreadLocal chỉ ghi được TÊN tool và chỉ ghi khi tool
 * chạy THÀNH CÔNG. Ở đây có cả bước thứ mấy và có chạy hay không, nên công đoạn kiểm duyệt phân
 * biệt được "model không thử lấy dữ liệu" với "model có thử nhưng tool hỏng" — hai thứ trước đây
 * trông giống hệt nhau.
 *
 * @param step    vòng lặp thứ mấy, đếm từ 1
 * @param id      id lời gọi do model đặt, để đối chiếu với kết quả trả về
 * @param name    tên tool
 * @param executed tool có thực sự chạy không; {@code false} khi bị {@code ToolPolicy} chặn
 */
public record ToolCallRecord(int step, String id, String name, boolean executed) {
}
