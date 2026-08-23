package com.kpitracking.service.ai.form;

import java.util.List;

/**
 * Bản đề xuất điền form mà trợ lý trả về cho client.
 *
 * <p>Đây là ĐỀ XUẤT, không phải lệnh: client hiện bản xem trước và người dùng tự chọn ô nào muốn
 * điền. Không có gì được ghi xuống cơ sở dữ liệu ở bước này.
 *
 * @param formId  form mà bản đề xuất này nhắm tới; client phải bỏ qua nếu người dùng đã đóng
 *                hoặc chuyển sang form khác
 * @param entries từng ô một, kèm lý do để người dùng biết vì sao trợ lý đề xuất như vậy
 */
public record FormPatch(String formId, List<Entry> entries) {

    /**
     * @param field   tên trường trong schema form, client dùng để gọi setValue
     * @param label   nhãn tiếng Việt hiện trong bản xem trước
     * @param value   giá trị sẽ điền — chuỗi, số, boolean, hoặc mảng ID
     * @param display bản hiển thị cho người đọc. Với ô tham chiếu thực thể đây là TÊN
     *                ("Team Backend") chứ không phải UUID, nếu không người dùng không thể
     *                thẩm định được thứ mình sắp chấp nhận
     * @param reason  vì sao trợ lý đề xuất giá trị này
     */
    public record Entry(String field, String label, Object value, String display, String reason) {}

    public boolean isEmpty() {
        return entries == null || entries.isEmpty();
    }
}
