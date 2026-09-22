package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.kpi.CycleApprovalStepResponse;
import com.kpitracking.dto.response.kpi.CycleUnitEvaluationResponse;
import com.kpitracking.dto.response.kpi.CycleUnitStatusResponse;
import com.kpitracking.dto.response.kpi.CycleUserEvaluationResponse;
import com.kpitracking.dto.response.kpi.CycleUserRankResponse;
import com.kpitracking.service.KpiCycleEvaluationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/kpi-cycles/{cycleId}/evaluation")
@RequiredArgsConstructor
public class KpiCycleEvaluationController {

    private final KpiCycleEvaluationService kpiCycleEvaluationService;
    private final com.kpitracking.service.CycleEvaluationMailer cycleEvaluationMailer;

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
        // Có KEY "matrixRating" mới là muốn đụng tới hạng đặt tay (null = bỏ ghi đè); thiếu key
        // thì giữ nguyên — modal chấm bình thường không được vô tình xoá kết quả hiệu chỉnh.
        boolean touchRating = body != null && body.containsKey("matrixRating");
        Object rawRating = touchRating ? body.get("matrixRating") : null;
        Integer matrixRating = rawRating instanceof Number ? ((Number) rawRating).intValue() : null;
        return ResponseEntity.ok(ApiResponse.success(
                kpiCycleEvaluationService.saveUserCycleScore(cycleId, userId, finalScore, qualScore, comment,
                        touchRating, matrixRating)));
    }

    /**
     * Trạng thái chốt kỳ của mọi đơn vị trong phạm vi người gọi — dùng cho bảng theo dõi
     * "đơn vị nào đã chốt, đơn vị nào đang chặn". Không kèm danh sách thành viên.
     */
    @GetMapping("/units")
    @PreAuthorize("hasAuthority('CYCLE_EVAL:VIEW')")
    public ResponseEntity<ApiResponse<List<CycleUnitStatusResponse>>> listUnitStatuses(
            @PathVariable UUID cycleId) {
        return ResponseEntity.ok(ApiResponse.success(
                kpiCycleEvaluationService.listUnitStatuses(cycleId)));
    }

    /** Bảng xếp hạng chốt kỳ của mọi nhân sự trong phạm vi người gọi. */
    @GetMapping("/users")
    @PreAuthorize("hasAuthority('CYCLE_EVAL:VIEW')")
    public ResponseEntity<ApiResponse<List<CycleUserRankResponse>>> listUserRankings(
            @PathVariable UUID cycleId) {
        return ResponseEntity.ok(ApiResponse.success(
                kpiCycleEvaluationService.listUserRankings(cycleId)));
    }

    @GetMapping("/units/{orgUnitId}")
    @PreAuthorize("hasAuthority('CYCLE_EVAL:VIEW')")
    public ResponseEntity<ApiResponse<CycleUnitEvaluationResponse>> getUnitSummary(
            @PathVariable UUID cycleId, @PathVariable UUID orgUnitId) {
        return ResponseEntity.ok(ApiResponse.success(
                kpiCycleEvaluationService.getUnitCycleSummary(cycleId, orgUnitId)));
    }

    /**
     * Chấm tay điểm CẢ ĐƠN VỊ (ghi đè TB thành viên). {@code score} null = bỏ ghi đè.
     * Cùng quyền với chốt kỳ: người chấm được điểm đơn vị cũng là người chịu trách nhiệm chốt.
     */
    @PutMapping("/units/{orgUnitId}/score")
    @PreAuthorize("hasAuthority('CYCLE_EVAL:FINALIZE')")
    public ResponseEntity<ApiResponse<CycleUnitEvaluationResponse>> saveUnitScore(
            @PathVariable UUID cycleId, @PathVariable UUID orgUnitId,
            @RequestBody Map<String, Object> body) {
        Object rawScore = body != null ? body.get("score") : null;
        Double score = rawScore instanceof Number ? ((Number) rawScore).doubleValue() : null;
        Object rawReason = body != null ? body.get("reason") : null;
        String reason = rawReason != null ? rawReason.toString() : null;
        return ResponseEntity.ok(ApiResponse.success(
                kpiCycleEvaluationService.saveUnitCycleScore(cycleId, orgUnitId, score, reason)));
    }

    /** Chuỗi duyệt từ đơn vị đang xem lên tới gốc, kèm lịch sử chốt/mở khoá. */
    @GetMapping("/units/{orgUnitId}/chain")
    @PreAuthorize("hasAuthority('CYCLE_EVAL:VIEW')")
    public ResponseEntity<ApiResponse<List<CycleApprovalStepResponse>>> getApprovalChain(
            @PathVariable UUID cycleId, @PathVariable UUID orgUnitId) {
        return ResponseEntity.ok(ApiResponse.success(
                kpiCycleEvaluationService.getApprovalChain(cycleId, orgUnitId)));
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

    /** Gửi kết quả đánh giá kỳ qua email cho các nhân viên được chọn. */
    @PostMapping("/units/{orgUnitId}/send")
    @PreAuthorize("hasAuthority('CYCLE_EVAL:SEND')")
    public ResponseEntity<ApiResponse<KpiCycleEvaluationService.SendCycleEvaluationResult>> sendEvaluation(
            @PathVariable UUID cycleId, @PathVariable UUID orgUnitId,
            @RequestBody Map<String, Object> body) {
        Object raw = body != null ? body.get("userIds") : null;
        List<UUID> userIds = raw instanceof List<?> list
                ? list.stream().map(Object::toString).map(UUID::fromString).toList()
                : List.of();
        return ResponseEntity.ok(ApiResponse.success(
                cycleEvaluationMailer.send(cycleId, orgUnitId, userIds)));
    }

    /**
     * Mở khoá lùi một bước (FINALIZED → CALIBRATING → DRAFT). {@code cascade=true} mở luôn các
     * đơn vị con đang khoá kết quả.
     */
    @PostMapping("/units/{orgUnitId}/reopen")
    @PreAuthorize("hasAuthority('CYCLE_EVAL:FINALIZE')")
    public ResponseEntity<ApiResponse<CycleUnitEvaluationResponse>> reopenUnit(
            @PathVariable UUID cycleId, @PathVariable UUID orgUnitId,
            @RequestParam(defaultValue = "false") boolean cascade) {
        return ResponseEntity.ok(ApiResponse.success(
                kpiCycleEvaluationService.reopenUnitCycle(cycleId, orgUnitId, cascade)));
    }

    /** Bước 1: chốt dữ liệu kỳ — đóng đầu vào, chụp điểm nền, chuyển sang hiệu chỉnh. */
    @PostMapping("/units/{orgUnitId}/calibrate")
    @PreAuthorize("hasAuthority('CYCLE_EVAL:FINALIZE')")
    public ResponseEntity<ApiResponse<CycleUnitEvaluationResponse>> startCalibration(
            @PathVariable UUID cycleId, @PathVariable UUID orgUnitId) {
        return ResponseEntity.ok(ApiResponse.success(
                kpiCycleEvaluationService.startCalibration(cycleId, orgUnitId)));
    }

    /** Bước 3: phân bố vs khung bell curve + đề xuất nắn điểm cá nhân. */
    @GetMapping("/units/{orgUnitId}/calibration")
    @PreAuthorize("hasAuthority('CYCLE_EVAL:VIEW')")
    public ResponseEntity<ApiResponse<com.kpitracking.service.UnitClassificationService.CalibrationPlan>> getCalibration(
            @PathVariable UUID cycleId, @PathVariable UUID orgUnitId) {
        return ResponseEntity.ok(ApiResponse.success(
                kpiCycleEvaluationService.getCalibrationPlan(cycleId, orgUnitId)));
    }
}
