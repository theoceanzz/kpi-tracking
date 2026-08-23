package com.kpitracking.service.ai.stage;

import com.kpitracking.dto.response.ai.FollowupResponse;
import com.kpitracking.entity.AiTokenUsage;
import com.kpitracking.service.AiTokenUsageRecorder;
import com.kpitracking.service.FollowupService;
import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.form.FormPatch;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import com.kpitracking.service.ai.agent.AgentState;
import java.util.ArrayList;

/**
 * Test cho công đoạn sinh câu hỏi gợi ý.
 *
 * <p>Điều quan trọng nhất KHÔNG phải là nó gợi ý hay — chất lượng gợi ý là chuyện của model. Ở đây
 * chứng minh ba điều: nó <b>không bao giờ làm hỏng lượt</b>, nó <b>không gọi model khi vô ích</b>,
 * và nó <b>trả lại đúng tính năng đang ghi nhận</b> sau khi mượn để ghi FOLLOWUP.
 */
class FollowupStageTest {

    private final FollowupService service = mock(FollowupService.class);

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

    /** Đề xuất điền form của lượt đang dựng — thay {@code FormPatchStore}. */
    private FormPatch pendingPatch;

    private void patch(FormPatch p) {
        pendingPatch = p;
    }

    @AfterEach
    void tearDown() {
        AiTokenUsageRecorder.clearFeature();
    }

    private AiTurn turn() {
        AiTurn t = new AiTurn("Phòng IT có bao nhiêu người?", "conv-1", null);
        AgentState st = new AgentState(t);
        t.setAgentState(st);
        toolsRan.forEach(st::recordSuccess);
        st.setFormPatch(pendingPatch);
        return t;
    }

    private FollowupResponse pools() {
        return FollowupResponse.builder()
                .technical(List.of("Vì sao tăng?"))
                .management(List.of("Ai chịu trách nhiệm?"))
                .build();
    }

    // ════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("lượt có dữ liệu tool: gắn gợi ý lên turn, câu trả lời giữ nguyên")
    void attachesFollowupsOnAnalysisTurn() {
        ran("get_people");
        when(service.generate(anyString(), anyString())).thenReturn(pools());
        AiTurn t = turn();

        assertThat(new FollowupStage(service, true).handle(t, x -> "câu trả lời"))
                .isEqualTo("câu trả lời");
        assertThat(t.getFollowups()).isNotNull();
        assertThat(t.getFollowups().getTechnical()).containsExactly("Vì sao tăng?");
    }

    @Test
    @DisplayName("KHÔNG tool nào chạy -> không gọi model, khỏi tốn một lượt vô ích")
    void skipsWhenNoToolRan() {
        // Chào hỏi, từ chối, lượt hỏi lại, hoặc lượt bị ValidationStage chặn đều rơi vào đây.
        AiTurn t = turn();

        assertThat(new FollowupStage(service, true).handle(t, x -> "Xin lỗi, tôi không hỗ trợ..."))
                .isEqualTo("Xin lỗi, tôi không hỗ trợ...");
        verify(service, never()).generate(any(), any());
        assertThat(t.getFollowups()).isNull();
    }

    @Test
    @DisplayName("lượt ĐIỀN FORM -> im lặng: người dùng đang kiểm ô để bấm Lưu, không phải hỏi tiếp")
    void skipsWhenTurnProducedAFormPatch() {
        // Đo được thật: lượt điền form vẫn chạy tool tra cứu phụ (resolve tên đơn vị, tên kỳ), nên
        // model sinh gợi ý PHÂN TÍCH lạc đề ngay dưới dòng "Đã điền vào form" — kiểu "Hiệu suất KPI
        // tháng 6 so với tháng 4 giảm bao nhiêu phần trăm?".
        ran("get_kpi");
        ran("suggest_kpi_form");
        patch(new FormPatch("kpi_form",
                List.of(new FormPatch.Entry("weight", "Trọng số (%)", 20, "20", "vì bạn yêu cầu"))));
        AiTurn t = turn();

        assertThat(new FollowupStage(service, true).handle(t, x -> "Đã chuẩn bị đề xuất"))
                .isEqualTo("Đã chuẩn bị đề xuất");
        verify(service, never()).generate(any(), any());
        assertThat(t.getFollowups()).isNull();
    }

    @Test
    @DisplayName("tắt công tắc thì không gọi model và không gắn gì")
    void disabledDoesNothing() {
        ran("get_people");
        AiTurn t = turn();

        assertThat(new FollowupStage(service, false).handle(t, x -> "câu trả lời"))
                .isEqualTo("câu trả lời");
        verify(service, never()).generate(any(), any());
        assertThat(t.getFollowups()).isNull();
    }

    @Test
    @DisplayName("LỖI khi sinh gợi ý KHÔNG được làm hỏng lượt")
    void generationFailureNeverBreaksTheTurn() {
        ran("get_people");
        when(service.generate(anyString(), anyString())).thenThrow(new RuntimeException("provider 500"));
        AiTurn t = turn();

        assertThat(new FollowupStage(service, true).handle(t, x -> "câu trả lời"))
                .as("gợi ý chỉ là phần thêm; hỏng thì lượt vẫn phải trả lời được")
                .isEqualTo("câu trả lời");
        assertThat(t.getFollowups()).isNull();
    }

    @Test
    @DisplayName("gợi ý rỗng thì không gắn — client khỏi phải tự lọc")
    void emptyPoolsAreNotAttached() {
        ran("get_people");
        when(service.generate(anyString(), anyString()))
                .thenReturn(FollowupResponse.builder().technical(List.of()).management(List.of()).build());
        AiTurn t = turn();

        new FollowupStage(service, true).handle(t, x -> "câu trả lời");
        assertThat(t.getFollowups()).isNull();
    }

    @Test
    @DisplayName("tên đơn vị của thẻ Insight thành tiền tố chủ đề — giữ đúng cách client cũ dựng")
    void prefixesTopicWithFocusUnitName() {
        ran("get_people");
        when(service.generate(anyString(), anyString())).thenReturn(pools());
        AiTurn t = turn();
        t.setFocusUnitName("Phòng IT");

        new FollowupStage(service, true).handle(t, x -> "câu trả lời");

        ArgumentCaptor<String> topic = ArgumentCaptor.forClass(String.class);
        verify(service).generate(topic.capture(), anyString());
        assertThat(topic.getValue()).isEqualTo("[Phòng IT] Phòng IT có bao nhiêu người?");
    }

    @Test
    @DisplayName("mượn tính năng FOLLOWUP để ghi token rồi TRẢ LẠI đúng thứ đang ghi nhận")
    void restoresTokenFeatureAfterBorrowing() {
        // Lượt chat đặt CHAT ở controller; nếu công đoạn này không trả lại thì mọi lời gọi model
        // SAU nó trong cùng lượt sẽ bị ghi nhầm là FOLLOWUP.
        ran("get_people");
        AiTokenUsageRecorder.setFeature(AiTokenUsage.AiFeature.CHAT);
        when(service.generate(anyString(), anyString())).thenAnswer(inv -> {
            assertThat(AiTokenUsageRecorder.currentFeature())
                    .as("trong lúc sinh gợi ý phải đang ghi là FOLLOWUP")
                    .isEqualTo(AiTokenUsage.AiFeature.FOLLOWUP);
            return pools();
        });

        new FollowupStage(service, true).handle(turn(), x -> "câu trả lời");

        assertThat(AiTokenUsageRecorder.currentFeature()).isEqualTo(AiTokenUsage.AiFeature.CHAT);
    }

    @Test
    @DisplayName("lỗi giữa chừng vẫn phải trả lại tính năng cũ")
    void restoresTokenFeatureEvenOnFailure() {
        ran("get_people");
        AiTokenUsageRecorder.setFeature(AiTokenUsage.AiFeature.CHAT);
        when(service.generate(anyString(), anyString())).thenThrow(new RuntimeException("hỏng"));

        new FollowupStage(service, true).handle(turn(), x -> "câu trả lời");

        assertThat(AiTokenUsageRecorder.currentFeature()).isEqualTo(AiTokenUsage.AiFeature.CHAT);
    }
}
