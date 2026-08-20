package com.kpitracking.dto.request.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiChatRequest {
    private String message;
    private String conversationId;
    /** Đơn vị đang xét (vd khi bấm thẻ Insight): đặt làm "đơn vị hiện tại" của lượt để tool nhắm đúng. */
    private String focusUnitId;
    /**
     * Form đang mở trên màn hình, nếu có (vd {@code kpi_form}). Chỉ là ĐỊNH DANH — form đó gồm ô
     * nào, ô nào trợ lý được điền thì do {@code FormRegistry} phía máy chủ quyết định, không phải
     * do client khai. Tin client khai thì một client bị sửa có thể bịa ra ô nhạy cảm rồi nhờ điền hộ.
     */
    private String openFormId;
    /** Giá trị các ô đang có, để trợ lý không đề xuất lại thứ người dùng đã tự điền. */
    private Map<String, Object> openFormValues;
}
