package com.kpitracking.ai.workflow;

import com.kpitracking.ai.agent.AssistantAgent;
import com.kpitracking.ai.agent.PlanParser;
import com.kpitracking.ai.agent.PlannerAgent;
import com.kpitracking.ai.agent.RouterAgent;
import com.kpitracking.ai.memory.ConversationMemoryStore;
import com.kpitracking.ai.memory.TurnChatMemory;
import com.kpitracking.ai.memory.TurnMemoryRegistry;
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
import dev.langchain4j.service.Result;
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
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * Các bước của workflow trợ lý — mỗi bước là một {@code agentAction} trong đồ thị agentic.
 *
 * <p>Đây là phần "code thuần" giữa các agent LLM: nạp ngữ cảnh, bóc kết quả router/planner, gọi
 * agent chính (có streaming), quyết định có hỏi lại không, kết thúc lượt. Mọi quy tắc trong đây
 * chuyển NGUYÊN từ các node/stage của đồ thị cũ, vì mỗi quy tắc là một lỗi đã đo được rồi mới vá:
 * xem ghi chú tại chỗ.
 *
 * <p>Trạng thái lượt đi trong {@link AgenticScope} dưới một khoá duy nhất {@value #TURN} — chính
 * đối tượng {@link AiTurn}. Không rải từng trường ra scope: các bước đọc/ghi qua getter/setter có
 * kiểu, và test dựng được {@code AiTurn} mà không cần dựng scope.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TurnSteps {

    /** Khoá của {@link AiTurn} trong scope. */
    public static final String TURN = "turn";

    private static final Set<String> TOOL_NAMES = ToolRegistry.allToolNames();

    private final OrgUnitRepository orgUnitRepository;
    private final FollowupContextStore followupContextStore;
    private final ConversationMemoryStore memoryStore;
    private final TurnMemoryRegistry memoryRegistry;
    private final ToolRegistry toolRegistry;
    private final RouterAgent routerAgent;
    private final PlannerAgent plannerAgent;
    private final AssistantAgent assistantAgent;
    private final FollowupService followupService;
    private final AnswerValidator validator;

    @Value("${app.ai.tool-routing.enabled:true}") boolean routingEnabled;
    @Value("${app.ai.planning.enabled:true}") boolean planningEnabled;
    @Value("${app.ai.planning.enforce:true}") boolean planEnforce;
    @Value("${app.ai.followups.enabled:true}") boolean followupsEnabled;
    @Value("${app.ai.streaming.enabled:false}") boolean streamingEnabled;
    @Value("${app.ai.model.timeout-seconds:90}") long modelTimeoutSeconds;

    public static AiTurn turnOf(AgenticScope scope) {
        Object t = scope.readState(TURN);
        if (!(t instanceof AiTurn turn)) throw new IllegalStateException("Scope không có AiTurn");
        return turn;
    }

    // ── ① ngữ cảnh ──────────────────────────────────────────────────────────

    /** {@code TurnSetupStage} cũ: đơn vị hiệu lực, ngữ cảnh tool, bộ nhớ, ngày giờ. */
    public void context(AgenticScope scope) {
        AiTurn turn = turnOf(scope);
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

        // Bộ nhớ của lượt: cửa sổ đã lưu + đệm. DB chỉ nhận một cặp hỏi–đáp ở bước finish.
        TurnChatMemory memory = new TurnChatMemory(turn.getTurnId(),
                turn.isHasMemory() ? memoryStore.window(turn.getConversationId()) : List.of());
        turn.setMemory(memory);
        memoryRegistry.register(turn.getTurnId(), memory);

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
        if (!routingEnabled) {
            groups.addAll(toolRegistry.readGroups());
        } else {
            String hints = handlers.stream()
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
            for (Group g : new Group[]{Group.LOOKUP, Group.KPI, Group.INSIGHT, Group.BSC, Group.OKR, Group.ACTION}) {
                if (upper.contains(g.name())) groups.add(g);
            }
            if (groups.isEmpty()) {
                log.warn("Router không nhận ra nhóm nào từ '{}', lùi về toàn bộ nhóm đọc", upper.strip());
                groups.addAll(READ_GROUPS);
            }
            Set<Group> fromPlan = ToolRegistry.groupsForTools(plannedTools(turn));
            if (groups.addAll(fromPlan)) log.debug("Kế hoạch nới nhóm thêm {}", fromPlan);
        }
        applyGroups(turn, groups);
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
     * Một lời gọi agent chính: gom cả vòng gọi tool. {@code ModelNode/ActNode} cũ.
     *
     * <p>Vào lại lần hai (thiếu vế hoặc mở thêm công cụ) thì {@link #needsAnotherRound} đã xoá đệm
     * bộ nhớ và, nếu cần, nới nhóm tool — ở đây chỉ việc gọi.
     */
    public void assistant(AgenticScope scope) {
        AiTurn turn = turnOf(scope);
        AgentState state = turn.getAgentState();
        if (state.isWidenTools()) applyGroups(turn, new LinkedHashSet<>(toolRegistry.readGroups()));
        turn.progress("MODEL", "Đang tra cứu dữ liệu");

        InvocationParameters params = InvocationParameters.from(turn.getToolCtx());
        try {
            String answer = streamingEnabled && turn.getListener() != null
                    ? streamed(turn, params)
                    : direct(turn, params);
            state.setAnswer(answer);
        } catch (Exception e) {
            if (isToolBudgetExceeded(e)) {
                state.setBudgetExhausted(true);
                log.warn("Hết ngân sách vòng gọi tool. question='{}', đã gọi: {}",
                        turn.getQuestion(), state.getSucceeded());
                state.setAnswer(null);
                return;
            }
            throw e;
        }
    }

    private String direct(AiTurn turn, InvocationParameters params) {
        Result<String> result = assistantAgent.chat(turn.getTurnId(), turn.getQuestion(), params);
        return result == null ? null : result.content();
    }

    /** Phát chữ dần cho người nghe; chữ đó là BẢN XEM TRƯỚC, câu trả lời chính thức là bản gom xong. */
    private String streamed(AiTurn turn, InvocationParameters params) {
        CompletableFuture<String> done = new CompletableFuture<>();
        assistantAgent.chatStream(turn.getTurnId(), turn.getQuestion(), params)
                .onPartialResponse(chunk -> {
                    try { turn.getListener().token(chunk); } catch (Exception ignore) { }
                })
                .onCompleteResponse(r -> done.complete(r.aiMessage() == null ? null : r.aiMessage().text()))
                .onError(done::completeExceptionally)
                .start();
        try {
            return done.get(modelTimeoutSeconds * 3, TimeUnit.SECONDS);
        } catch (java.util.concurrent.ExecutionException e) {
            Throwable cause = e.getCause() == null ? e : e.getCause();
            if (cause instanceof RuntimeException re) throw re;
            throw new IllegalStateException(cause);
        } catch (Exception e) {
            throw new IllegalStateException("Streaming không hoàn tất: " + e.getMessage(), e);
        }
    }

    private static boolean isToolBudgetExceeded(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            String m = t.getMessage();
            if (m != null && m.toLowerCase(Locale.ROOT).contains("sequential tool")) return true;
        }
        return false;
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
            restart(turn, state);
            return true;
        }
        if (state.escapeRequested() && !state.isEscapeUsed()) {
            state.setEscapeUsed(true);
            log.info("Mở rộng bộ công cụ và hỏi lại. Lý do model nêu: {}", state.getEscapeReason());
            turn.progress("OBSERVE", "Đang mở thêm công cụ");
            state.setEscapeReason(null);
            state.setWidenTools(true);
            restart(turn, state);
            return true;
        }
        return false;
    }

    /** Hỏi lại từ đầu: xoá phần đệm của lượt (cửa sổ đã lưu giữ nguyên) và câu trả lời nháp. */
    private static void restart(AiTurn turn, AgentState state) {
        if (turn.getMemory() != null) turn.getMemory().clear();
        state.setAnswer(null);
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

    private static String fallbackAnswer(AgentState state) {
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
        memoryRegistry.unregister(turn.getTurnId());
    }
}
