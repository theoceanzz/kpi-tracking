package com.kpitracking.controller;

import com.kpitracking.dto.request.kpi.KpiCycleRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.kpi.KpiCycleResponse;
import com.kpitracking.service.KpiCycleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/kpi-cycles")
@RequiredArgsConstructor
public class KpiCycleController {

    private final KpiCycleService kpiCycleService;
    private final com.kpitracking.service.KpiCycleLockService kpiCycleLockService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<PageResponse<KpiCycleResponse>>> getKpiCycles(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "startDate") String sortBy,
            @RequestParam(defaultValue = "desc") String direction,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) com.kpitracking.enums.KpiFrequency cycleType,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME) java.time.Instant startDate,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME) java.time.Instant endDate,
            @RequestParam(required = false) UUID organizationId) {

        PageResponse<KpiCycleResponse> response = kpiCycleService.getKpiCycles(
                page, size, sortBy, direction, keyword, cycleType, startDate, endDate, organizationId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('KPI_CYCLE:CREATE')")
    public ResponseEntity<ApiResponse<KpiCycleResponse>> createKpiCycle(
            @RequestBody @jakarta.validation.Valid KpiCycleRequest request) {
        return ResponseEntity.ok(ApiResponse.success(kpiCycleService.createKpiCycle(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('KPI_CYCLE:UPDATE')")
    public ResponseEntity<ApiResponse<KpiCycleResponse>> updateKpiCycle(
            @PathVariable UUID id,
            @RequestBody @jakarta.validation.Valid KpiCycleRequest request) {
        return ResponseEntity.ok(ApiResponse.success(kpiCycleService.updateKpiCycle(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('KPI_CYCLE:DELETE')")
    public ResponseEntity<ApiResponse<Void>> deleteKpiCycle(@PathVariable UUID id) {
        kpiCycleService.deleteKpiCycle(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // ── Khoá kỳ ──────────────────────────────────────────────────────────────

    // Kỳ KHÔNG khoá/mở lại qua đây: chỉ khoá kết quả ở đơn vị gốc mới khoá kỳ (và mở khoá ở đó mới
    // mở lại kỳ) — xem KpiCycleEvaluationController. Endpoint dưới phục vụ hộp thoại khoá kết quả.

    /** Phân loại từng đợt + kỳ đích hợp lệ, để chọn cách xử lý các đợt dở trước khi khoá. */
    @GetMapping("/{id}/lock-preview")
    @PreAuthorize("hasAuthority('CYCLE_EVAL:FINALIZE')")
    public ResponseEntity<ApiResponse<com.kpitracking.dto.response.kpi.lock.CycleLockPreviewResponse>> lockPreview(
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(kpiCycleLockService.preview(id)));
    }

    /** Lịch sử khoá / gia hạn / mở lại / xử lý đợt của kỳ. */
    @GetMapping("/{id}/events")
    @PreAuthorize("hasAuthority('KPI_CYCLE:VIEW')")
    public ResponseEntity<ApiResponse<java.util.List<com.kpitracking.dto.response.kpi.lock.KpiCycleEventResponse>>> events(
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(kpiCycleLockService.events(id)));
    }
}
