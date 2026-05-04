package com.kpitracking.controller;

import com.kpitracking.dto.request.ai.AiKpiSuggestionRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.ai.AiKpiSuggestionResponse;
import com.kpitracking.service.GeminiService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import com.kpitracking.dto.request.ai.AiChatRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.ai.AiChatResponse;
import com.kpitracking.service.AiService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/ai")
@Tag(name = "AI", description = "AI-powered assistance endpoints")
@RequiredArgsConstructor
public class AiController {

    private final GeminiService geminiService;

    private final AiService aiService;

    @PostMapping("/chat")
    public ApiResponse<AiChatResponse> chat(@RequestBody AiChatRequest request) {
        String result = aiService.processChat(request.getMessage());
        AiChatResponse response = AiChatResponse.builder()
                .text(result)
                .build();
        return ApiResponse.success(response);
    }

    @PostMapping("/suggest-kpi")
    @PreAuthorize("hasAuthority('AI:SUGGEST_KPI')")
    @Operation(summary = "Get KPI suggestions from AI")
    public ResponseEntity<ApiResponse<List<AiKpiSuggestionResponse>>> suggestKpi(
            @RequestBody AiKpiSuggestionRequest request) {
        List<AiKpiSuggestionResponse> suggestions = geminiService.getKpiSuggestions(
                request.getOrgUnitId(), request.getContext());
        return ResponseEntity.ok(ApiResponse.success(suggestions));
    }
}