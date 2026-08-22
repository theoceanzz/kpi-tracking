package com.kpitracking.tool;

import com.kpitracking.service.ai.ToolProgress;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Test cho tool đính tệp đang ghim vào biểu mẫu.
 *
 * <p>Trọng tâm là hai chốt chặn. Bịa ra việc "đã đính" khi không có gì để đính, hoặc khi không có
 * chỗ nào để đính, chính là kiểu hứa suông đã phải đi sửa một lần — và dặn model thì đo được là
 * không đáng tin bằng chặn.
 */
class AttachFilesToolTest {

    private final AttachFilesTool tool = new AttachFilesTool();

    /** Có chỗ nhận tệp VÀ có tệp đang ghim. */
    private ToolContext ready() {
        return new ToolContext(Map.of(
                "openFormAcceptsFiles", Boolean.TRUE,
                "pinnedFileNames", List.of("bang-chung.pdf")));
    }

    @BeforeEach
    @AfterEach
    void reset() {
        AttachFilesTool.clear();
    }

    @Test
    @DisplayName("chưa gọi -> chưa có cờ nào")
    void noFlagBeforeCall() {
        assertThat(AttachFilesTool.wasAttached()).isFalse();
    }

    @Test
    @DisplayName("đủ chỗ nhận và có tệp ghim -> bật cờ để client chuyển tệp")
    void setsFlagWhenReady() {
        String out = tool.attachPinnedFiles(
                new AttachFilesTool.AttachFilesRequest("người dùng bảo đính"), ready());

        assertThat(out).doesNotContain("\"error\"").contains("FILES_ATTACHED");
        assertThat(AttachFilesTool.wasAttached()).isTrue();
    }

    @Test
    @DisplayName("KHÔNG có biểu mẫu nhận tệp -> từ chối, không bật cờ")
    void refusesWhenNoSink() {
        ToolContext noSink = new ToolContext(Map.of("pinnedFileNames", List.of("bang-chung.pdf")));

        assertThat(tool.attachPinnedFiles(new AttachFilesTool.AttachFilesRequest("x"), noSink))
                .contains("\"error\"").contains("Gửi báo cáo KPI");
        assertThat(AttachFilesTool.wasAttached()).isFalse();
    }

    @Test
    @DisplayName("CHƯA ghim tệp nào -> từ chối bằng câu KHÁC, và bảo bấm nút kẹp giấy")
    void refusesWhenNothingPinned() {
        ToolContext nothingPinned = new ToolContext(Map.of("openFormAcceptsFiles", Boolean.TRUE));

        // Phải khác câu "chưa mở biểu mẫu": hai nguyên nhân khác nhau mà cùng một câu thì model
        // hướng dẫn sai, và người dùng đi mở biểu mẫu trong khi việc cần làm là ghim tệp.
        assertThat(tool.attachPinnedFiles(new AttachFilesTool.AttachFilesRequest("x"), nothingPinned))
                .contains("\"error\"").contains("kẹp giấy").doesNotContain("Gửi báo cáo KPI");
        assertThat(AttachFilesTool.wasAttached()).isFalse();
    }

    @Test
    @DisplayName("danh sách ghim RỖNG cũng là chưa ghim gì")
    void emptyPinnedListIsNothingPinned() {
        ToolContext emptyPinned = new ToolContext(Map.of(
                "openFormAcceptsFiles", Boolean.TRUE,
                "pinnedFileNames", List.of()));

        assertThat(tool.attachPinnedFiles(new AttachFilesTool.AttachFilesRequest("x"), emptyPinned))
                .contains("\"error\"");
        assertThat(AttachFilesTool.wasAttached()).isFalse();
    }

    @Test
    @DisplayName("dọn xong thì cờ không rơi sang lượt sau")
    void clearResetsFlag() {
        tool.attachPinnedFiles(new AttachFilesTool.AttachFilesRequest("x"), ready());
        AttachFilesTool.clear();

        assertThat(AttachFilesTool.wasAttached()).isFalse();
    }

    @Test
    @DisplayName("có nhãn tiến độ riêng, không rơi về nhãn chung")
    void hasProgressLabel() {
        assertThat(ToolProgress.hasLabel("attach_pinned_files")).isTrue();
    }
}
