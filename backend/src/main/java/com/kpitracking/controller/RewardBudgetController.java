package com.kpitracking.controller;

import com.kpitracking.dto.request.reward.RewardBudgetRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.reward.RewardBudgetResponse;
import com.kpitracking.service.reward.RewardBudgetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reward-budgets")
@RequiredArgsConstructor
public class RewardBudgetController {

    private final RewardBudgetService budgetService;

    /**
     * Hạn mức đang hiệu lực của chính mình. Cần {@code REWARD:GRANT} chứ không phải
     * {@code REWARD:CONFIG}: người trao phải thấy mình còn bao nhiêu điểm TRƯỚC khi bấm gửi.
     * Trả về {@code null} khi chưa được cấp hạn mức.
     */
    @GetMapping("/me")
    @PreAuthorize("hasAuthority('REWARD:GRANT')")
    public ResponseEntity<ApiResponse<RewardBudgetResponse>> getMyBudget() {
        return ResponseEntity.ok(ApiResponse.success(budgetService.getMyActiveBudget()));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('REWARD:CONFIG')")
    public ResponseEntity<ApiResponse<List<RewardBudgetResponse>>> list() {
        return ResponseEntity.ok(ApiResponse.success(budgetService.listForOrg()));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('REWARD:CONFIG')")
    public ResponseEntity<ApiResponse<RewardBudgetResponse>> create(
            @Valid @RequestBody RewardBudgetRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã cấp hạn mức điểm thưởng",
                budgetService.create(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('REWARD:CONFIG')")
    public ResponseEntity<ApiResponse<RewardBudgetResponse>> update(
            @PathVariable UUID id, @Valid @RequestBody RewardBudgetRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã cập nhật hạn mức",
                budgetService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('REWARD:CONFIG')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        budgetService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Đã xoá hạn mức"));
    }
}
