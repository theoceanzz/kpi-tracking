package com.kpitracking.service.ai;

/**
 * Một bước lấy dữ liệu trong kế hoạch của lượt hỏi.
 *
 * @param tool tên tool sẽ dùng, hoặc {@code null} khi công đoạn lập kế hoạch nêu tên không có thật.
 *             KHÔNG đoán bừa sang tool gần giống: bước không rõ tool vẫn được viết ra cho model đọc,
 *             chỉ là không tham gia định tuyến và không bị đối chiếu ở khâu kiểm tra bỏ sót.
 * @param what  việc cần lấy, viết bằng lời — phần model đọc để biết bước này đòi dữ liệu gì
 */
public record PlanStep(String tool, String what) {

    public boolean hasTool() {
        return tool != null && !tool.isBlank();
    }

    /** Dòng hiển thị trong khối kế hoạch gửi cho model. */
    public String describe() {
        return hasTool() ? tool + " — " + what : what;
    }
}
