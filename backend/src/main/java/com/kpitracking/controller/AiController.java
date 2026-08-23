package com.kpitracking.controller;

import com.kpitracking.dto.request.ai.AiKpiSuggestionRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.ai.AiKpiSuggestionResponse;
import com.kpitracking.dto.response.ai.FollowupResponse;
import com.kpitracking.dto.response.ai.InsightCardResponse;
import com.kpitracking.entity.AiTokenUsage;
import com.kpitracking.service.AiQuotaService;
import com.kpitracking.service.AiRateLimiter;
import com.kpitracking.service.AiTokenUsageRecorder;
import com.kpitracking.service.InsightService;
import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.TurnListener;
import com.kpitracking.service.ai.form.FormPatch;
import com.kpitracking.tool.FollowupContextStore;
import org.springframework.security.concurrent.DelegatingSecurityContextExecutor;
import org.springframework.security.core.context.SecurityContextHolder;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import com.kpitracking.dto.request.ai.AiChatRequest;
import com.kpitracking.dto.response.ai.AiChatResponse;
import com.kpitracking.service.AiService;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@RestController
@RequestMapping("/api/v1/ai")
@Tag(name = "AI", description = "AI-powered assistance endpoints")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;
    private final InsightService insightService;
    private final AiRateLimiter aiRateLimiter;
    private final AiQuotaService aiQuotaService;
    private final FollowupContextStore followupContextStore;

    /** Trần thời gian một lượt streaming; dài hơn timeout 300s của client một chút. */
    private static final long SSE_TIMEOUT_MS = 330_000L;

    /**
     * Luồng chạy pipeline cho các lượt streaming.
     *
     * <p>Có TRẦN chứ không dùng {@code newCachedThreadPool}: mỗi lượt chiếm luồng 10–15 giây trong
     * lúc chờ model, nên pool không giới hạn sẽ đẻ luồng không kiểm soát khi nhiều người hỏi cùng
     * lúc. Trần 32 là dư so với bộ chặn 15 lượt AI/phút của chính hệ thống.
     *
     * <p>(Luồng ảo hợp hơn cho tác vụ chờ I/O như thế này, nhưng dự án biên dịch cho Java 17.)
     */
    private final ExecutorService streamExecutor = Executors.newFixedThreadPool(32);

    /** Email người dùng đang đăng nhập (JWT subject) — khóa rate-limit theo user. */
    private String currentUserEmail() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    @PostMapping("/chat")
    public ApiResponse<AiChatResponse> chatOrgUnit(@RequestBody AiChatRequest request) {
        // Chặn tần suất và kiểm hạn mức đã thành RateLimitStage/QuotaStage trong chuỗi xử lý,
        // để mọi lối vào tính năng chat đều đi qua chúng chứ không chỉ riêng endpoint này.
        // Còn mỗi gợi ý KPI chưa dùng chuỗi nên vẫn tự gọi; câu hỏi gợi ý đã thành FollowupStage
        // trong chuỗi, nên nó cũng đi qua các phép chặn này thay vì tự kiểm.
        return ApiResponse.success(runTurn(request, TurnListener.NOOP));
    }

    /**
     * Bản streaming của {@link #chatOrgUnit}: phát tiến độ từng công đoạn và chữ dần, rồi kết bằng
     * câu trả lời CHÍNH THỨC.
     *
     * <p>Giữ song song endpoint JSON chứ không thay: hai bộ đo của dự án (40 câu và 21 ca điền form)
     * đều đọc JSON, và client không phải trình duyệt cũng dễ dùng hơn. Phần thân dùng chung
     * {@link #runTurn} nên hai đường không thể lệch nội dung trả về.
     */
    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chatOrgUnitStream(@RequestBody AiChatRequest request) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        SseTurnListener listener = new SseTurnListener(emitter);

        // Pipeline chạy NGOÀI luồng request nên phải mang SecurityContext sang: ManagerContextResolver,
        // AiRateLimiter và AiTokenUsageRecorder đều đọc SecurityContextHolder — đó là ThreadLocal
        // duy nhất còn lại trên đường này. Trạng thái theo lượt nằm trong AgentState và đi cùng
        // ToolContext, nên nó chạy ở luồng nào cũng đúng và không có gì phải dọn.
        new DelegatingSecurityContextExecutor(streamExecutor, SecurityContextHolder.getContext())
                .execute(() -> {
                    try {
                        listener.done(runTurn(request, listener));
                        emitter.complete();
                    } catch (Exception e) {
                        listener.failed(e);
                        emitter.complete();
                    }
                });
        return emitter;
    }

    /**
     * Chạy một lượt hỏi và dựng câu trả lời. Là chỗ DUY NHẤT dựng {@link AiChatResponse}, để đường
     * JSON và đường streaming không thể lệch nhau về options / formPatch / followups.
     */
    private AiChatResponse runTurn(AiChatRequest request, TurnListener listener) {
        String result;
        FormPatch formPatch;
        boolean evidenceRequested;
        boolean filesAttached;
        FollowupResponse followups;
        AiTokenUsageRecorder.setFeature(AiTokenUsage.AiFeature.CHAT);
        try {
            AiTurn turn = new AiTurn(request.getMessage(), request.getConversationId(), request.getFocusUnitId());
            turn.setOpenFormId(request.getOpenFormId());
            turn.setOpenFormValues(request.getOpenFormValues());
            turn.setOpenFormFields(request.getOpenFormFields());
            turn.setOpenFormAcceptsFiles(Boolean.TRUE.equals(request.getOpenFormAcceptsFiles()));
            turn.setAttachmentNames(request.getAttachmentNames());
            turn.setPinnedFileNames(request.getPinnedFileNames());
            turn.setListener(listener);
            result = aiService.processOrgUnitChat(turn);
            // Pipeline đã chép các kết quả này từ AgentState lên turn ở khối finally.
            formPatch = turn.getFormPatch();
            evidenceRequested = turn.isEvidenceRequested();
            filesAttached = turn.isFilesAttached();
            followups = turn.getFollowups();
        } finally {
            AiTokenUsageRecorder.clearFeature();
        }

        // Lượt mà trợ lý phải hỏi lại: kèm các lựa chọn CÓ THẬT do tool trả về để client hiện
        // thành nút bấm (người dùng chọn thay vì gõ lại tên). Lượt bình thường -> danh sách rỗng.
        List<AiChatResponse.ClarificationOption> options =
                followupContextStore.getClarificationOptions(request.getConversationId()).stream()
                        .map(o -> AiChatResponse.ClarificationOption.builder()
                                .label(o.getLabel())
                                .value(o.getValue())
                                .build())
                        .toList();

        return AiChatResponse.builder()
                .text(result)
                .options(options)
                .formPatch(formPatch != null && !formPatch.isEmpty() ? formPatch : null)
                .evidenceRequest(evidenceRequested ? Boolean.TRUE : null)
                .attachFiles(filesAttached ? Boolean.TRUE : null)
                .followups(followups)
                .build();
    }

    @PostMapping("/suggest-kpi")
    @PreAuthorize("hasAuthority('AI:SUGGEST_KPI')")
    @Operation(summary = "Get KPI suggestions from AI (Synchronized with Analytics AI)")
    public ResponseEntity<ApiResponse<List<AiKpiSuggestionResponse>>> suggestKpi(
            @RequestBody AiKpiSuggestionRequest request) {
        aiRateLimiter.check(currentUserEmail());
        aiQuotaService.checkAndThrow(currentUserEmail());

        AiTokenUsageRecorder.setFeature(AiTokenUsage.AiFeature.KPI_SUGGESTION);
        try {
            List<AiKpiSuggestionResponse> suggestions = aiService.suggestKpis(request.getOrgUnitId());
            return ResponseEntity.ok(ApiResponse.success(suggestions));
        } finally {
            AiTokenUsageRecorder.clearFeature();
        }
    }

    @GetMapping("/insights")
    @Operation(summary = "Proactive rule-based KPI insight cards for the current manager (no AI)")
    public ApiResponse<List<InsightCardResponse>> getInsights() {
        return ApiResponse.success(insightService.getInsights());
    }
}