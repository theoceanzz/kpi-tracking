package com.kpitracking.dto.request.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
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
    /**
     * Các ô ĐANG hiện và sửa được trên màn hình.
     *
     * <p>Khác {@code openFormId}, tin client ở đây là AN TOÀN vì nó chỉ THU HẸP: máy chủ lấy
     * giao với bản khai báo của {@code FormRegistry}, nên một client bị sửa cùng lắm tự bó tay
     * mình chứ không bịa thêm được ô nào.
     *
     * <p>Cần nó vì bản khai báo phía máy chủ là TĨNH, còn form thì vẽ ô theo điều kiện chạy:
     * KPI định lượng không có ô Mức định tính, lượt sửa khoá ô Chỉ tiêu, modal xem lại khoá
     * sạch. Thiếu nó thì trợ lý điền được ô người dùng không nhìn thấy.
     *
     * <p>{@code null} = client cũ chưa gửi: giữ nguyên hành vi trước đây (dùng cả danh sách khai).
     */
    private List<String> openFormFields;
    /**
     * Form đang mở có mục nhận tệp không.
     *
     * <p>Không có mục nào thì mời người dùng gửi tệp là hứa suông — họ thả vào cũng chẳng có chỗ
     * nào để đi. Cùng lý do an toàn với {@code openFormFields}: cờ này chỉ THU HẸP.
     */
    private Boolean openFormAcceptsFiles;
    /**
     * Tên tệp người dùng đang GHIM ở ô chat, chưa đính vào đâu.
     *
     * <p>Ghim và đính là hai việc khác nhau: bấm kẹp giấy mới chỉ ghim. Danh sách này cho
     * model biết có gì để đính, và là chốt chặn để nó không bịa ra việc đã đính khi chẳng
     * có tệp nào.
     */
    private List<String> pinnedFileNames;
    /**
     * Tên các tệp minh chứng người dùng vừa kẹp vào ô chat. CHỈ TÊN — nội dung tệp không rời khỏi
     * trình duyệt, nó đi thẳng sang biểu mẫu báo cáo rồi mới tải lên khi người dùng bấm gửi.
     *
     * <p>Có mặt ở đây chỉ để trợ lý biết là có tệp mà nhắc tới; không có thì người dùng kẹp tệp rồi
     * hỏi "minh chứng ở tệp này" và trợ lý hỏi lại "bạn gửi tệp nào?".
     */
    private List<String> attachmentNames;
}
