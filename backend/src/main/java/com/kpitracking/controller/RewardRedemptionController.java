package com.kpitracking.controller;

import com.kpitracking.dto.request.reward.CreateRedemptionRequest;
import com.kpitracking.dto.request.reward.RedemptionDecisionRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.reward.RedemptionResponse;
import com.kpitracking.enums.RedemptionStatus;
import com.kpitracking.service.reward.RewardRedemptionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reward-redemptions")
@RequiredArgsConstructor
public class RewardRedemptionController {

    private final RewardRedemptionService redemptionService;

    @GetMapping("/me")
    @PreAuthorize("hasAuthority('GIFT:REDEEM')")
    public ResponseEntity<ApiResponse<PageResponse<RedemptionResponse>>> getMyRedemptions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(redemptionService.getMyRedemptions(page, size)));
    }

    /**
     * Đặt đổi quà. Điểm bị trừ và tồn kho bị giữ NGAY tại đây, không đợi được duyệt —
     * nếu không, cùng một số điểm có thể dùng cho nhiều yêu cầu song song.
     */
    @PostMapping
    @PreAuthorize("hasAuthority('GIFT:REDEEM')")
    public ResponseEntity<ApiResponse<RedemptionResponse>> redeem(
            @Valid @RequestBody CreateRedemptionRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Đã gửi yêu cầu đổi quà", redemptionService.redeem(request)));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('GIFT:REDEEM')")
    public ResponseEntity<ApiResponse<RedemptionResponse>> cancel(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                "Đã huỷ yêu cầu và hoàn lại điểm", redemptionService.cancel(id)));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('GIFT:FULFILL')")
    public ResponseEntity<ApiResponse<PageResponse<RedemptionResponse>>> search(
            @RequestParam(required = false) RedemptionStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(redemptionService.search(status, page, size)));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAuthority('GIFT:FULFILL')")
    public ResponseEntity<ApiResponse<RedemptionResponse>> approve(
            @PathVariable UUID id, @RequestBody(required = false) RedemptionDecisionRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Đã duyệt yêu cầu đổi quà", redemptionService.approve(id, request)));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAuthority('GIFT:FULFILL')")
    public ResponseEntity<ApiResponse<RedemptionResponse>> reject(
            @PathVariable UUID id, @RequestBody(required = false) RedemptionDecisionRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Đã từ chối và hoàn lại điểm cho nhân viên", redemptionService.reject(id, request)));
    }

    @PostMapping("/{id}/deliver")
    @PreAuthorize("hasAuthority('GIFT:FULFILL')")
    public ResponseEntity<ApiResponse<RedemptionResponse>> deliver(
            @PathVariable UUID id, @RequestBody(required = false) RedemptionDecisionRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Đã đánh dấu giao quà", redemptionService.deliver(id, request)));
    }
}
