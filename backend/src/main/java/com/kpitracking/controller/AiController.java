package com.kpitracking.controller;

import com.kpitracking.dto.request.ai.AiKpiSuggestionRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.ai.AiKpiSuggestionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import com.kpitracking.dto.request.ai.AiChatRequest;
import com.kpitracking.dto.response.ai.AiChatResponse;
import com.kpitracking.service.AiService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/ai")
@Tag(name = "AI", description = "AI-powered assistance endpoints")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;

    @PostMapping("/chat-org")
    public ApiResponse<AiChatResponse> chatOrg(@RequestBody AiChatRequest request) {
        String result = aiService.processOrgChat(request.getMessage());
        AiChatResponse response = AiChatResponse.builder()
                .text(result)
                .build();
        return ApiResponse.success(response);
    }

    @PostMapping("/chat-org-unit")
    public ApiResponse<AiChatResponse> chatOrgUnit(@RequestBody AiChatRequest request) {
        String result = aiService.processOrgUnitChat(request.getMessage());
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
}