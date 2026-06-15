package com.kpitracking.controller;

import com.kpitracking.dto.request.ai.AiKpiSuggestionRequest;
import com.kpitracking.dto.request.ai.FollowupRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.ai.AiKpiSuggestionResponse;
import com.kpitracking.dto.response.ai.FollowupResponse;
import com.kpitracking.dto.response.ai.InsightCardResponse;
import com.kpitracking.service.FollowupService;
import com.kpitracking.service.InsightService;
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

    @PostMapping("/chat-org-unit")
    public ApiResponse<AiChatResponse> chatOrgUnit(@RequestBody AiChatRequest request) {
        String result = aiService.processOrgUnitChat(request.getMessage(), request.getConversationId());
        AiChatResponse response = AiChatResponse.builder()
                .text(result)
                .build();
        return ApiResponse.success(response);
    }

    @PostMapping("/suggest-kpi")
    @PreAuthorize("hasAuthority('AI:SUGGEST_KPI')")
    @Operation(summary = "Get KPI suggestions from AI (Synchronized with Analytics AI)")
    public ResponseEntity<ApiResponse<List<AiKpiSuggestionResponse>>> suggestKpi(
            @RequestBody AiKpiSuggestionRequest request) {
        List<AiKpiSuggestionResponse> suggestions = aiService.suggestKpis(request.getOrgUnitId());
        return ResponseEntity.ok(ApiResponse.success(suggestions));
    }

    @GetMapping("/insights")
    @Operation(summary = "Proactive rule-based KPI insight cards for the current manager (no AI)")
    public ApiResponse<List<InsightCardResponse>> getInsights() {
        return ApiResponse.success(insightService.getInsights());
    }

    @PostMapping("/followups")
    @Operation(summary = "Suggested follow-up questions (turn 0 = fixed templates, turn ≥1 = AI-generated pools)")
    public ApiResponse<FollowupResponse> getFollowups(@RequestBody FollowupRequest request) {
        return ApiResponse.success(followupService.generate(request));
    }
}