package com.kpitracking.dto.response.ai;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.kpitracking.service.ai.form.FormPatch;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public class AiChatResponse {
    private String text;

    /**
     * Khi trợ lý phải hỏi lại để làm rõ (vd tên đơn vị khớp nhiều mục), đây là các lựa chọn
     * CÓ THẬT lấy từ dữ liệu hệ thống để client hiện thành nút bấm — người dùng chọn thay vì
     * gõ lại tên. Rỗng ở các lượt trả lời bình thường.
     */
    private List<ClarificationOption> options;

    /**
     * Đề xuất điền vào form đang mở, khi người dùng nhờ trợ lý điền hộ. {@code null} ở mọi lượt
     * bình thường.
     *
     * <p>Là ĐỀ XUẤT chứ không phải lệnh: client hiện xem trước từng ô và người dùng tự chọn ô nào
     * muốn nhận. Không có gì được ghi xuống cơ sở dữ liệu ở bước này.
     */
    private FormPatch formPatch;

    /**
     * Câu hỏi gợi ý tiếp theo cho lượt vừa trả lời.
     *
     * <p>Trước đây client phải gọi thêm {@code POST /ai/followups} để lấy phần này — nay nó về cùng
     * câu trả lời, nên một lượt chat là một request. Vắng field ở lượt không sinh gợi ý (chào hỏi,
     * từ chối, hoặc lượt trợ lý hỏi lại).
     */
    private FollowupResponse followups;

    /**
     * Bật khi trợ lý mời người dùng gửi tài liệu minh chứng: client vẽ một vùng thả tệp ngay trong
     * bong bóng trả lời. {@code null} ở mọi lượt bình thường.
     *
     * <p>Kiểu bọc chứ không phải {@code boolean} nguyên thuỷ: lớp gắn {@code @JsonInclude(NON_EMPTY)}
     * nên {@code null} bị lược khỏi JSON, còn {@code false} thì vẫn lọt vào mọi phản hồi.
     */
    private Boolean evidenceRequest;

    /**
     * Bật khi trợ lý vừa đính tệp đang ghim vào biểu mẫu: client thực hiện việc chuyển.
     * {@code null} ở mọi lượt bình thường — xem ghi chú kiểu bọc ở {@code evidenceRequest}.
     */
    private Boolean attachFiles;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ClarificationOption {
        /** Nhãn hiển thị, kèm thông tin phân biệt (cấp / đơn vị cha). */
        private String label;
        /** Nội dung sẽ gửi lại như câu trả lời của người dùng khi bấm chọn. */
        private String value;
    }
}
