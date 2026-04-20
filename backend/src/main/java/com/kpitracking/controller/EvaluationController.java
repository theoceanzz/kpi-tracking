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
            @RequestParam(required = false) UUID kpiCriteriaId) {
        PageResponse<EvaluationResponse> response = evaluationService.getEvaluations(page, size, userId, kpiCriteriaId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/{evaluationId}")
    @Operation(summary = "Get evaluation by ID")
    public ResponseEntity<ApiResponse<EvaluationResponse>> getEvaluation(@PathVariable UUID evaluationId) {
        EvaluationResponse response = evaluationService.getEvaluationById(evaluationId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
