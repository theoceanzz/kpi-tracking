package com.kpitracking.ai.memory;

import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.ToolExecutionResultMessage;
import dev.langchain4j.data.message.UserMessage;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Test cho bộ nhớ theo lượt — lớp đứng giữa {@code AiServices} (ghi liên tục) và DB (chỉ nhận một
 * cặp hỏi–đáp cuối cùng).
 *
 * <p>Bất biến: <b>không có đường nào từ lớp này chạm tới DB</b>. Mọi thứ AiServices thêm vào nằm
 * ở phần đệm; {@code clear()} chỉ xoá đệm; cửa sổ đã lưu là bất biến.
 */
class TurnChatMemoryTest {

    private final List<dev.langchain4j.data.message.ChatMessage> saved = List.of(
            UserMessage.from("hỏi cũ"), AiMessage.from("đáp cũ"));

    @Test
    @DisplayName("messages() = system + cửa sổ đã lưu + đệm, đúng thứ tự")
    void ordersSystemWindowThenBuffer() {
        TurnChatMemory m = new TurnChatMemory("t1", saved);
        m.add(SystemMessage.from("bạn là trợ lý"));
        m.add(UserMessage.from("hỏi mới"));

        assertThat(m.messages()).containsExactly(
                SystemMessage.from("bạn là trợ lý"), UserMessage.from("hỏi cũ"),
                AiMessage.from("đáp cũ"), UserMessage.from("hỏi mới"));
    }

    @Test
    @DisplayName("SystemMessage gửi lại nhiều lần -> giữ bản MỚI NHẤT, không chồng lên đệm")
    void latestSystemMessageWins() {
        TurnChatMemory m = new TurnChatMemory("t1", List.of());
        m.add(SystemMessage.from("v1"));
        m.add(UserMessage.from("hỏi"));
        m.add(SystemMessage.from("v2"));   // vòng hỏi lại với khối "CÒN THIẾU"

        assertThat(m.messages()).containsExactly(SystemMessage.from("v2"), UserMessage.from("hỏi"));
    }

    @Test
    @DisplayName("clear() chỉ xoá đệm — cửa sổ đã lưu và system giữ nguyên")
    void clearDropsOnlyTheBuffer() {
        TurnChatMemory m = new TurnChatMemory("t1", saved);
        m.add(SystemMessage.from("sys"));
        m.add(UserMessage.from("hỏi"));
        m.add(ToolExecutionResultMessage.from("id", "get_people", "{}"));

        m.clear();

        assertThat(m.messages()).containsExactly(
                SystemMessage.from("sys"), UserMessage.from("hỏi cũ"), AiMessage.from("đáp cũ"));
    }

    @Test
    @DisplayName("cửa sổ truyền vào là bản sao: sửa danh sách gốc không ảnh hưởng")
    void windowIsCopied() {
        List<dev.langchain4j.data.message.ChatMessage> src = new java.util.ArrayList<>(saved);
        TurnChatMemory m = new TurnChatMemory("t1", src);
        src.clear();

        assertThat(m.messages()).hasSize(2);
        assertThat(m.hasHistory()).isTrue();
    }

    @Test
    @DisplayName("id() là khoá đã cho — AiServices tra bộ nhớ theo nó")
    void keepsId() {
        assertThat(new TurnChatMemory("turn-xyz", List.of()).id()).isEqualTo("turn-xyz");
        assertThat(new TurnChatMemory("turn-xyz", List.of()).hasHistory()).isFalse();
    }
}
