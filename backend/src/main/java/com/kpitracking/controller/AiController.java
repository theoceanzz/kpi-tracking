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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/ai")
@Tag(name = "AI", description = "AI-powered assistance endpoints")
public class AiController {

    private final GeminiService geminiService;

    public AiController(GeminiService geminiService) {
        this.geminiService = geminiService;
    }

    @PostMapping("/suggest-kpi")
    @PreAuthorize("hasAnyRole('DIRECTOR', 'HEAD', 'DEPUTY')")
    @Operation(summary = "Get KPI suggestions from AI")
    public ResponseEntity<ApiResponse<List<AiKpiSuggestionResponse>>> suggestKpi(
            @RequestBody AiKpiSuggestionRequest request) {
        List<AiKpiSuggestionResponse> suggestions = geminiService.getKpiSuggestions(
                request.getOrgUnitId(), request.getContext());
        return ResponseEntity.ok(ApiResponse.success(suggestions));
    }
}
