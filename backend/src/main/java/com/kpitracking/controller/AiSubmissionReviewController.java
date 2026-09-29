package com.kpitracking.controller;

import com.kpitracking.dto.request.ai.AiReviewSettingsRequest;
import com.kpitracking.dto.request.ai.AiSubmissionReviewRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.ai.AiReviewReportResponse;
import com.kpitracking.dto.response.ai.AiReviewSettingsResponse;
import com.kpitracking.dto.response.ai.AiReviewUnitSettingResponse;
import com.kpitracking.dto.response.ai.AiSubmissionReviewResponse;
import com.kpitracking.service.ai.review.AiReviewAdminService;
import com.kpitracking.service.ai.review.SubmissionReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * AI đọc bài nộp và đề xuất điểm — đường RIÊNG, không qua khung chat K.AI.
 *
 * <p>Mọi endpoint chỉ đọc hoặc ghi vào bảng kết quả AI; không endpoint nào ghi {@code evaluations} hay
 * {@code kpi_submissions}. Quyền toàn cục {@code AI_REVIEW:USE} kiểm ở đây, phạm vi đơn vị kiểm trong
 * service (quyền toàn cục không đủ: quản lý chỉ xem được người mình chấm được).
 */
@RestController
@RequestMapping("/api/v1/ai/submission-reviews")
@Tag(name = "AI Submission Review", description = "AI đọc bài nộp và đề xuất điểm (tham khảo)")
@RequiredArgsConstructor
public class AiSubmissionReviewController {

    private final SubmissionReviewService reviewService;
    private final AiReviewAdminService adminService;

    @PostMapping
    @PreAuthorize("hasAuthority('AI_REVIEW:USE')")
    @Operation(summary = "Nhờ AI đọc trước bài nộp của một nhân viên trong một đợt (chạy nền)")
    public ResponseEntity<ApiResponse<AiSubmissionReviewResponse>> request(@Valid @RequestBody AiSubmissionReviewRequest request) {
        return ResponseEntity.ok(ApiResponse.success(reviewService.request(request)));
    }

    @GetMapping("/latest")
    @PreAuthorize("hasAuthority('AI_REVIEW:USE')")
    @Operation(summary = "Lượt AI đánh giá mới nhất của một nhân viên trong một đợt (null nếu chưa có)")
    public ResponseEntity<ApiResponse<AiSubmissionReviewResponse>> latest(@RequestParam UUID kpiPeriodId,
                                                                           @RequestParam UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(reviewService.latest(kpiPeriodId, userId)));
    }

    @GetMapping("/settings")
    @PreAuthorize("hasAnyAuthority('AI_REVIEW:CONFIG', 'AI_REVIEW:USE')")
    @Operation(summary = "Cấu hình AI đánh giá bài nộp của tổ chức")
    public ResponseEntity<ApiResponse<AiReviewSettingsResponse>> settings() {
        return ResponseEntity.ok(ApiResponse.success(reviewService.settings()));
    }

    @PutMapping("/settings")
    @PreAuthorize("hasAuthority('AI_REVIEW:CONFIG')")
    @Operation(summary = "Bật/tắt AI đánh giá bài nộp và đặt trọng số điểm đề xuất")
    public ResponseEntity<ApiResponse<AiReviewSettingsResponse>> updateSettings(@Valid @RequestBody AiReviewSettingsRequest request) {
        return ResponseEntity.ok(ApiResponse.success(reviewService.updateSettings(request)));
    }

    @PostMapping("/batch")
    @PreAuthorize("hasAuthority('AI_REVIEW:USE')")
    @Operation(summary = "Nhờ AI đọc trước bài nộp của cả một đơn vị (chạy nền theo lô, chỉ người mình chấm được)")
    public ResponseEntity<ApiResponse<SubmissionReviewService.BatchResult>> batch(@RequestParam UUID kpiPeriodId,
                                                                                 @RequestParam UUID orgUnitId) {
        return ResponseEntity.ok(ApiResponse.success(reviewService.batch(kpiPeriodId, orgUnitId)));
    }

    @GetMapping("/report")
    @PreAuthorize("hasAuthority('AI_REVIEW:USE')")
    @Operation(summary = "Báo cáo lệch điểm AI đề xuất so với điểm quản lý đã chốt")
    public ResponseEntity<ApiResponse<AiReviewReportResponse>> report(@RequestParam UUID kpiPeriodId,
                                                                      @RequestParam(required = false) UUID orgUnitId) {
        return ResponseEntity.ok(ApiResponse.success(adminService.report(kpiPeriodId, orgUnitId)));
    }

    @GetMapping("/unit-settings")
    @PreAuthorize("hasAuthority('AI_REVIEW:CONFIG')")
    @Operation(summary = "Các đơn vị có cấu hình AI đánh giá riêng")
    public ResponseEntity<ApiResponse<List<AiReviewUnitSettingResponse>>> unitSettings() {
        return ResponseEntity.ok(ApiResponse.success(adminService.unitSettings()));
    }

    @PutMapping("/unit-settings/{orgUnitId}")
    @PreAuthorize("hasAuthority('AI_REVIEW:CONFIG')")
    @Operation(summary = "Đặt cấu hình riêng cho một đơn vị (áp cả đơn vị con)")
    public ResponseEntity<ApiResponse<AiReviewUnitSettingResponse>> saveUnitSetting(@PathVariable UUID orgUnitId,
                                                                                   @Valid @RequestBody AiReviewSettingsRequest request) {
        return ResponseEntity.ok(ApiResponse.success(adminService.saveUnitSetting(orgUnitId, request)));
    }

    @DeleteMapping("/unit-settings/{orgUnitId}")
    @PreAuthorize("hasAuthority('AI_REVIEW:CONFIG')")
    @Operation(summary = "Bỏ cấu hình riêng — đơn vị theo lại đơn vị cha / công ty")
    public ResponseEntity<ApiResponse<Void>> deleteUnitSetting(@PathVariable UUID orgUnitId) {
        adminService.deleteUnitSetting(orgUnitId);
        return ResponseEntity.ok(ApiResponse.success("Đã bỏ cấu hình riêng của đơn vị"));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('AI_REVIEW:USE')")
    @Operation(summary = "Kết quả một lượt AI đánh giá")
    public ResponseEntity<ApiResponse<AiSubmissionReviewResponse>> get(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(reviewService.get(id)));
    }

    @PostMapping("/{id}/rerun")
    @PreAuthorize("hasAuthority('AI_REVIEW:USE')")
    @Operation(summary = "Chạy lại lượt AI đánh giá (tính vào hạn mức)")
    public ResponseEntity<ApiResponse<AiSubmissionReviewResponse>> rerun(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(reviewService.rerun(id)));
    }
}
