package com.kpitracking.ai.workflow;

import com.kpitracking.ai.agent.PlanParser;
import com.kpitracking.ai.agent.PlannerAgent;
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
import com.kpitracking.dto.response.ai.FollowupResponse;
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

    @Value("${app.ai.tool-routing.enabled:true}") boolean routingEnabled;
    @Value("${app.ai.planning.enabled:true}") boolean planningEnabled;
    @Value("${app.ai.planning.enforce:true}") boolean planEnforce;
    @Value("${app.ai.followups.enabled:true}") boolean followupsEnabled;

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
        if (turn.isHasMemory()) followupContextStore.startTurn(turn.getConversationId());
        log.info("Xử lý lượt hỏi cho orgUnitId={}, conversationId={}",
                ctx.orgUnitId(), turn.isHasMemory() ? turn.getConversationId() : "không");

        turn.setEffectiveUnitId(resolveEffectiveUnit(turn, ctx));

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
        if (turn.getAgentState().isWidenTools() && !turn.isStaff()) applyGroups(turn, new LinkedHashSet<>(toolRegistry.readGroups()));
        turn.progress("MODEL", "Đang tra cứu dữ liệu");
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

    private static String topic(AiTurn turn) {
        String unit = turn.getFocusUnitName();
        return unit == null || unit.isBlank() ? turn.getQuestion() : "[" + unit + "] " + turn.getQuestion();
    }

    /** Gỡ bộ nhớ lượt khỏi sổ đăng ký — gọi ở {@code finally} của lượt, dù thành công hay lỗi. */
    public void release(AiTurn turn) {
        turns.unregister(turn.getTurnId());
    }
}
