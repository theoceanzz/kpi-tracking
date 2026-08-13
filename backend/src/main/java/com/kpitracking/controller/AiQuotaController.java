package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.ai.AiQuotaAllocationResponse;
import com.kpitracking.dto.response.ai.AiQuotaOverviewResponse;
import com.kpitracking.dto.response.ai.AiQuotaStatusResponse;
import com.kpitracking.entity.User;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.service.AiQuotaAllocationService;
import com.kpitracking.service.AiQuotaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ai/quota")
@RequiredArgsConstructor
@Tag(name = "AI Quota", description = "Hạn mức token AI theo tháng")
public class AiQuotaController {

    private final AiQuotaService aiQuotaService;
    private final AiQuotaAllocationService allocationService;
    private final UserRepository userRepository;

    @GetMapping("/me")
    @Operation(summary = "Hạn mức token của chính mình trong tháng này")
    public ResponseEntity<ApiResponse<AiQuotaStatusResponse>> myQuota() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User me = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));

        AiQuotaService.QuotaStatus s = aiQuotaService.getStatus(me.getId());
        return ResponseEntity.ok(ApiResponse.success(AiQuotaStatusResponse.builder()
                .monthlyLimit(s.monthlyLimit())
                .allocatedToOthers(s.allocatedToOthers())
                .spendable(s.spendable())
                .used(s.used())
                .remaining(s.remaining())
                .build()));
    }

    @GetMapping("/overview")
    @Operation(summary = "Tổng quan phân bổ: túi được chia, đã chia, còn lại")
    public ResponseEntity<ApiResponse<AiQuotaOverviewResponse>> overview() {
        return ResponseEntity.ok(ApiResponse.success(allocationService.getOverview()));
    }

    @GetMapping("/allocations")
    @Operation(summary = "Danh sách người được phép cấp hạn mức, có phân trang và lọc")
    public ResponseEntity<ApiResponse<PageResponse<AiQuotaAllocationResponse>>> allocations(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String roleName,
            /** UNALLOCATED | ALLOCATED | NEAR_LIMIT — bỏ trống là lấy tất cả. */
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                allocationService.getAllocatableUsers(keyword, roleName, status, page, size)));
    }

    @PutMapping("/allocations/{userId}")
    @Operation(summary = "Đặt hạn mức token tháng cho một người")
    public ResponseEntity<ApiResponse<Void>> setLimit(@PathVariable UUID userId,
                                                      @RequestBody Map<String, Long> body) {
        Long limit = body.get("monthlyLimit");
        allocationService.setUserLimit(userId, limit != null ? limit : 0L);
        return ResponseEntity.ok(ApiResponse.success("Đã cập nhật hạn mức"));
    }

    @PutMapping("/delegation")
    @Operation(summary = "Bật/tắt cho phép quản lý cấp dưới tự phân bổ")
    public ResponseEntity<ApiResponse<Void>> setDelegation(@RequestBody Map<String, Boolean> body) {
        allocationService.setSubDelegation(Boolean.TRUE.equals(body.get("enabled")));
        return ResponseEntity.ok(ApiResponse.success("Đã cập nhật"));
    }
}
