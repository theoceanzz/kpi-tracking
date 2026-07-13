package com.kpitracking.controller;

import com.kpitracking.dto.request.evaluation.CreateEvaluationRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.evaluation.EvaluationResponse;
import com.kpitracking.service.EvaluationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/evaluations")
@RequiredArgsConstructor
@Tag(name = "Evaluations", description = "KPI Evaluation endpoints")
public class EvaluationController {

    private final EvaluationService evaluationService;

    @PostMapping
    @PreAuthorize("hasAuthority('EVALUATION:CREATE')")
    @Operation(summary = "Create evaluation")
    public ResponseEntity<ApiResponse<EvaluationResponse>> createEvaluation(
            @Valid @RequestBody CreateEvaluationRequest request) {
        EvaluationResponse response = evaluationService.createEvaluation(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Evaluation created successfully", response));
    }

    @GetMapping
    @Operation(summary = "List evaluations with optional filters")
    public ResponseEntity<ApiResponse<PageResponse<EvaluationResponse>>> getEvaluations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) UUID kpiPeriodId,
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        PageResponse<EvaluationResponse> response = evaluationService.getEvaluations(page, size, sortBy, sortDir, userId, kpiPeriodId, orgUnitId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/{evaluationId}")
    @Operation(summary = "Get evaluation by ID")
    public ResponseEntity<ApiResponse<EvaluationResponse>> getEvaluation(@PathVariable UUID evaluationId) {
        EvaluationResponse response = evaluationService.getEvaluationById(evaluationId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/system-score")
    @Operation(summary = "Get system calculated score for a given KPI period")
    public ResponseEntity<ApiResponse<Double>> getSystemScore(
            @RequestParam UUID kpiPeriodId,
            @RequestParam(required = false) UUID userId) {
        Double score = evaluationService.getSystemScore(kpiPeriodId, userId);
        return ResponseEntity.ok(ApiResponse.success(score));
    }

    @GetMapping("/score-preview")
    @Operation(summary = "Get computed scores (system + behavior + matrix rating) for a period")
    public ResponseEntity<ApiResponse<com.kpitracking.dto.response.evaluation.EvaluationScorePreview>> getScorePreview(
            @RequestParam UUID kpiPeriodId,
            @RequestParam(required = false) UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(evaluationService.getScorePreview(kpiPeriodId, userId)));
    }
}
