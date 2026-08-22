package com.kpitracking.tool;

import io.micrometer.context.ThreadLocalAccessor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Đính các tệp người dùng đang GHIM ở ô chat vào biểu mẫu đang mở.
 *
 * <p>Sinh ra vì việc đính phải là một HÀNH ĐỘNG CÓ CHỦ ĐÍCH. Bản trước cho tệp vào thẳng biểu mẫu
 * ngay lúc người dùng bấm nút kẹp giấy, và họ thấy tệp đã nằm trong form trong khi mình chưa bảo gì
 * — trái hẳn nếp mọi ứng dụng chat, nơi cái kẹp giấy chỉ ghim tệp vào tin nhắn sắp gửi.
 *
 * <p>Tool không đụng tới nội dung tệp: tệp không bao giờ rời trình duyệt. Nó chỉ bật một cờ để
 * client chuyển tệp từ chỗ ghim sang chỗ nhận của biểu mẫu.
 *
 * <p>Trạng thái để trong ThreadLocal như {@link EvidenceRequestTool}, và vì cùng lý do phải là HỘP
 * CHỨA chứ không giữ thẳng giá trị: ở lượt streaming, tool chạy trên luồng reactor nên chỉ tham
 * chiếu hộp chứa mới đi sang được. PHẢI xoá cuối mỗi lượt — {@code AiTurnPipeline} lo việc đó.
 */
@Component
@Slf4j
public class AttachFilesTool {

    /** Không có biểu mẫu nào nhận tệp. Viết cho MODEL đọc, không phải cho lập trình viên. */
    private static final String NO_SINK = "{\"error\":\"Người dùng chưa mở biểu mẫu nào có mục đính kèm "
            + "nên chưa đính tệp đi đâu được. Hãy bảo họ mở màn hình Gửi báo cáo KPI trước.\"}";

    /** Có chỗ nhận nhưng người dùng chưa ghim tệp nào. */
    private static final String NO_PINNED = "{\"error\":\"Người dùng chưa ghim tệp nào nên không có gì "
            + "để đính. Hãy bảo họ bấm nút kẹp giấy cạnh ô nhập để chọn tệp trước.\"}";

    private static final ThreadLocal<AtomicReference<Boolean>> ATTACHED =
            ThreadLocal.withInitial(AtomicReference::new);

    @Tool(name = "attach_pinned_files", description =
            "Đính các tệp người dùng ĐANG GHIM ở ô chat vào biểu mẫu đang mở. "
            + "Gọi khi họ bảo đính/gắn/thêm tệp (hoặc tệp đang ghim, tài liệu vừa kẹp) vào biểu mẫu, "
            + "vào mục tài liệu chứng minh, hoặc nói đại ý \"dùng tệp này đi\". "
            + "Ghim và đính là HAI việc khác nhau: người dùng bấm kẹp giấy là mới GHIM thôi, tệp chưa "
            + "vào biểu mẫu; phải gọi tool này thì nó mới vào. "
            + "ĐỪNG tự gọi khi họ chỉ ghim tệp rồi hỏi chuyện khác — chờ họ bảo. "
            + "Bạn KHÔNG đọc được nội dung tệp, chỉ biết tên. "
            + "reason: một câu ngắn nói vì sao đính.")
    public String attachPinnedFiles(AttachFilesRequest request, ToolContext context) {
        // Hai chốt chặn TẤT ĐỊNH. Dặn model thì đo được là không đáng tin bằng chặn, và bịa ra một
        // việc "đã đính" trong khi chẳng có gì đính được là đúng loại hứa suông đã phải đi sửa.
        if (!Boolean.TRUE.equals(context.getContext().get("openFormAcceptsFiles"))) {
            return NO_SINK;
        }
        Object pinned = context.getContext().get("pinnedFileNames");
        if (!(pinned instanceof Collection<?> names) || names.isEmpty()) {
            return NO_PINNED;
        }

        String reason = request != null && request.reason() != null ? request.reason() : "(không nêu lý do)";
        ATTACHED.get().set(Boolean.TRUE);
        log.info("Đính {} tệp đang ghim vào biểu mẫu: {}", names.size(), reason);
        return "{\"status\":\"FILES_ATTACHED\",\"count\":" + names.size() + ",\"message\":\"Đã đính "
                + "các tệp đang ghim vào biểu mẫu. Hãy xác nhận ngắn gọn và nêu tên tệp.\"}";
    }

    public record AttachFilesRequest(String reason) {}

    /** Lượt này model có đính tệp không. */
    public static boolean wasAttached() {
        return Boolean.TRUE.equals(ATTACHED.get().get());
    }

    public static void clear() {
        ATTACHED.remove();
    }

    /** Cho phép {@code TurnStatePropagation} mang hộp chứa này sang luồng reactor. */
    public static final class Accessor implements ThreadLocalAccessor<AtomicReference<Boolean>> {
        public static final String KEY = "kpi.ai.attach-files";
        @Override public Object key() { return KEY; }
        @Override public AtomicReference<Boolean> getValue() { return ATTACHED.get(); }
        @Override public void setValue(AtomicReference<Boolean> value) { ATTACHED.set(value); }
        @Override public void setValue() { ATTACHED.remove(); }
    }
}
