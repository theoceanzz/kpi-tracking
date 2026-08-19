package com.kpitracking.service.ai.stage;

import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.PlanStep;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Test cho công đoạn lập kế hoạch.
 *
 * <p>Điều quan trọng nhất cần chứng minh KHÔNG phải là nó lập kế hoạch giỏi — chất lượng kế hoạch
 * là chuyện của model, đo bằng bộ 40 câu hỏi. Ở đây chỉ chứng minh hai điều: <b>nó không bao giờ
 * làm hỏng lượt hỏi</b>, và <b>nó bóc được tên tool</b> mà không bịa ra tool không có thật.
 */
class PlanningStageTest {

    private final AiTurn turn = new AiTurn("Phòng IT có mấy người và KPI gì?", null, null);

    private List<PlanStep> planSteps() {
        return turn.getPlan();
    }

    /** ChatClient giả trả về đúng chuỗi cho trước cho mọi lời gọi. */
    private ChatClient clientReturning(String content) {
        ChatClient c = mock(ChatClient.class, RETURNS_DEEP_STUBS);
        when(c.prompt().user(anyString()).call().content()).thenReturn(content);
        return c;
    }

    private ChatClient clientThrowing() {
        ChatClient c = mock(ChatClient.class, RETURNS_DEEP_STUBS);
        when(c.prompt().user(anyString()).call().content())
                .thenThrow(new RuntimeException("provider trả 500"));
        return c;
    }

    private String run(ChatClient client, boolean enabled) {
        return new PlanningStage(client, enabled).handle(turn, t -> "câu trả lời");
    }

    // ── không bao giờ làm hỏng lượt ──────────────────────────────────────────

    @Test
    @DisplayName("tắt công tắc thì không gọi model và không đặt kế hoạch nào")
    void disabledDoesNothing() {
        ChatClient client = mock(ChatClient.class, RETURNS_DEEP_STUBS);

        assertThat(run(client, false)).isEqualTo("câu trả lời");
        assertThat(turn.getPlan()).as("tắt thì prompt phải giữ nguyên như cũ").isNull();
    }

    @Test
    @DisplayName("chỉ MỘT bước thì bỏ kế hoạch — câu đơn giản, viết ra chỉ tốn token")
    void singleStepPlanIsDropped() {
        run(clientReturning("get_people | Đếm nhân sự Phòng IT"), true);

        assertThat(turn.getPlan()).isNull();
    }

    @Test
    @DisplayName("cắt ở 4 bước, model lan man cũng không phình prompt")
    void capsNumberOfSteps() {
        run(clientReturning("get_people | b1\nget_kpi | b2\nrank | b3\nsearch | b4\n"
                + "get_analytics | b5\ncompare_org_units | b6"), true);

        assertThat(planSteps()).hasSize(4);
    }

    @Test
    @DisplayName("model trả rỗng thì bỏ qua kế hoạch, lượt vẫn chạy")
    void emptyResponseFallsBack() {
        assertThat(run(clientReturning("   "), true)).isEqualTo("câu trả lời");
        assertThat(turn.getPlan()).isNull();
    }

    @Test
    @DisplayName("LỖI khi lập kế hoạch KHÔNG được làm hỏng lượt hỏi")
    void planningFailureNeverBreaksTheTurn() {
        assertThat(run(clientThrowing(), true))
                .as("lập kế hoạch chỉ là phần thêm; hỏng thì phải chạy tiếp như khi tắt")
                .isEqualTo("câu trả lời");
        assertThat(turn.getPlan()).isNull();
    }

    // ── bóc tên tool ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("bóc được TÊN_TOOL | việc cần lấy")
    void parsesToolNameAndDescription() {
        run(clientReturning("get_people | Đếm nhân sự Phòng IT\nget_kpi | Liệt kê KPI"), true);

        assertThat(planSteps()).extracting(PlanStep::tool)
                .containsExactly("get_people", "get_kpi");
        assertThat(planSteps()).extracting(PlanStep::what)
                .containsExactly("Đếm nhân sự Phòng IT", "Liệt kê KPI");
    }

    @Test
    @DisplayName("gọt bỏ dấu đầu dòng và số thứ tự model tự thêm dù đã dặn không")
    void stripsBulletsAndNumbering() {
        run(clientReturning("1. get_people | Đếm nhân sự\n- get_kpi | Liệt kê KPI\n"
                + "* get_analytics | Xem xu hướng"), true);

        assertThat(planSteps()).extracting(PlanStep::tool)
                .containsExactly("get_people", "get_kpi", "get_analytics");
        assertThat(planSteps()).extracting(PlanStep::what)
                .containsExactly("Đếm nhân sự", "Liệt kê KPI", "Xem xu hướng");
    }

    @Test
    @DisplayName("tên tool KHÔNG có thật -> giữ bước nhưng không gán tool, tuyệt đối không đoán bừa")
    void unknownToolNameIsNotGuessed() {
        // Đoán "get_person" thành "get_people" là mở đường cho định tuyến sai một cách âm thầm.
        run(clientReturning("get_person | Đếm nhân sự\nget_kpi | Liệt kê KPI"), true);

        assertThat(planSteps().get(0).tool()).isNull();
        assertThat(planSteps().get(0).what())
                .as("bước vẫn phải giữ để model đọc được việc cần làm")
                .isEqualTo("get_person | Đếm nhân sự");
        assertThat(planSteps().get(1).tool()).isEqualTo("get_kpi");
    }

    @Test
    @DisplayName("model quên dấu | -> vẫn giữ bước, chỉ là không có tool")
    void missingSeparatorStillKeepsStep() {
        run(clientReturning("Đếm nhân sự Phòng IT\nLiệt kê KPI"), true);

        assertThat(planSteps()).extracting(PlanStep::tool).containsOnlyNulls();
        assertThat(planSteps()).extracting(PlanStep::what)
                .containsExactly("Đếm nhân sự Phòng IT", "Liệt kê KPI");
    }

    @Test
    @DisplayName("tên tool viết hoa/thừa khoảng trắng vẫn nhận")
    void toolNameIsCaseAndSpaceInsensitive() {
        run(clientReturning("  GET_PEOPLE  | Đếm nhân sự\nGet_Kpi|Liệt kê KPI"), true);

        assertThat(planSteps()).extracting(PlanStep::tool)
                .containsExactly("get_people", "get_kpi");
    }

    @Test
    @DisplayName("bước rỗng phần mô tả thì bỏ, không đẩy dòng rác vào prompt")
    void blankDescriptionIsDropped() {
        run(clientReturning("get_people |   \nget_kpi | Liệt kê KPI\nget_analytics | Xu hướng"), true);

        assertThat(planSteps()).extracting(PlanStep::tool)
                .containsExactly("get_kpi", "get_analytics");
    }
}
