package com.kpitracking.service.ai.action;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Một hành động GHI đã được giải nghĩa xong và đang chờ người dùng xác nhận.
 *
 * <p><b>Đây là chỗ vòng lặp agent dừng lại.</b> Tool đọc thì cứ chạy; tool GHI thì không — nó giải
 * tên thành id, kiểm quyền, dựng bản xem trước, rồi dừng. Không byte nào xuống cơ sở dữ liệu cho
 * tới khi người dùng bấm xác nhận, và lúc đó {@code PendingActionExecutor} mới chạy.
 *
 * <p><b>Vì sao không để trợ lý ghi thẳng.</b> Cùng lý do {@code FormPatch} là ĐỀ XUẤT chứ không
 * phải lệnh: model hiểu nhầm một chữ trong câu hỏi là chuyện thường, mà "duyệt 7 bài nộp" thì không
 * có nút hoàn tác. Khác với form patch ở chỗ sau khi xác nhận, việc thực thi nằm ở BACKEND — vì
 * mấy việc này không có form nào trên màn hình để mà điền.
 *
 * <p><b>Danh sách {@link Item} là phần quan trọng nhất với người dùng.</b> Nó phải nêu TÊN chứ
 * không phải UUID: người ta không thẩm định được thứ mình sắp duyệt nếu chỉ thấy một dãy hex. Cùng
 * bài học với {@code FormPatch.Entry.display}.
 *
 * @param id        khoá dùng để xác nhận. Client gửi lại đúng chuỗi này; đoán được nó cũng vô ích
 *                  vì kho còn kiểm người xác nhận có phải người đã hỏi không
 * @param kind      loại việc, quyết định {@code PendingActionExecutor} gọi dịch vụ nào
 * @param title     một dòng tóm tắt cho người đọc, vd "Duyệt 7 bài nộp của Team Backend"
 * @param decision  duyệt hay từ chối; {@code null} với loại việc không có hai chiều (nhắc nhở)
 * @param note      ghi chú/lý do sẽ lưu kèm. Bắt buộc với {@code REJECT} ở những loại đòi lý do
 * @param items     từng đối tượng sẽ bị tác động, đã có tên đọc được
 * @param createdAt để kho tự dọn theo tuổi
 */
public record PendingAction(
        String id,
        Kind kind,
        String title,
        Decision decision,
        String note,
        List<Item> items,
        Instant createdAt) {

    /**
     * Một đối tượng sẽ bị tác động.
     *
     * @param id        khoá chính của đối tượng (bản nộp / chỉ tiêu / yêu cầu điều chỉnh / chỉ tiêu
     *                  cần nhắc)
     * @param relatedId khoá phụ, CHỈ dùng cho việc nhắc nhở (id người nhận). Gộp vào đây thay vì
     *                  đẻ thêm một kiểu riêng cho mỗi loại việc — bốn loại chỉ khác nhau đúng chỗ này
     * @param label     tên người dùng đọc được, vd "Nguyễn Văn Staff — Số task hoàn thành"
     * @param detail    thông tin phụ giúp thẩm định, vd "kỳ Tháng 6/2026, đạt 12/10"
     */
    public record Item(UUID id, UUID relatedId, String label, String detail) {}

    public enum Kind {
        /** Duyệt / từ chối bản nộp KPI. */
        SUBMISSION_REVIEW,
        /** Duyệt / từ chối chỉ tiêu KPI. */
        KPI_CRITERIA_REVIEW,
        /** Duyệt / từ chối yêu cầu điều chỉnh KPI. */
        KPI_ADJUSTMENT_REVIEW,
        /** Nhắc người chưa nộp. Không có chiều từ chối. */
        SEND_REMINDER
    }

    public enum Decision { APPROVE, REJECT }

    public boolean isEmpty() {
        return items == null || items.isEmpty();
    }

    public int count() {
        return items == null ? 0 : items.size();
    }
}
