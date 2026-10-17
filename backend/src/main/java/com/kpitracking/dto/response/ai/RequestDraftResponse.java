package com.kpitracking.dto.response.ai;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Bản nháp ĐƠN TỪ do K.AI điền hộ (tool {@code draft_request}). Cùng kỷ luật với {@code FormPatch}: là ĐỀ XUẤT, không
 * ghi gì — giao diện hiện thẻ, người dùng bấm "Mở đơn để nộp", xem lại trong hộp nộp đơn rồi tự bấm Nộp.
 *
 * @param formId   mẫu đơn
 * @param formName tên mẫu theo ngôn ngữ của người dùng
 * @param values   giá trị đã chuẩn hoá theo id ô (đúng dạng hộp nộp đơn nhận) — giao diện điền thẳng vào hộp
 * @param entries  từng ô đã điền, kèm chữ để người dùng đọc (tên người / đơn vị thay vì id)
 * @param missing  tên các ô BẮT BUỘC còn trống (người dùng tự điền / đính kèm trong hộp)
 */
public record RequestDraftResponse(UUID formId, String formName, Map<String, Object> values,
                                   List<Entry> entries, List<String> missing) {

    public record Entry(String widgetId, String label, String display) {}
}
