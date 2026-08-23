package com.kpitracking.service.ai.stage;

import com.kpitracking.service.ai.AiTurn;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import com.kpitracking.service.ai.agent.AgentState;
import java.util.ArrayList;
import java.util.List;

/**
 * Test cho công đoạn kiểm duyệt câu trả lời.
 *
 * <p>Đây là cơ chế CHẶN, nên hai phía đều phải chắc: chặn đúng thứ cần chặn, và <b>tuyệt đối không
 * chặn nhầm</b> câu trả lời hợp lệ. Phía thứ hai quan trọng hơn — một cảnh báo bịa đặt báo nhầm sẽ
 * tập cho người dùng bỏ qua cảnh báo thật.
 */
class ValidationStageTest {

    private static final String BLOCKED = "chưa lấy được dữ liệu";

/**
     * Tool "đã chạy" của lượt đang dựng.
     *
     * <p>Thay {@code ToolCallTracker}: bản cũ là kho ThreadLocal dùng chung nên ghi lúc nào cũng
     * được, còn {@code AgentState} gắn vào chính {@code AiTurn} nên phải có turn đã. Danh sách này
     * giữ nguyên được thứ tự viết test cũ — ghi trước, dựng turn sau.
     */
    private final List<String> toolsRan = new ArrayList<>();

    private void ran(String toolName) {
        toolsRan.add(toolName);
    }

    private String run(String answer, boolean enabled, boolean hasMemory) {
        AiTurn turn = new AiTurn("câu hỏi", hasMemory ? "conv-1" : null, null);
        AgentState st = new AgentState(turn);
        turn.setAgentState(st);
        toolsRan.forEach(st::recordSuccess);
        return new ValidationStage(enabled).handle(turn, t -> answer);
    }

    private String runNoMemory(String answer) {
        return run(answer, true, false);
    }

    // ── phải CHẶN ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("có số liệu mà không tool nào chạy -> CHẶN")
    void figuresWithoutAnyToolAreBlocked() {
        assertThat(runNoMemory("Doanh thu quý này là 4,2 tỷ đồng.")).contains(BLOCKED);
    }

    @Test
    @DisplayName("tool LỖI không tính là lấy được dữ liệu -> vẫn CHẶN")
    void failedToolStillCountsAsNoData() {
        // Tool lỗi đi qua toolError(), không qua respond(), nên tracker rỗng.
        assertThat(runNoMemory("Phòng IT có 8 người.")).contains(BLOCKED);
    }

    // ── KHÔNG được chặn ──────────────────────────────────────────────────────

    @Test
    @DisplayName("có gọi tool thì cho qua, dù câu trả lời đầy số")
    void answerWithToolDataPasses() {
        ran("get_people");
        String answer = "Phòng IT có 8 người, tiến độ trung bình 255,48%.";
        assertThat(runNoMemory(answer)).isEqualTo(answer);
    }

    @Test
    @DisplayName("câu từ chối không có số -> cho qua")
    void refusalWithoutFiguresPasses() {
        String answer = "Xin lỗi, tôi không thể cung cấp thông tin cá nhân như số điện thoại.";
        assertThat(runNoMemory(answer)).isEqualTo(answer);
    }

    @Test
    @DisplayName("chỉ có NGÀY THÁNG thì không tính là số liệu -> cho qua")
    void datesAreNotFigures() {
        String answer = "Xin lỗi, tôi chưa có dữ liệu tính đến 14/08/2026 và kỳ 06/2026.";
        assertThat(runNoMemory(answer)).isEqualTo(answer);
    }

    @Test
    @DisplayName("số thứ tự đầu dòng là cách trình bày, không phải số liệu -> cho qua")
    void listMarkersAreNotFigures() {
        String answer = "Bạn muốn xem gì:\n1. Danh sách nhân sự\n2. Danh sách KPI";
        assertThat(runNoMemory(answer)).isEqualTo(answer);
    }

    @Test
    @DisplayName("lượt CÓ bộ nhớ chỉ cảnh báo, KHÔNG chặn — model được dùng dữ liệu lượt trước")
    void memoryTurnIsWarnedNotBlocked() {
        String answer = "Phòng đó có 8 người.";
        assertThat(run(answer, true, true))
                .as("hội thoại nhiều lượt: chặn ở đây là chặn nhầm")
                .isEqualTo(answer);
    }

    @Test
    @DisplayName("tắt công tắc thì không đụng gì")
    void disabledPassesEverythingThrough() {
        String answer = "Doanh thu quý này là 4,2 tỷ đồng.";
        assertThat(run(answer, false, false)).isEqualTo(answer);
    }

    @Test
    @DisplayName("câu trả lời null không làm vỡ stage")
    void nullAnswerIsSafe() {
        AiTurn turn = new AiTurn("hỏi", null, null);
        AgentState st = new AgentState(turn);
        turn.setAgentState(st);
        toolsRan.forEach(st::recordSuccess);
        assertThat(new ValidationStage(true).handle(turn, t -> null)).isNull();
    }

    @Test
    @DisplayName("ghi lại chuỗi tool đã chạy để chẩn đoán")
    void recordsToolTrace() {
        ran("get_people");
        ran("get_kpi");
        AiTurn turn = new AiTurn("hỏi", null, null);
        AgentState st = new AgentState(turn);
        turn.setAgentState(st);
        toolsRan.forEach(st::recordSuccess);

        new ValidationStage(true).handle(turn, t -> "8 người");

        assertThat(turn.getToolCallTrace()).containsExactly("get_people", "get_kpi");
    }
}
