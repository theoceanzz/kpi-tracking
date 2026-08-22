package com.kpitracking.tool;

import com.kpitracking.service.ai.ToolProgress;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Test cho tool mở vùng thả minh chứng.
 *
 * <p>Điều cần chứng minh không phải là nó "chạy", mà là <b>cờ tới được tầng gọi</b> — vì đó chính
 * là thứ hỏng âm thầm ở các kho ThreadLocal khác: tool ghi xong, không ai đọc được, và người dùng
 * chỉ thấy trợ lý nói suông mà không có vùng thả nào hiện ra.
 */
class EvidenceRequestToolTest {

    private final EvidenceRequestTool tool = new EvidenceRequestTool();

    /** Form đang mở CÓ mục đính kèm. */
    private ToolContext ctx() {
        return new ToolContext(Map.of(
                "openFormId", "submission_form",
                "openFormAcceptsFiles", Boolean.TRUE));
    }

    /** Không form nào nhận tệp — ví dụ đang ở trang trợ lý toàn màn hình. */
    private ToolContext ctxNoSink() {
        return new ToolContext(Map.of("openFormId", "submission_form"));
    }

    @BeforeEach
    @AfterEach
    void reset() {
        EvidenceRequestTool.clear();
    }

    @Test
    @DisplayName("chưa gọi -> chưa có cờ nào")
    void noFlagBeforeCall() {
        assertThat(EvidenceRequestTool.wasRequested()).isFalse();
    }

    @Test
    @DisplayName("gọi tool -> bật cờ để tầng gọi vẽ vùng thả")
    void setsFlag() {
        String out = tool.requestEvidenceUpload(
                new EvidenceRequestTool.RequestEvidenceRequest("người dùng muốn gửi minh chứng"), ctx());

        assertThat(out).doesNotContain("\"error\"");
        assertThat(EvidenceRequestTool.wasRequested()).isTrue();
    }

    @Test
    @DisplayName("gọi với tham số rỗng vẫn bật cờ, không ném NPE")
    void nullRequestStillWorks() {
        // Khác các tool điền form: ở đây không có ô nào để điền, nên lời gọi rỗng vẫn có nghĩa
        // trọn vẹn — chặn nó chỉ tổ đẩy model vào vòng thử lại rồi bỏ cuộc.
        String out = tool.requestEvidenceUpload(null, ctx());

        assertThat(out).doesNotContain("\"error\"");
        assertThat(EvidenceRequestTool.wasRequested()).isTrue();
    }

    @Test
    @DisplayName("dọn xong thì cờ không rơi sang lượt sau")
    void clearResetsFlag() {
        tool.requestEvidenceUpload(new EvidenceRequestTool.RequestEvidenceRequest("x"), ctx());
        EvidenceRequestTool.clear();

        assertThat(EvidenceRequestTool.wasRequested()).isFalse();
    }

    @Test
    @DisplayName("có nhãn tiến độ riêng, không rơi về nhãn chung")
    void hasProgressLabel() {
        // ToolProgressTest bắt thiếu nhãn cho MỌI tool; ghim thêm ở đây để lỗi chỉ thẳng vào tool này.
        assertThat(ToolProgress.hasLabel("request_evidence_upload")).isTrue();
    }

    @Test
    @DisplayName("không form nào nhận tệp -> từ chối, KHÔNG bật cờ vẽ vùng thả")
    void refusesWhenNoFormAcceptsFiles() {
        String out = tool.requestEvidenceUpload(
                new EvidenceRequestTool.RequestEvidenceRequest("x"), ctxNoSink());

        assertThat(out).contains("\"error\"").contains("Gửi báo cáo KPI");
        assertThat(EvidenceRequestTool.wasRequested())
                .as("vẽ một vùng thả không dẫn đi đâu là đúng lỗi hứa suông đã phải đi sửa một lần")
                .isFalse();
    }
}
