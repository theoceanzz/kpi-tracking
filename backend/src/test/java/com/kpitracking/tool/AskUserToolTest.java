package com.kpitracking.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.repository.ConversationMessageRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.ManagerContextResolver.ManagerContext;
import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.TurnListener;
import com.kpitracking.service.ai.agent.AgentState;
import com.kpitracking.service.ai.hitl.PendingQuestion;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.AskUserRequest;
import dev.langchain4j.invocation.InvocationParameters;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tool {@code ask_user} và cây cầu nối hỏi-làm-rõ-trùng-tên sang human-in-the-loop.
 *
 * <p>Điều đáng chốt không phải chữ nghĩa của câu hỏi mà là chỗ ĐẶT nó: câu hỏi phải nằm trong
 * {@code AgentState} thì bước chờ trong đồ thị mới thấy; và lượt KHÔNG có kênh hỏi lại (đường JSON)
 * phải giữ nguyên đường cũ, nếu không mọi lượt qua REST sẽ treo hoặc mất câu hỏi do model tự viết.
 */
class AskUserToolTest {

    private final UUID asker = UUID.randomUUID();
    private OrgUnitStatisticService statistics;
    private ToolSupport support;
    private AskUserTool tool;
    private AiTurn turn;

    @BeforeEach
    void setUp() {
        statistics = mock(OrgUnitStatisticService.class);
        support = new ToolSupport(
                mock(OrgUnitRepository.class),
                mock(UserRoleOrgUnitRepository.class),
                mock(UserRepository.class),
                mock(KpiCriteriaRepository.class),
                mock(ConversationMessageRepository.class),
                statistics,
                mock(FollowupContextStore.class),
                new ObjectMapper());
        support.initToolMapper();
        tool = new AskUserTool(support);

        turn = new AiTurn("Phòng IT có bao nhiêu người?", null, null);
        turn.setManager(new ManagerContext(UUID.randomUUID(), "/cty/it/", UUID.randomUUID(), "head@demo.com", asker));
        turn.setAgentState(new AgentState(turn));
    }

    /** Lượt streaming ĐÃ tra được thứ gì đó: có kênh để hỏi lại, và ask_user được phép chạy. */
    private InvocationParameters streamingContext() {
        turn.setListener(new TurnListener() {});
        turn.getAgentState().recordSuccess("get_people");
        return context();
    }

    private InvocationParameters context() {
        Map<String, Object> ctx = new HashMap<>();
        ctx.put("organizationId", UUID.randomUUID().toString());
        ctx.put("orgUnitId", UUID.randomUUID().toString());
        ctx.put("orgUnitPath", "/cty/it/");
        ctx.put("userId", asker);
        ctx.put(AgentState.CONTEXT_KEY, turn.getAgentState());
        return new InvocationParameters(ctx);
    }

    @Test
    @DisplayName("ask_user -> câu hỏi vào AgentState kèm người hỏi, và model được bảo DỪNG")
    void asksAndTellsModelToStop() {
        String json = tool.askUser(new AskUserRequest("Bạn muốn xem kỳ nào?", List.of(
                new AskUserRequest.Choice(null, "Quý 3/2026", "Kỳ đang mở"),
                new AskUserRequest.Choice("q2", "Quý 2/2026", null)), null), streamingContext());

        PendingQuestion q = turn.getAgentState().getPendingQuestion();
        assertThat(q).isNotNull();
        assertThat(q.question()).isEqualTo("Bạn muốn xem kỳ nào?");
        assertThat(q.userId()).isEqualTo(asker);
        assertThat(q.turnId()).isEqualTo(turn.getTurnId());
        // Không khai value thì lấy chính nhãn — model hay bỏ trống, và nhãn vẫn gọi lại tool được.
        assertThat(q.options()).extracting(PendingQuestion.Option::value).containsExactly("Quý 3/2026", "q2");
        assertThat(q.items().get(0).multiSelect()).isFalse();
        assertThat(json).contains("DỪNG");
    }

    @Test
    @DisplayName("chưa tra gì mà đã hỏi -> lỗi tool, bắt gọi tool trước (chặn hỏi ngược về quyền/phạm vi)")
    void refusesToAskBeforeLookingAnythingUp() {
        turn.setListener(new TurnListener() {});   // có kênh hỏi, nhưng chưa tool nào chạy
        String json = tool.askUser(new AskUserRequest("Bạn có quyền xem đơn vị này không?", List.of(), null), context());

        assertThat(json).contains("error");
        assertThat(turn.getAgentState().getPendingQuestion()).isNull();
    }

    @Test
    @DisplayName("hỏi về quyền / đơn vị của chính người hỏi -> lỗi tool (đường lách né câu từ chối)")
    void refusesToAskAboutTheAskersOwnScope() {
        InvocationParameters ctx = streamingContext();

        assertThat(tool.askUser(new AskUserRequest("Bạn có quyền xem Phòng Truyền Thông không?", List.of(), null), ctx))
                .contains("error");
        // Viết hoa chữ Đ: bắt được chữ này mới chắc phép so hoa-thường có hiểu chữ tiếng Việt.
        assertThat(tool.askUser(new AskUserRequest("Đơn vị của bạn là đơn vị nào?", List.of(), null), ctx))
                .contains("error");
        // Câu hỏi nghe trung tính nhưng LỰA CHỌN mới là chỗ lách.
        assertThat(tool.askUser(new AskUserRequest("Bạn muốn xem đơn vị nào?", List.of(
                new AskUserRequest.Choice(null, "Đơn vị hiện tại (đơn vị của tôi)", null),
                new AskUserRequest.Choice(null, "Đơn vị khác", null)), null), ctx))
                .contains("error");
        assertThat(turn.getAgentState().getPendingQuestion()).isNull();
    }

    @Test
    @DisplayName("quá 5 lựa chọn -> chỉ giữ 5 đầu (thẻ hỏi không phải danh sách để đọc)")
    void capsOptionsAtFive() {
        List<AskUserRequest.Choice> many = List.of(
                new AskUserRequest.Choice(null, "A", null), new AskUserRequest.Choice(null, "B", null),
                new AskUserRequest.Choice(null, "C", null), new AskUserRequest.Choice(null, "D", null),
                new AskUserRequest.Choice(null, "E", null), new AskUserRequest.Choice(null, "F", null));

        tool.askUser(new AskUserRequest("Chọn đi", many, null), streamingContext());

        assertThat(turn.getAgentState().getPendingQuestion().options()).hasSize(5);
    }

    @Test
    @DisplayName("model gửi lựa chọn sai kiểu (chuỗi trần / tên trường lạ) -> vẫn đọc được")
    void toleratesTheTwoShapesModelsGetWrong() throws Exception {
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();

        AskUserRequest fromPlainStrings = mapper.readValue(
                "{\"question\":\"Chọn đơn vị nào?\",\"options\":[\"Team Backend\",\"Team Design\"]}",
                AskUserRequest.class);
        assertThat(fromPlainStrings.options()).extracting(AskUserRequest.Choice::label)
                .containsExactly("Team Backend", "Team Design");

        AskUserRequest fromOddFieldNames = mapper.readValue(
                "{\"question\":\"Chọn đơn vị nào?\",\"options\":[{\"option\":\"Team Backend\",\"why\":\"bỏ qua\"}]}",
                AskUserRequest.class);
        assertThat(fromOddFieldNames.options()).extracting(AskUserRequest.Choice::label)
                .containsExactly("Team Backend");
    }

    @Test
    @DisplayName("hỏi mở, không lựa chọn nào -> được (người dùng tự nhập)")
    void openQuestionIsAllowed() {
        tool.askUser(new AskUserRequest("Bạn muốn đặt mục tiêu là bao nhiêu phần trăm?", null, null), streamingContext());

        PendingQuestion q = turn.getAgentState().getPendingQuestion();
        assertThat(q).isNotNull();
        assertThat(q.options()).isEmpty();
    }

    @Test
    @DisplayName("chọn nhiều + nhiều câu trong một thẻ -> giữ cờ multiSelect, trần 3 câu")
    void multiSelectAndSeveralQuestions() {
        List<AskUserRequest.Question> four = List.of(
                new AskUserRequest.Question("Chọn các team cần so sánh?", List.of(
                        new AskUserRequest.Choice(null, "Team Backend", null),
                        new AskUserRequest.Choice(null, "Team Design", null)), true),
                new AskUserRequest.Question("Kỳ nào?", null, null),
                new AskUserRequest.Question("Chỉ số nào?", null, null),
                new AskUserRequest.Question("Câu thứ tư bị bỏ?", null, null));

        tool.askUser(new AskUserRequest(null, null, null, four), streamingContext());

        PendingQuestion q = turn.getAgentState().getPendingQuestion();
        assertThat(q.items()).hasSize(3);
        assertThat(q.items().get(0).multiSelect()).isTrue();
        assertThat(q.items().get(1).options()).isEmpty();
    }

    @Test
    @DisplayName("tên người dùng nêu tra không ra -> không hỏi 'bạn muốn cái nào', nói thẳng là không có")
    void refusesToAskAroundANameThatDoesNotExist() {
        InvocationParameters ctx = streamingContext();
        turn.getAgentState().setNotFoundName("phòng vận hành");

        String json = tool.askUser(new AskUserRequest("Bạn muốn thống kê đơn vị nào?", List.of(
                new AskUserRequest.Choice(null, "Phòng IT", null),
                new AskUserRequest.Choice(null, "Phòng Truyền Thông", null)), null), ctx);

        assertThat(json).contains("error").contains("không tồn tại");
        assertThat(turn.getAgentState().getPendingQuestion()).isNull();
    }

    @Test
    @DisplayName("tool vừa bị từ chối vì ngoài phạm vi -> không hỏi vòng, nói lại lời từ chối (D15)")
    void refusesToAskAfterAScopeDenial() {
        InvocationParameters ctx = streamingContext();
        turn.getAgentState().setScopeDenied(true);

        String json = tool.askUser(new AskUserRequest("Bạn muốn chốt đợt đánh giá cho đơn vị nào?", List.of(
                new AskUserRequest.Choice(null, "Phòng IT", null),
                new AskUserRequest.Choice(null, "Phòng Truyền Thông", null)), null), ctx);

        assertThat(json).contains("error").contains("ngoài phạm vi");
        assertThat(turn.getAgentState().getPendingQuestion()).isNull();
    }

    @Test
    @DisplayName("đã hỏi và được trả lời trong lượt này -> không hỏi lần hai")
    void asksAtMostOncePerTurn() {
        InvocationParameters ctx = streamingContext();
        turn.setAnsweredQuestion("Bạn muốn xem đơn vị nào?");
        turn.setAnsweredValue("Phòng Công nghệ");

        String json = tool.askUser(new AskUserRequest("Bạn muốn xem đơn vị nào?", List.of(
                new AskUserRequest.Choice(null, "Phòng IT", null),
                new AskUserRequest.Choice(null, "Phòng Truyền Thông", null)), null), ctx);

        assertThat(json).contains("error").contains("Phòng Công nghệ");
        assertThat(turn.getAgentState().getPendingQuestion()).isNull();
    }

    @Test
    @DisplayName("thiếu câu hỏi -> lỗi tool, không đặt gì vào trạng thái")
    void blankQuestionIsAnError() {
        String json = tool.askUser(new AskUserRequest("  ", List.of(), null), streamingContext());

        assertThat(json).contains("error");
        assertThat(turn.getAgentState().getPendingQuestion()).isNull();
    }

    @Test
    @DisplayName("đã có câu hỏi kèm lựa chọn của tool khác -> KHÔNG ghi đè bằng câu hỏi trống")
    void neverOverwritesAnExistingQuestion() {
        InvocationParameters ctx = streamingContext();
        tool.askUser(new AskUserRequest("Bạn muốn xem đơn vị nào?", List.of(
                new AskUserRequest.Choice("Team Backend", "Team Backend", null),
                new AskUserRequest.Choice("Team Design", "Team Design", null)), null), ctx);

        String json = tool.askUser(new AskUserRequest("Cho biết tên đầy đủ giúp mình?", List.of(), null), ctx);

        PendingQuestion q = turn.getAgentState().getPendingQuestion();
        assertThat(q.question()).isEqualTo("Bạn muốn xem đơn vị nào?");
        assertThat(q.options()).hasSize(2);
        assertThat(json).contains("DỪNG");
    }

    @Test
    @DisplayName("tên đơn vị trùng ở lượt streaming -> hỏi thẳng giữa lượt, message bảo model DỪNG")
    void unitClarificationAsksInTheMiddleOfTheTurn() {
        InvocationParameters ctx = streamingContext();
        when(statistics.searchOrgUnits(support.getOrgId(ctx), "Phòng IT", 10)).thenReturn(List.of(
                Map.of("id", UUID.randomUUID().toString(), "name", "Phòng IT", "parentName", "Công ty A"),
                Map.of("id", UUID.randomUUID().toString(), "name", "Phòng IT", "parentName", "Khối CNTT")));

        ToolSupport.UnitRef ref = support.resolveUnit(null, "Phòng IT", ctx);

        assertThat(ref.id()).isNull();
        PendingQuestion q = turn.getAgentState().getPendingQuestion();
        assertThat(q).isNotNull();
        assertThat(q.options()).extracting(PendingQuestion.Option::value).containsExactly("Phòng IT", "Phòng IT");
        assertThat(q.options()).extracting(PendingQuestion.Option::label)
                .anyMatch(l -> l.contains("Công ty A")).anyMatch(l -> l.contains("Khối CNTT"));
        assertThat(String.valueOf(ref.clarification().get("message"))).contains("DỪNG");
    }

    @Test
    @DisplayName("cùng tình huống trên đường JSON (không hỏi lại được) -> giữ nguyên đường cũ: model tự viết câu hỏi")
    void jsonPathKeepsTheOldClarification() {
        InvocationParameters ctx = context();  // listener NOOP
        when(statistics.searchOrgUnits(support.getOrgId(ctx), "Phòng IT", 10)).thenReturn(List.of(
                Map.of("id", UUID.randomUUID().toString(), "name", "Phòng IT", "parentName", "Công ty A"),
                Map.of("id", UUID.randomUUID().toString(), "name", "Phòng IT", "parentName", "Khối CNTT")));

        ToolSupport.UnitRef ref = support.resolveUnit(null, "Phòng IT", ctx);

        assertThat(turn.getAgentState().getPendingQuestion()).isNull();
        assertThat(String.valueOf(ref.clarification().get("message"))).contains("Hãy hỏi người dùng");
    }

    @Test
    @DisplayName("không tìm thấy đơn vị nào -> KHÔNG hỏi (hỏi 'bạn muốn cái nào' giữa danh sách rỗng là vô nghĩa)")
    void emptyPoolNeverAsks() {
        InvocationParameters ctx = streamingContext();
        when(statistics.searchOrgUnits(support.getOrgId(ctx), "Phòng XYZ", 10)).thenReturn(List.of());

        ToolSupport.UnitRef ref = support.resolveUnit(null, "Phòng XYZ", ctx);

        assertThat(turn.getAgentState().getPendingQuestion()).isNull();
        // Không tồn tại thì nói thẳng, không bảo model đi hỏi lại người dùng.
        assertThat(String.valueOf(ref.clarification().get("message")))
                .contains("không tồn tại").contains("KHÔNG hỏi lại").doesNotContain("Hãy hỏi người dùng");
    }
}
