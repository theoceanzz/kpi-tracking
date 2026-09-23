package com.kpitracking.ai.workflow;

import com.kpitracking.ai.agent.PlanParser;
import com.kpitracking.ai.agent.PlannerAgent;
import com.kpitracking.ai.agent.ChartAgent;
import com.kpitracking.ai.agent.RouterAgent;
import com.kpitracking.ai.memory.ConversationMemoryStore;
import com.kpitracking.ai.memory.TurnChatMemory;
import com.kpitracking.ai.memory.TurnRegistry;
import com.kpitracking.advisor.ResponseSanitizingAdvisor;
import com.kpitracking.entity.AiTokenUsage;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.service.AiTokenUsageRecorder;
import com.kpitracking.service.FollowupService;
import com.kpitracking.service.ManagerContextResolver.ManagerContext;
import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.PlanStep;
import com.kpitracking.service.ai.ToolProgress;
import com.kpitracking.service.ai.agent.AgentState;
import com.kpitracking.service.ai.hitl.PendingQuestionStore;
import com.kpitracking.service.ai.hitl.PendingQuestion;
import com.kpitracking.service.ai.hitl.TextQuestionDetector;
import com.kpitracking.service.ai.chart.ChartCandidateDetector;
import com.kpitracking.service.ai.chart.ChartSpecValidator;
import com.kpitracking.dto.response.ai.FollowupResponse;
import com.kpitracking.dto.response.ai.ChartSpec;
import com.kpitracking.tool.FollowupContextStore;
import com.kpitracking.tool.ToolRegistry;
import com.kpitracking.tool.ToolRegistry.Group;
import dev.langchain4j.agentic.scope.AgenticScope;
import dev.langchain4j.invocation.InvocationParameters;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Các bước của workflow trợ lý — mỗi bước là một {@code agentAction} trong đồ thị agentic.
 *
 * <p>Đây là phần "code thuần" giữa các agent LLM: nạp ngữ cảnh, bóc kết quả router/planner, gọi
 * agent chính (có streaming), quyết định có hỏi lại không, kết thúc lượt. Mọi quy tắc trong đây
 * chuyển NGUYÊN từ các node/stage của đồ thị cũ, vì mỗi quy tắc là một lỗi đã đo được rồi mới vá:
 * xem ghi chú tại chỗ.
 *
 * <p>Trạng thái lượt đi trong {@link AgenticScope} dưới một khoá chính {@value #TURN} — chính đối
 * tượng {@link AiTurn}. Không rải từng trường ra scope: các bước đọc/ghi qua getter/setter có kiểu,
 * và test dựng được {@code AiTurn} mà không cần dựng scope. Chỉ ba thứ mô-đun agentic cần để điền
 * tham số cho {@code AssistantAgent} là nằm ngoài: state {@value #QUESTION}, state {@value #ANSWER}
 * (đầu ra của agent) và execution context {@code InvocationParameters}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TurnSteps {

    /** Khoá của {@link AiTurn} trong scope. */
    public static final String TURN = "turn";
    /** State mang câu hỏi — {@code @V} của {@code AssistantAgent}. */
    public static final String QUESTION = "question";
    /** State nhận câu trả lời của {@code AssistantAgent} ({@code outputKey}). */
    public static final String ANSWER = "answer";

    private static final Set<String> TOOL_NAMES = ToolRegistry.allToolNames();

    private final OrgUnitRepository orgUnitRepository;
    private final FollowupContextStore followupContextStore;
    private final ConversationMemoryStore memoryStore;
    private final TurnRegistry turns;
    private final ToolRegistry toolRegistry;
    private final RouterAgent routerAgent;
    private final PlannerAgent plannerAgent;
    private final FollowupService followupService;
    private final AnswerValidator validator;
    private final ChartAgent chartAgent;
    private final ChartCandidateDetector chartDetector;
    private final ChartSpecValidator chartValidator;
    private final PendingQuestionStore questions;

    @Value("${app.ai.tool-routing.enabled:true}") boolean routingEnabled;
    @Value("${app.ai.planning.enabled:true}") boolean planningEnabled;
    @Value("${app.ai.planning.enforce:true}") boolean planEnforce;
    @Value("${app.ai.followups.enabled:true}") boolean followupsEnabled;
    @Value("${app.ai.charts.enabled:true}") boolean chartsEnabled;
    @Value("${app.ai.hitl.wait-seconds:180}") int hitlWaitSeconds;

    public static AiTurn turnOf(AgenticScope scope) {
        Object t = scope.readState(TURN);
        if (!(t instanceof AiTurn turn)) throw new IllegalStateException("Scope không có AiTurn");
        return turn;
    }

    // ── ① ngữ cảnh ──────────────────────────────────────────────────────────

    /**
     * {@code TurnSetupStage} cũ: đơn vị hiệu lực, ngữ cảnh tool, bộ nhớ, ngày giờ.
     *
     * <p>Thêm phần "nối" với mô-đun agentic: {@code turnId} lấy từ {@code scope.memoryId()} (mỗi lượt
     * một scope, mỗi scope một id ngẫu nhiên) để {@code @MemoryId} của agent chính tra đúng lượt
     * trong {@link TurnRegistry}; câu hỏi ghi vào state; ngữ cảnh tool ghi làm execution context để
     * mô-đun điền vào tham số {@code InvocationParameters}.
     */
    public void context(AgenticScope scope) {
        AiTurn turn = turnOf(scope);
        turn.setTurnId(String.valueOf(scope.memoryId()));
        scope.writeState(QUESTION, turn.getQuestion());
        ManagerContext ctx = turn.getManager();
        // Chép kết quả tool của lượt trước TRƯỚC khi startTurn xoá: câu nối tiếp "cho tôi biểu đồ tròn
        // đi" không gọi tool nào, số liệu để vẽ nằm ở đây. (AgentState chưa có ở chỗ này — gắn vào sau.)
        List<AgentState.ToolPayload> prior = List.of();
        if (turn.isHasMemory()) {
            prior = followupContextStore.get(turn.getConversationId()).stream()
                    .map(r -> new AgentState.ToolPayload(r.getToolName(), r.getJson()))
                    .toList();
            followupContextStore.startTurn(turn.getConversationId());
        }
        log.info("Xử lý lượt hỏi cho orgUnitId={}, conversationId={}",
                ctx.orgUnitId(), turn.isHasMemory() ? turn.getConversationId() : "không");

        turn.setEffectiveUnitId(resolveEffectiveUnit(turn, ctx));
        if (!turn.isStaff()) turn.setScopeUnits(scopeUnits(ctx));

        Map<String, Object> toolCtx = new HashMap<>();
        toolCtx.put("orgUnitId", turn.getEffectiveUnitId());
        toolCtx.put("orgUnitPath", ctx.orgUnitPath());
        toolCtx.put("organizationId", ctx.orgId());
        toolCtx.put("userEmail", ctx.email());
        toolCtx.put("userId", ctx.userId());
        toolCtx.put(ToolProgress.CONTEXT_KEY, turn.getListener());
        if (turn.isHasMemory()) toolCtx.put("conversationId", turn.getConversationId());
        if (turn.getOpenFormId() != null && !turn.getOpenFormId().isBlank()) {
            toolCtx.put("openFormId", turn.getOpenFormId());
            toolCtx.put("openFormValues", turn.getOpenFormValues() == null ? Map.of() : turn.getOpenFormValues());
            if (turn.getOpenFormFields() != null) toolCtx.put("openFormFields", turn.getOpenFormFields());
            toolCtx.put("openFormAcceptsFiles", turn.isOpenFormAcceptsFiles());
        }
        if (turn.getPinnedFileNames() != null) toolCtx.put("pinnedFileNames", turn.getPinnedFileNames());

        AgentState state = new AgentState(turn);
        state.setPriorPayloads(prior);
        turn.setAgentState(state);
        toolCtx.put(AgentState.CONTEXT_KEY, state);
        turn.setToolCtx(toolCtx);
        scope.writeExecutionContext(InvocationParameters.class, InvocationParameters.from(toolCtx));

        // Bộ nhớ của lượt: cửa sổ đã lưu + đệm. DB chỉ nhận một cặp hỏi–đáp ở bước finish.
        turn.setMemory(new TurnChatMemory(turn.getTurnId(),
                turn.isHasMemory() ? memoryStore.window(turn.getConversationId()) : List.of()));
        turns.register(turn);

        ZonedDateTime now = ZonedDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        turn.setCurrentDateTime(now.format(DateTimeFormatter
                .ofPattern("dd/MM/yyyy HH:mm 'ICT', EEEE", new Locale("vi")))
                + " (ISO: " + now.toLocalDate() + ")");
    }

    /** Đơn vị người dùng đang xem trên màn hình, nếu nó nằm trong cây con của họ; không thì đơn vị gốc. */
    private UUID resolveEffectiveUnit(AiTurn turn, ManagerContext ctx) {
        String focusUnitId = turn.getFocusUnitId();
        if (focusUnitId == null || focusUnitId.isBlank()) return ctx.orgUnitId();
        try {
            UUID fid = UUID.fromString(focusUnitId.trim());
            OrgUnit fu = orgUnitRepository.findById(fid).orElse(null);
            if (fu != null && fu.getPath() != null && ctx.orgUnitPath() != null
                    && fu.getPath().startsWith(ctx.orgUnitPath())) {
                turn.setFocusUnitName(fu.getName());
                return fid;
            }
        } catch (IllegalArgumentException ignored) {
        }
        return ctx.orgUnitId();
    }

    // ── ② kế hoạch ──────────────────────────────────────────────────────────

    /** {@code PlanNode} cũ. Một bước nghĩa là câu hỏi đơn giản — không ghi kế hoạch, khỏi tốn token. */
    public void plan(AgenticScope scope) {
        AiTurn turn = turnOf(scope);
        if (!planningEnabled) return;
        // Planner chỉ biết bộ tool của QUẢN LÝ (get_people, rank...). Lượt nhân viên không có các tool
        // đó, một kế hoạch nhắc tới chúng chỉ đẩy model gọi mãi tool cá nhân cho tới hết ngân sách.
        if (turn.isStaff()) return;
        turn.progress("PLAN", "Đang lập kế hoạch trả lời");
        List<PlanStep> steps;
        try {
            steps = PlanParser.parse(plannerAgent.plan(turn.getQuestion()));
        } catch (Exception e) {
            // Lập kế hoạch hỏng thì lượt hỏi vẫn phải chạy được như bình thường.
            log.warn("Lập kế hoạch lỗi ({}), bỏ qua kế hoạch cho lượt này", e.getMessage());
            return;
        }
        if (steps.size() > 1) {
            turn.setPlan(steps);
            log.debug("Kế hoạch {} bước cho '{}': {}", steps.size(), turn.getQuestion(),
                    steps.stream().map(PlanStep::describe).toList());
        }
    }

    // ── ③ định tuyến ────────────────────────────────────────────────────────

    /** Khoá trong scope giữ ý định đã chọn ({@code IntentHandler.intent()} hoặc {@code null}). */
    public static final String INTENT = "intent";
    /** Khoá scope nhận câu trả lời của người dùng từ bước human-in-the-loop. */
    public static final String USER_ANSWER = "userAnswer";

    /** Tập lùi về CHỈ gồm nhóm ĐỌC — "không chắc" thì tuyệt đối không phải lúc trao tool GHI. */
    private static final Set<Group> READ_GROUPS = Set.of(Group.LOOKUP, Group.KPI, Group.INSIGHT, Group.BSC, Group.OKR);

    /**
     * {@code RouteNode} + {@code LlmIntentStrategy} cũ. Chọn nhóm tool (router ∪ kế hoạch), ghi
     * nhóm bị chặn vì thiếu quyền, và nhận ra ý định của một {@link IntentHandler} nếu có.
     */
    public void route(AgenticScope scope, List<IntentHandler> handlers) {
        AiTurn turn = turnOf(scope);
        turn.progress("ROUTE", "Đang chọn công cụ phù hợp");
        scope.writeState(INTENT, null);

        Set<Group> groups = new LinkedHashSet<>();
        if (turn.isStaff()) {
            // Nhân viên: không định tuyến nhóm — chỉ nhóm CÁ NHÂN, và vẫn nhận ra nhánh HELP (cách dùng).
            routeStaff(scope, turn, handlers);
            return;
        }
        if (!routingEnabled) {
            groups.addAll(toolRegistry.readGroups());
        } else {
            String hints = featureGroupHints(turn) + handlers.stream()
                    .map(IntentHandler::routerHint)
                    .filter(h -> h != null && !h.isBlank())
                    .reduce((a, b) -> a + "\n" + b).orElse("");
            String raw = null;
            try {
                raw = routerAgent.route(hints, turn.getQuestion());
            } catch (Exception e) {
                log.warn("Router lỗi ({}), lùi về toàn bộ nhóm đọc", e.getMessage());
            }
            String upper = raw == null ? "" : raw.toUpperCase(Locale.ROOT);

            for (IntentHandler h : handlers) {
                if (h.routerHint() != null && upper.contains(h.intent().toUpperCase(Locale.ROOT))) {
                    scope.writeState(INTENT, h.intent());
                    log.info("Router chọn nhánh {} cho câu hỏi: {}", h.intent(), turn.getQuestion());
                    return;
                }
            }
            for (Group g : new Group[]{Group.LOOKUP, Group.KPI, Group.INSIGHT, Group.BSC, Group.OKR, Group.ACTION,
                    Group.CONDUCT, Group.REWARD}) {
                if (upper.contains(g.name())) groups.add(g);
            }
            // Nhóm theo cờ chỉ được chọn khi tổ chức bật tính năng — router có thể đoán bừa từ chữ "thưởng".
            if (!turn.getFeatures().conduct()) groups.remove(Group.CONDUCT);
            if (!turn.getFeatures().reward()) groups.remove(Group.REWARD);
            if (groups.isEmpty()) {
                log.warn("Router không nhận ra nhóm nào từ '{}', lùi về toàn bộ nhóm đọc", upper.strip());
                groups.addAll(READ_GROUPS);
            }
            Set<Group> fromPlan = ToolRegistry.groupsForTools(plannedTools(turn));
            if (groups.addAll(fromPlan)) log.debug("Kế hoạch nới nhóm thêm {}", fromPlan);
        }
        applyGroups(turn, groups);
    }

    /**
     * Dòng mô tả cho router của hai nhóm theo cờ tổ chức. Chỉ xuất hiện khi tổ chức bật — router không
     * nhìn thấy nhóm thì không chọn được, nên tổ chức tắt thưởng không bao giờ có lượt "REWARD".
     */
    static String featureGroupHints(AiTurn turn) {
        StringBuilder sb = new StringBuilder();
        if (turn.getFeatures().conduct()) {
            sb.append("CONDUCT - KPI hành vi / hạnh kiểm: bảng điểm hành vi của đơn vị, ai chưa tự chấm, phiếu hạnh kiểm của một người\n");
        }
        if (turn.getFeatures().reward()) {
            sb.append("REWARD  - thưởng điểm: đề xuất thưởng chờ duyệt, ai được thưởng, ngân sách thưởng của tôi\n");
        }
        return sb.toString();
    }

    /**
     * Lượt của NHÂN VIÊN: nhóm cố định {@code PERSONAL}; router chỉ dùng để nhận ra nhánh HELP (hỏi
     * cách dùng). Không có nhóm ĐỌC nào khác, không ACTION, không nới tool — không phải "bị chặn" mà
     * là không tồn tại trong lượt này.
     */
    private void routeStaff(AgenticScope scope, AiTurn turn, List<IntentHandler> handlers) {
        if (routingEnabled) {
            String hints = handlers.stream().map(IntentHandler::routerHint)
                    .filter(h -> h != null && !h.isBlank()).reduce((a, b) -> a + "\n" + b).orElse("");
            try {
                String upper = routerAgent.route(hints, turn.getQuestion()).toUpperCase(Locale.ROOT);
                for (IntentHandler h : handlers) {
                    if (h.routerHint() != null && upper.contains(h.intent().toUpperCase(Locale.ROOT))) {
                        scope.writeState(INTENT, h.intent());
                        log.info("Router (nhân viên) chọn nhánh {} cho câu hỏi: {}", h.intent(), turn.getQuestion());
                        return;
                    }
                }
            } catch (Exception e) {
                log.warn("Router (nhân viên) lỗi ({}), dùng nhóm cá nhân", e.getMessage());
            }
        }
        turn.setToolGroups(Set.of(Group.PERSONAL));
        turn.setDeniedGroups(Set.of());
        log.info("Lượt nhân viên: nhóm PERSONAL cho câu hỏi: {}", turn.getQuestion());
    }

    private void applyGroups(AiTurn turn, Set<Group> groups) {
        turn.setToolGroups(groups);
        UUID userId = turn.getManager().userId();
        Set<Group> denied = toolRegistry.deniedGroups(groups, userId);
        turn.setDeniedGroups(denied);
        log.info("Nhóm hiệu lực {} cho câu hỏi: {}", effective(groups), turn.getQuestion());
        if (!denied.isEmpty()) log.info("Chặn vì thiếu quyền: {} (câu hỏi: {})", denied, turn.getQuestion());
    }

    private static Set<Group> effective(Set<Group> groups) {
        Set<Group> e = new LinkedHashSet<>(groups);
        e.add(Group.CORE);
        return e;
    }

    private static List<String> plannedTools(AiTurn turn) {
        if (turn.getPlan() == null) return List.of();
        return turn.getPlan().stream().filter(PlanStep::hasTool).map(PlanStep::tool).toList();
    }

    // ── ④ agent chính ───────────────────────────────────────────────────────

    /**
     * Ngay trước mỗi lời gọi agent chính ({@code ModelNode/ActNode} cũ, phần code thuần). Lời gọi
     * thật là {@code AssistantAgent} — sub-agent kế tiếp trong vòng lặp.
     *
     * <p>Vào lại lần hai (thiếu vế hoặc mở thêm công cụ) thì {@link #needsAnotherRound} đã xoá đệm
     * bộ nhớ và cắm cờ nới nhóm tool — ở đây áp cờ đó rồi báo tiến độ.
     */
    public void prepareRound(AgenticScope scope) {
        AiTurn turn = turnOf(scope);
        // Nhân viên không bao giờ được nới sang nhóm đọc của quản lý — dù model có xin.
        if (turn.getAgentState().isWidenTools() && !turn.isStaff()) {
            // NỚI là THÊM nhóm đọc vào nhóm đang có, không thay thế: lượt ACTION mà model xin "cần số
            // liệu KPI để chốt đợt" rồi mất luôn tool chốt ở vòng sau -> "tôi không thể chốt" (đo được
            // ở D14, 1/3 lần).
            Set<Group> widened = new LinkedHashSet<>();
            if (turn.getToolGroups() != null) widened.addAll(turn.getToolGroups());
            widened.addAll(toolRegistry.readGroups());
            applyGroups(turn, widened);
        }
        turn.progress("MODEL", "Đang tra cứu dữ liệu");
    }

    /** Tool {@code ask_user} vừa đặt câu hỏi và lượt chưa có câu trả lời nào. */
    public boolean hasPendingQuestion(AgenticScope scope) {
        AgentState state = turnOf(scope).getAgentState();
        // Đọc đầu ra của agent TRƯỚC: ở lượt streaming, lời gọi tool chạy trên luồng phát chữ và
        // node agent trả về trước khi tool kịp chạy. Kiểm mà không chặn chờ ở đây thì lúc nào cũng
        // thấy "chưa có câu hỏi" rồi đi thẳng tới finish (đo được: ask_user chạy nhưng không ai hỏi).
        Object answer = scope.readState(ANSWER);
        if (answer != null) state.setAnswer(answer.toString());
        if (state.getPendingQuestion() == null) promoteTextQuestion(turnOf(scope), state);
        return state.getPendingQuestion() != null && state.getUserAnswer() == null;
    }

    /**
     * Model HỎI BẰNG CHỮ thay vì gọi {@code ask_user} (vd "Bạn muốn mục tiêu tối thiểu là bao nhiêu?
     * - 99% - 99.5%"): biến nó thành thẻ hỏi giữa lượt, để người dùng bấm/nhập rồi lượt chạy tiếp
     * thay vì phải gõ lại một câu hỏi mới.
     *
     * <p>Cùng các chốt với {@code ask_user}: chỉ lượt có kênh hỏi (SSE), chỉ một lần/lượt, không khi
     * vừa bị từ chối vì phạm vi hay vừa tra không ra (lúc đó câu trả lời đúng là nói thẳng), và không
     * khi đã có đề xuất điền form / lời mời xác nhận (đó là câu trả lời, không phải câu hỏi).
     */
    void promoteTextQuestion(AiTurn turn, AgentState state) {
        if (!turn.canAsk() || turn.getAnsweredQuestion() != null) return;
        if (state.isScopeDenied() || state.getNotFoundName() != null) return;
        if (state.getFormPatch() != null && !state.getFormPatch().isEmpty()) return;
        if (state.getPendingAction() != null && !state.getPendingAction().isEmpty()) return;
        PendingQuestion.Item item = TextQuestionDetector.detect(state.getAnswer());
        if (item == null) return;
        log.info("Câu hỏi viết bằng chữ -> thẻ hỏi giữa lượt: {}", item.question());
        state.setPendingQuestion(new PendingQuestion(UUID.randomUUID().toString(), turn.getTurnId(),
                turn.getManager() == null ? null : turn.getManager().userId(), List.of(item)));
    }

    /**
     * Bước HUMAN-IN-THE-LOOP: phát câu hỏi ra kênh của lượt rồi CHỜ người dùng trả lời.
     *
     * <p>Chặn trên luồng của lượt cho tới khi client POST câu trả lời hoặc hết
     * {@code app.ai.hitl.wait-seconds}. Đường JSON (listener NOOP) không có kênh nào để hỏi nên trả
     * {@code null} ngay lập tức — lượt kết thúc bằng chính câu hỏi kèm các lựa chọn, đúng hành vi cũ.
     */
    public Object awaitUserAnswer(AgenticScope scope) {
        AiTurn turn = turnOf(scope);
        AgentState state = turn.getAgentState();
        PendingQuestion q = state.getPendingQuestion();
        if (q == null) return null;
        if (!turn.canAsk()) {
            log.info("Lượt không có kênh hỏi lại (JSON) — kết thúc bằng câu hỏi. question='{}'", q.question());
            return null;
        }
        turn.progress("ASK", "Đang chờ bạn trả lời");
        CompletableFuture<String> slot = questions.register(q);
        turn.getListener().ask(q);
        String answer = questions.await(q, slot, hitlWaitSeconds);
        state.setUserAnswer(answer);
        log.info("Người dùng {} câu hỏi giữa lượt: {}", answer == null ? "KHÔNG trả lời" : "đã trả lời", q.question());
        return answer;
    }

    /**
     * {@code ObserveNode} cũ. {@code true} = phải gọi agent chính THÊM một vòng.
     *
     * <p>Thứ tự có chủ đích: hết ngân sách → dừng; đã có đề xuất điền form hoặc lời mời xác nhận →
     * dừng (quay lui sẽ hỏi lại và sinh lời mời THỨ HAI cho cùng một việc); kế hoạch còn thiếu vế →
     * hỏi lại một lần; model xin thêm công cụ → nới rồi hỏi lại một lần.
     */
    public boolean needsAnotherRound(AgenticScope scope) {
        AiTurn turn = turnOf(scope);
        AgentState state = turn.getAgentState();
        // Đầu ra của @Agent; đọc là chặn chờ tới khi luồng streaming của nó xong.
        Object answer = scope.readState(ANSWER);
        state.setAnswer(answer == null ? null : answer.toString());
        turn.setMissingPlannedTools(null);
        if (state.isBudgetExhausted()) return false;
        // Người dùng vừa trả lời câu hỏi giữa lượt: hỏi lại model với lựa chọn đó. Không tính vào
        // ngân sách nhắc kế hoạch / nới tool — đây là lượt người dùng CHỦ ĐỘNG tiếp sức.
        if (state.getPendingQuestion() != null && state.getUserAnswer() != null) {
            PendingQuestion answered = state.getPendingQuestion();
            turn.setAnsweredQuestion(answered.question());
            turn.setAnsweredValue(state.getUserAnswer());
            state.setPendingQuestion(null);
            state.setUserAnswer(null);
            // Người dùng đã chọn rõ nên chốt chặn tên trùng không còn nghĩa; giữ nó là vòng sau
            // ăn lại lỗi "có nhiều bản trùng tên" rồi hỏi lần hai.
            state.disarmAll();
            // Hội thoại không còn chờ người dùng chọn nữa — nếu giữ, câu trả lời cuối vẫn kèm hàng
            // nút "chọn đơn vị nào" cho đúng câu hỏi vừa được trả lời.
            followupContextStore.clearDisambiguating(turn.getConversationId());
            turn.progress("OBSERVE", "Đang làm tiếp theo lựa chọn của bạn");
            restart(scope, turn, state);
            return true;
        }
        // Đã hỏi mà không có câu trả lời (hết giờ, bỏ qua, hoặc đường JSON): dừng, để finish dựng
        // câu trả lời từ chính câu hỏi.
        if (state.getPendingQuestion() != null) return false;
        if (state.getFormPatch() != null && !state.getFormPatch().isEmpty()) return false;
        if (state.getPendingAction() != null && !state.getPendingAction().isEmpty()) return false;

        List<String> missing = missingTools(turn, state);
        if (planEnforce && !state.isPlanNudgeUsed() && !missing.isEmpty()) {
            state.setPlanNudgeUsed(true);
            log.info("Kế hoạch còn thiếu {} — hỏi lại một lần. question='{}'", missing, turn.getQuestion());
            turn.progress("OBSERVE", "Đang bổ sung phần còn thiếu");
            turn.setMissingPlannedTools(missing);
            restart(scope, turn, state);
            return true;
        }
        if (state.escapeRequested() && !state.isEscapeUsed()) {
            state.setEscapeUsed(true);
            log.info("Mở rộng bộ công cụ và hỏi lại. Lý do model nêu: {}", state.getEscapeReason());
            turn.progress("OBSERVE", "Đang mở thêm công cụ");
            state.setEscapeReason(null);
            state.setWidenTools(true);
            restart(scope, turn, state);
            return true;
        }
        return false;
    }

    /** Hỏi lại từ đầu: xoá phần đệm của lượt (cửa sổ đã lưu giữ nguyên) và câu trả lời nháp. */
    private static void restart(AgenticScope scope, AiTurn turn, AgentState state) {
        if (turn.getMemory() != null) turn.getMemory().clear();
        state.setAnswer(null);
        scope.writeState(ANSWER, null);
    }

    private static List<String> missingTools(AiTurn turn, AgentState state) {
        List<PlanStep> plan = turn.getPlan();
        if (plan == null || plan.isEmpty()) return List.of();
        List<String> called = state.getSucceeded();
        return plan.stream().filter(PlanStep::hasTool).map(PlanStep::tool).distinct()
                .filter(t -> !called.contains(t)).toList();
    }

    // ── ⑤ kết thúc ──────────────────────────────────────────────────────────

    /**
     * {@code FinishNode} cũ: lọc tên tool lọt ra, vá bảng Markdown, câu dự phòng khi rỗng, và ghi
     * bộ nhớ CHỈ KHI đã có câu trả lời — nên không tạo ra được câu hỏi mồ côi.
     */
    public void finish(AgenticScope scope) {
        AiTurn turn = turnOf(scope);
        AgentState state = turn.getAgentState();
        // Đã hỏi mà không nhận được trả lời (đường JSON, hết giờ, người dùng bỏ qua): câu trả lời
        // của lượt CHÍNH LÀ câu hỏi đó, kèm các lựa chọn để client vẽ nút bấm như trước khi có HITL.
        PendingQuestion unanswered = state.getPendingQuestion();
        if (unanswered != null && state.getUserAnswer() == null) {
            if (turn.canAsk()) {
                // Lượt SSE: câu hỏi đã hiện thành thẻ ngay phía trên. Lặp nó lần nữa làm câu trả lời
                // (kèm hàng nút) là hỏi người dùng hai lần cùng một câu — đo được 23/09.
                state.setAnswer(SKIPPED_ANSWER);
                return;
            }
            state.setAnswer(questionAsAnswer(unanswered));
            turn.setClarificationOptions(unanswered.options().stream()
                    .map(o -> new AiTurn.Choice(o.label(), o.value()))
                    .toList());
            return;
        }
        String raw = state.getAnswer();
        String result = raw == null ? null : new ResponseSanitizingAdvisor(TOOL_NAMES).sanitizeText(raw);
        if (result == null || result.isBlank()) {
            state.setAnswer(fallbackAnswer(state));
            return;
        }
        state.setAnswer(result);
        if (turn.isHasMemory()) {
            try {
                memoryStore.append(turn.getConversationId(), turn.getQuestion(), result);
            } catch (Exception e) {
                log.warn("Không ghi được bộ nhớ hội thoại ({}), bỏ qua", e.getMessage());
            }
        }
    }

    /** Trần dòng của khối cây đơn vị — đủ cho một chi nhánh, không đủ để phình prompt ở tổ chức lớn. */
    static final int MAX_SCOPE_UNITS = 40;

    /** Cây đơn vị trong phạm vi người hỏi, gọn thành từng dòng; lỗi thì rỗng (chỉ là ngữ cảnh thêm). */
    private List<String> scopeUnits(ManagerContext ctx) {
        try {
            return orgUnitRepository.findSubtree(ctx.orgUnitPath(), ctx.orgId()).stream()
                    .sorted(java.util.Comparator.comparing(u -> u.getPath() == null ? "" : u.getPath()))
                    .limit(MAX_SCOPE_UNITS)
                    .map(u -> {
                        String level = u.getOrgHierarchyLevel() == null ? null : u.getOrgHierarchyLevel().getUnitTypeName();
                        String parent = u.getParent() == null ? null : u.getParent().getName();
                        return u.getName()
                                + (level == null ? "" : " — " + level)
                                + (parent == null ? "" : " (thuộc " + parent + ")");
                    })
                    .toList();
        } catch (Exception e) {
            log.warn("Không nạp được cây đơn vị cho prompt ({}), bỏ qua", e.getMessage());
            return List.of();
        }
    }

    /** Lượt SSE dừng vì người dùng bỏ qua hoặc hết giờ: nói ngắn, không lặp câu hỏi đã nằm trên thẻ. */
    static final String SKIPPED_ANSWER = "Mình dừng ở đây vì chưa có lựa chọn. Bạn gõ lại câu hỏi kèm tên cụ "
            + "thể là mình làm tiếp ngay.";

    /** Câu hỏi giữa lượt, viết thành câu trả lời khi lượt phải dừng mà chưa có lựa chọn của người dùng. */
    static String questionAsAnswer(PendingQuestion q) {
        StringBuilder sb = new StringBuilder(q.question().strip());
        if (!q.options().isEmpty()) {
            sb.append("\n");
            for (PendingQuestion.Option o : q.options()) {
                sb.append("\n- **").append(o.label()).append("**");
                if (o.description() != null && !o.description().isBlank()) sb.append(" — ").append(o.description());
            }
        }
        return sb.toString();
    }

    static String fallbackAnswer(AgentState state) {
        if (state.isBudgetExhausted()) {
            log.warn("Vòng lặp hết ngân sách bước. question={}", state.questionOrNa());
            return "Xin lỗi, yêu cầu này cần quá nhiều bước tra cứu nên mình phải dừng giữa chừng. "
                    + "Bạn tách nhỏ câu hỏi giúp mình nhé — ví dụ hỏi từng đơn vị một.";
        }
        // Model suy luận (gpt-oss) đôi lúc tiêu hết token cho phần suy luận rồi chạm
        // finishReason=LENGTH trước khi kịp sinh text -> content rỗng.
        log.warn("AI trả nội dung rỗng (nghi finishReason=LENGTH). question={}", state.questionOrNa());
        return "Xin lỗi, mình chưa tạo được câu trả lời cho yêu cầu này (nội dung xử lý quá dài). "
                + "Bạn thử hỏi ngắn gọn/cụ thể hơn giúp mình nhé.";
    }

    // ── ⑥ song song: kiểm duyệt + gợi ý ─────────────────────────────────────

    /**
     * {@code ValidationStage} cũ: chặn câu có số liệu mà không tool nào chạy — nghi bịa.
     *
     * <p>CHỈ áp cho nhánh agent chính. Nhánh của {@link IntentHandler} không lấy dữ liệu qua tool
     * (HELP trả lời từ tài liệu, và "Hình 23" là một con số) nên luật này vô nghĩa với chúng — đo
     * được ngay lượt đầu: câu hướng dẫn nộp báo cáo bị thay bằng "chưa lấy được dữ liệu".
     */
    public void validate(AgenticScope scope) {
        if (scope.readState(INTENT) != null) return;
        AiTurn turn = turnOf(scope);
        AgentState state = turn.getAgentState();
        turn.progress("VALIDATE", "Đang kiểm tra lại câu trả lời");
        state.setAnswer(validator.check(turn, state.getAnswer()));
    }

    /** {@code FollowupStage} cũ. */
    public void followups(AgenticScope scope) {
        AiTurn turn = turnOf(scope);
        AgentState state = turn.getAgentState();
        if (!followupsEnabled || !state.anyToolSucceeded() || state.getFormPatch() != null) return;
        turn.progress("FOLLOWUP", "Đang nghĩ vài câu hỏi tiếp theo");
        AiTokenUsage.AiFeature previous = AiTokenUsageRecorder.currentFeature();
        try {
            AiTokenUsageRecorder.setFeature(AiTokenUsage.AiFeature.FOLLOWUP);
            FollowupResponse pools = followupService.generate(topic(turn), turn.memoryConversationId());
            if (pools != null && FollowupService.hasAny(pools)) turn.setFollowups(pools);
        } catch (Exception e) {
            log.warn("Sinh câu hỏi gợi ý lỗi ({}), bỏ qua gợi ý cho lượt này", e.getMessage());
        } finally {
            if (previous == null) AiTokenUsageRecorder.clearFeature(); else AiTokenUsageRecorder.setFeature(previous);
        }
    }

    /**
     * Chọn biểu đồ minh hoạ, chạy SONG SONG với bước kiểm duyệt (cùng khuôn {@link #followups}).
     *
     * <p>Ba cổng trước khi tốn một lời gọi model: bật cờ, lượt có tool chạy thành công, và payload có
     * hình dạng vẽ được ({@code ChartCandidateDetector}). Lỗi ở đây KHÔNG được làm hỏng lượt — biểu
     * đồ là phần thêm, câu trả lời (kèm bảng) đã đủ dùng.
     */
    public void charts(AgenticScope scope) {
        AiTurn turn = turnOf(scope);
        AgentState state = turn.getAgentState();
        if (!chartsEnabled || scope.readState(INTENT) != null) return;
        if (state.getFormPatch() != null || state.getPendingAction() != null) return;
        // Lượt kết thúc bằng một CÂU HỎI (hỏi lại giữa lượt mà không ai trả lời): câu trả lời là
        // câu hỏi đó, nên vẽ biểu đồ minh hoạ cho nó là minh hoạ cho thứ chưa được hỏi xong.
        if (state.getPendingQuestion() != null) return;
        List<AgentState.ToolPayload> source = chartSource(turn, state);
        if (source.isEmpty()) return;
        turn.progress("CHART", "Đang chọn biểu đồ minh hoạ");
        AiTokenUsage.AiFeature previous = AiTokenUsageRecorder.currentFeature();
        try {
            AiTokenUsageRecorder.setFeature(AiTokenUsage.AiFeature.CHART);
            String raw = chartAgent.choose(turn.getQuestion(), state.getAnswer(),
                    chartDetector.payloadsAsPrompt(source, MAX_CHART_PAYLOAD_CHARS));
            List<ChartSpec> charts = chartValidator.validate(ChartAgent.parse(raw), source);
            if (!charts.isEmpty()) {
                turn.setCharts(charts);
                log.debug("Biểu đồ cho lượt: {}", charts.stream().map(ChartSpec::getType).toList());
            }
        } catch (Exception e) {
            log.warn("Chọn biểu đồ lỗi ({}), bỏ qua biểu đồ cho lượt này", e.getMessage());
        } finally {
            if (previous == null) AiTokenUsageRecorder.clearFeature(); else AiTokenUsageRecorder.setFeature(previous);
        }
    }

    /**
     * Payload để vẽ: của chính lượt này nếu vẽ được; nếu không, và người dùng xin THẲNG một biểu đồ
     * ("cho tôi biểu đồ tròn đi"), thì của lượt trước. Rỗng = không vẽ.
     */
    List<AgentState.ToolPayload> chartSource(AiTurn turn, AgentState state) {
        if (state.anyToolSucceeded() && chartDetector.hasCandidate(state.getPayloads())) return state.getPayloads();
        if (!ChartCandidateDetector.isChartRequest(turn.getQuestion())) return List.of();
        // Người dùng đã xin THẲNG một biểu đồ: không đòi payload phải có sẵn một mảng — số liệu hay
        // nằm rải ở nhiều lời gọi (vd get_kpi hai lần, mỗi lần một phòng). Để ChartAgent quyết; lưới
        // "không bịa số" của ChartSpecValidator vẫn áp trên đúng các payload này.
        if (!state.getPayloads().isEmpty()) return state.getPayloads();
        return state.getPriorPayloads();
    }

    /** Trần payload đưa vào prompt chọn biểu đồ — đủ cho vài bảng, không đủ để phình prompt. */
    private static final int MAX_CHART_PAYLOAD_CHARS = 12_000;

    private static String topic(AiTurn turn) {
        String unit = turn.getFocusUnitName();
        return unit == null || unit.isBlank() ? turn.getQuestion() : "[" + unit + "] " + turn.getQuestion();
    }

    /** Gỡ bộ nhớ lượt khỏi sổ đăng ký — gọi ở {@code finally} của lượt, dù thành công hay lỗi. */
    public void release(AiTurn turn) {
        turns.unregister(turn.getTurnId());
    }
}
