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
import com.kpitracking.service.ai.agent.AgentState;
import java.util.HashMap;

/**
 * Test cho tool đính tệp đang ghim vào biểu mẫu.
 *
 * <p>Trọng tâm là hai chốt chặn. Bịa ra việc "đã đính" khi không có gì để đính, hoặc khi không có
 * chỗ nào để đính, chính là kiểu hứa suông đã phải đi sửa một lần — và dặn model thì đo được là
 * không đáng tin bằng chặn.
 */
class AttachFilesToolTest {

    /**
     * Trạng thái của lượt, đi cùng {@code ToolContext}. Mỗi test một thực thể mới nên không
     * phải dọn gì — đó chính là điều đáng giá so với bản ThreadLocal cũ.
     */
    private AgentState st = AgentState.forToolsOnly();

    /** Ngữ cảnh tool luôn mang theo trạng thái của lượt, giống hệt lúc chạy thật. */
    private ToolContext ctxWith(java.util.Map<String, Object> base) {
        java.util.Map<String, Object> m = new HashMap<>(base);
        m.put(AgentState.CONTEXT_KEY, st);
        return new ToolContext(m);
    }

    private final AttachFilesTool tool = new AttachFilesTool();

    /** Có chỗ nhận tệp VÀ có tệp đang ghim. */
    private ToolContext ready() {
        return ctxWith(Map.of(
                "openFormAcceptsFiles", Boolean.TRUE,
                "pinnedFileNames", List.of("bang-chung.pdf")));
    }

    @BeforeEach
    @AfterEach
    void reset() {
        st = AgentState.forToolsOnly();
    }

    @Test
    @DisplayName("chưa gọi -> chưa có cờ nào")
    void noFlagBeforeCall() {
        assertThat(st.isFilesAttached()).isFalse();
    }

    @Test
    @DisplayName("đủ chỗ nhận và có tệp ghim -> bật cờ để client chuyển tệp")
    void setsFlagWhenReady() {
        String out = tool.attachPinnedFiles(
                new AttachFilesTool.AttachFilesRequest("người dùng bảo đính"), ready());

        assertThat(out).doesNotContain("\"error\"").contains("FILES_ATTACHED");
        assertThat(st.isFilesAttached()).isTrue();
    }

    @Test
    @DisplayName("KHÔNG có biểu mẫu nhận tệp -> từ chối, không bật cờ")
    void refusesWhenNoSink() {
        ToolContext noSink = ctxWith(Map.of("pinnedFileNames", List.of("bang-chung.pdf")));

        assertThat(tool.attachPinnedFiles(new AttachFilesTool.AttachFilesRequest("x"), noSink))
                .contains("\"error\"").contains("Gửi báo cáo KPI");
        assertThat(st.isFilesAttached()).isFalse();
    }

    @Test
    @DisplayName("CHƯA ghim tệp nào -> từ chối bằng câu KHÁC, và bảo bấm nút kẹp giấy")
    void refusesWhenNothingPinned() {
        ToolContext nothingPinned = ctxWith(Map.of("openFormAcceptsFiles", Boolean.TRUE));

        // Phải khác câu "chưa mở biểu mẫu": hai nguyên nhân khác nhau mà cùng một câu thì model
        // hướng dẫn sai, và người dùng đi mở biểu mẫu trong khi việc cần làm là ghim tệp.
        assertThat(tool.attachPinnedFiles(new AttachFilesTool.AttachFilesRequest("x"), nothingPinned))
                .contains("\"error\"").contains("kẹp giấy").doesNotContain("Gửi báo cáo KPI");
        assertThat(st.isFilesAttached()).isFalse();
    }

    @Test
    @DisplayName("danh sách ghim RỖNG cũng là chưa ghim gì")
    void emptyPinnedListIsNothingPinned() {
        ToolContext emptyPinned = ctxWith(Map.of(
                "openFormAcceptsFiles", Boolean.TRUE,
                "pinnedFileNames", List.of()));

        assertThat(tool.attachPinnedFiles(new AttachFilesTool.AttachFilesRequest("x"), emptyPinned))
                .contains("\"error\"");
        assertThat(st.isFilesAttached()).isFalse();
    }

    @Test
    @DisplayName("dọn xong thì cờ không rơi sang lượt sau")
    void clearResetsFlag() {
        tool.attachPinnedFiles(new AttachFilesTool.AttachFilesRequest("x"), ready());
        st = AgentState.forToolsOnly();

        assertThat(st.isFilesAttached()).isFalse();
    }

    @Test
    @DisplayName("có nhãn tiến độ riêng, không rơi về nhãn chung")
    void hasProgressLabel() {
        assertThat(ToolProgress.hasLabel("attach_pinned_files")).isTrue();
    }
}
