package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.kpi.CycleUnitEvaluationResponse;
import com.kpitracking.dto.response.kpi.CycleUserEvaluationResponse;
import com.kpitracking.service.KpiCycleEvaluationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/kpi-cycles/{cycleId}/evaluation")
@RequiredArgsConstructor
public class KpiCycleEvaluationController {

    private final KpiCycleEvaluationService kpiCycleEvaluationService;

    @GetMapping("/users/{userId}")
    @PreAuthorize("hasAuthority('CYCLE_EVAL:VIEW')")
    public ResponseEntity<ApiResponse<CycleUserEvaluationResponse>> getUserEvaluation(
            @PathVariable UUID cycleId, @PathVariable UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(
                kpiCycleEvaluationService.getUserCycleEvaluation(cycleId, userId)));
    }

    /** Lưu điểm chốt kỳ (nhập tay) cho một nhân viên. */
    @PutMapping("/users/{userId}")
    @PreAuthorize("hasAuthority('CYCLE_EVAL:FINALIZE')")
    public ResponseEntity<ApiResponse<CycleUserEvaluationResponse>> saveUserScore(
            @PathVariable UUID cycleId, @PathVariable UUID userId,
            @RequestBody Map<String, Object> body) {
        Object rawScore = body != null ? body.get("finalScore") : null;
        Double finalScore = rawScore instanceof Number ? ((Number) rawScore).doubleValue() : null;
        Object rawQual = body != null ? body.get("qualScore") : null;
        Double qualScore = rawQual instanceof Number ? ((Number) rawQual).doubleValue() : null;
        Object rawComment = body != null ? body.get("comment") : null;
        String comment = rawComment != null ? rawComment.toString() : null;
        return ResponseEntity.ok(ApiResponse.success(
                kpiCycleEvaluationService.saveUserCycleScore(cycleId, userId, finalScore, qualScore, comment)));
    }

    @GetMapping("/units/{orgUnitId}")
    @PreAuthorize("hasAuthority('CYCLE_EVAL:VIEW')")
    public ResponseEntity<ApiResponse<CycleUnitEvaluationResponse>> getUnitSummary(
            @PathVariable UUID cycleId, @PathVariable UUID orgUnitId) {
        return ResponseEntity.ok(ApiResponse.success(
                kpiCycleEvaluationService.getUnitCycleSummary(cycleId, orgUnitId)));
    }

    @PostMapping("/units/{orgUnitId}/finalize")
    @PreAuthorize("hasAuthority('CYCLE_EVAL:FINALIZE')")
    public ResponseEntity<ApiResponse<CycleUnitEvaluationResponse>> finalizeUnit(
            @PathVariable UUID cycleId, @PathVariable UUID orgUnitId,
            @RequestBody(required = false) Map<String, String> body) {
        String comment = body != null ? body.get("comment") : null;
        return ResponseEntity.ok(ApiResponse.success(
                kpiCycleEvaluationService.finalizeUnitCycle(cycleId, orgUnitId, comment)));
    }

    /** Mở khoá đánh giá kỳ của phòng ban để chỉnh lại điểm. */
    @PostMapping("/units/{orgUnitId}/reopen")
    @PreAuthorize("hasAuthority('CYCLE_EVAL:FINALIZE')")
    public ResponseEntity<ApiResponse<CycleUnitEvaluationResponse>> reopenUnit(
            @PathVariable UUID cycleId, @PathVariable UUID orgUnitId) {
        return ResponseEntity.ok(ApiResponse.success(
                kpiCycleEvaluationService.reopenUnitCycle(cycleId, orgUnitId)));
    }
}
