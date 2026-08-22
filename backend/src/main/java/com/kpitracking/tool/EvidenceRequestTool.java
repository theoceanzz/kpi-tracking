package com.kpitracking.tool;

import io.micrometer.context.ThreadLocalAccessor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicReference;

/**
 * Mở một vùng thả tệp ngay trong khung chat để người dùng gửi minh chứng.
 *
 * <p>Sinh ra vì trợ lý TỪ CHỐI câu "tôi muốn gửi tài liệu chứng minh": mục SCOPE của prompt liệt kê
 * toàn thực thể nghiệp vụ (KPI, đánh giá, bài nộp, kỳ…) và không nhắc tài liệu bao giờ, nên mọi câu
 * mang chữ "tài liệu" rơi thẳng vào nhánh từ chối. Nới câu chữ SCOPE là điều kiện cần; có tool này
 * mới là điều kiện đủ, vì nó cho model một việc CỤ THỂ để làm thay vì chỉ được phép nói suông.
 *
 * <p>Tool không nhận tệp và không đụng tới kho lưu trữ — nội dung tệp không bao giờ rời trình duyệt.
 * Nó chỉ bật một cờ để client vẽ vùng thả; tệp thả vào đi theo đúng đường đã có (kẹp vào ô nhập →
 * gửi kèm tên ở lượt sau → sang biểu mẫu báo cáo).
 *
 * <p>Trạng thái để trong ThreadLocal như {@link EscapeHatchTool}, và vì cùng lý do phải là HỘP CHỨA
 * chứ không giữ thẳng giá trị: ở lượt streaming, tool chạy trên luồng reactor nên chỉ tham chiếu
 * hộp chứa mới đi sang được. PHẢI xoá ở cuối mỗi lượt — {@code AiTurnPipeline} lo việc đó.
 */
@Component
@Slf4j
public class EvidenceRequestTool {

    /** Trả về khi không form nào đang mở nhận tệp. Viết cho MODEL đọc, không phải cho lập trình viên. */
    private static final String NO_SINK = "{\"error\":\"Người dùng chưa mở biểu mẫu nào có mục đính kèm "
            + "nên chưa mở được vùng thả tệp. Hãy bảo họ mở màn hình Gửi báo cáo KPI trước rồi kẹp tệp.\"}";

    private static final ThreadLocal<AtomicReference<Boolean>> REQUESTED =
            ThreadLocal.withInitial(AtomicReference::new);

    @Tool(name = "request_evidence_upload", description =
            "Mở một vùng thả tệp ngay trong khung chat để người dùng gửi TÀI LIỆU MINH CHỨNG cho báo "
            + "cáo KPI. Gọi khi họ nói muốn gửi/đính kèm/tải lên minh chứng, tài liệu chứng minh, "
            + "bằng chứng, hoặc hỏi gửi tệp bằng cách nào. "
            + "Đây là việc HỢP LỆ trong phạm vi hỗ trợ — đừng từ chối. "
            + "Sau khi gọi, hãy bảo họ kéo thả tệp vào vùng vừa hiện (hoặc bấm nút kẹp giấy cạnh ô "
            + "nhập), và nêu rõ chỉ nhận ảnh, PDF, Word, Excel, tối đa 5 tệp và 10MB mỗi tệp. "
            + "Bạn KHÔNG đọc được nội dung tệp — tệp chỉ đi kèm báo cáo làm minh chứng. "
            + "Vùng thả CHỈ hiện khi bạn gọi tool này — mô tả nó bằng lời mà không gọi tool là "
            + "hứa suông, người dùng nhìn xuống không thấy gì. "
            + "Một câu vừa xin điền ô vừa xin chỗ gửi minh chứng (vd \"điền trị số 18 và cho tôi "
            + "chỗ đính kèm\") → gọi CẢ HAI tool trong cùng lượt: tool điền form VÀ tool này. "
            + "CHỈ gọi được khi người dùng đang mở biểu mẫu có mục đính kèm; không có thì tool báo lỗi "
            + "và bạn hãy bảo họ mở màn hình Gửi báo cáo KPI trước. "
            + "reason: một câu ngắn nói vì sao mở vùng thả.")
    public String requestEvidenceUpload(RequestEvidenceRequest request, ToolContext context) {
        // Chặn TẤT ĐỊNH thay vì chỉ dặn trong mô tả tool. Vẽ một vùng thả không dẫn đi đâu chính là
        // lỗi hứa suông vừa phải đi sửa, mà dặn model thì đo được là không đáng tin bằng chặn.
        if (!Boolean.TRUE.equals(context.getContext().get("openFormAcceptsFiles"))) {
            return NO_SINK;
        }
        String reason = request != null && request.reason() != null ? request.reason() : "(không nêu lý do)";
        REQUESTED.get().set(Boolean.TRUE);
        log.info("Mở vùng thả minh chứng: {}", reason);
        return "{\"status\":\"DROPZONE_SHOWN\",\"message\":\"Đã hiện vùng thả tệp trong khung chat. "
                + "Hãy mời người dùng kéo thả tài liệu minh chứng vào đó.\"}";
    }

    public record RequestEvidenceRequest(String reason) {}

    /** Lượt này model có xin mở vùng thả không. */
    public static boolean wasRequested() {
        return Boolean.TRUE.equals(REQUESTED.get().get());
    }

    public static void clear() {
        REQUESTED.remove();
    }

    /** Cho phép {@code TurnStatePropagation} mang hộp chứa này sang luồng reactor. */
    public static final class Accessor implements ThreadLocalAccessor<AtomicReference<Boolean>> {
        public static final String KEY = "kpi.ai.evidence-request";
        @Override public Object key() { return KEY; }
        @Override public AtomicReference<Boolean> getValue() { return REQUESTED.get(); }
        @Override public void setValue(AtomicReference<Boolean> value) { REQUESTED.set(value); }
        @Override public void setValue() { REQUESTED.remove(); }
    }
}
