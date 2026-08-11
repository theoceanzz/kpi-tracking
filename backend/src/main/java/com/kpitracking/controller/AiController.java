package com.kpitracking.controller;

import com.kpitracking.dto.request.ai.AiKpiSuggestionRequest;
import com.kpitracking.dto.request.ai.FollowupRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.ai.AiKpiSuggestionResponse;
import com.kpitracking.dto.response.ai.FollowupResponse;
import com.kpitracking.dto.response.ai.InsightCardResponse;
import com.kpitracking.entity.AiTokenUsage;
import com.kpitracking.service.AiQuotaService;
import com.kpitracking.service.AiRateLimiter;
import com.kpitracking.service.AiTokenUsageRecorder;
import com.kpitracking.service.FollowupService;
import com.kpitracking.service.InsightService;
import com.kpitracking.tool.FollowupContextStore;
import org.springframework.security.core.context.SecurityContextHolder;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import com.kpitracking.dto.request.ai.AiChatRequest;
import com.kpitracking.dto.response.ai.AiChatResponse;
import com.kpitracking.service.AiService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/ai")
@Tag(name = "AI", description = "AI-powered assistance endpoints")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;
    private final InsightService insightService;
    private final FollowupService followupService;
    private final AiRateLimiter aiRateLimiter;
    private final AiQuotaService aiQuotaService;
    private final FollowupContextStore followupContextStore;

    /** Email người dùng đang đăng nhập (JWT subject) — khóa rate-limit theo user. */
    private String currentUserEmail() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    @PostMapping("/chat-org-unit")
    public ApiResponse<AiChatResponse> chatOrgUnit(@RequestBody AiChatRequest request) {
        aiRateLimiter.check(currentUserEmail());
        aiQuotaService.checkAndThrow(currentUserEmail());

        String result;
        AiTokenUsageRecorder.setFeature(AiTokenUsage.AiFeature.CHAT);
        try {
            result = aiService.processOrgUnitChat(request.getMessage(), request.getConversationId(), request.getFocusUnitId());
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

        AiChatResponse response = AiChatResponse.builder()
                .text(result)
                .options(options)
                .build();
        return ApiResponse.success(response);
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

    @PostMapping("/followups")
    @Operation(summary = "Suggested follow-up questions (turn 0 = fixed templates, turn ≥1 = AI-generated pools)")
    public ApiResponse<FollowupResponse> getFollowups(@RequestBody FollowupRequest request) {
        // Endpoint này trước đây hoàn toàn không bị chặn dù nó có gọi LLM — để nguyên thì
        // người đã hết hạn mức vẫn tiêu được token qua đường này.
        aiRateLimiter.check(currentUserEmail());
        aiQuotaService.checkAndThrow(currentUserEmail());

        AiTokenUsageRecorder.setFeature(AiTokenUsage.AiFeature.FOLLOWUP);
        try {
            return ApiResponse.success(followupService.generate(request));
        } finally {
            AiTokenUsageRecorder.clearFeature();
        }
    }
}