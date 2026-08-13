package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.reward.RewardTransactionResponse;
import com.kpitracking.dto.response.reward.RewardWalletResponse;
import com.kpitracking.service.RewardWalletService;
import com.kpitracking.service.reward.RewardQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/rewards")
@RequiredArgsConstructor
public class RewardWalletController {

    private final RewardQueryService queryService;
    private final RewardWalletService walletService;

    @GetMapping("/me")
    @PreAuthorize("hasAuthority('REWARD:VIEW_MY')")
    public ResponseEntity<ApiResponse<RewardWalletResponse>> getMyWallet() {
        return ResponseEntity.ok(ApiResponse.success(queryService.getMyWallet()));
    }

    @GetMapping("/me/transactions")
    @PreAuthorize("hasAuthority('REWARD:VIEW_MY')")
    public ResponseEntity<ApiResponse<PageResponse<RewardTransactionResponse>>> getMyTransactions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(queryService.getMyTransactions(page, size)));
    }

    @GetMapping("/wallets")
    @PreAuthorize("hasAuthority('REWARD:VIEW')")
    public ResponseEntity<ApiResponse<PageResponse<RewardWalletResponse>>> searchWallets(
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(queryService.searchWallets(keyword, page, size)));
    }

    @GetMapping("/users/{userId}/transactions")
    @PreAuthorize("hasAuthority('REWARD:VIEW')")
    public ResponseEntity<ApiResponse<PageResponse<RewardTransactionResponse>>> getUserTransactions(
            @PathVariable UUID userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                queryService.getUserTransactions(userId, page, size)));
    }

    /**
     * Đối soát ví với sổ cái. Kết quả phải LUÔN rỗng; có phần tử nghĩa là bất biến
     * của dữ liệu kiểu tiền tệ đã vỡ và cần điều tra ngay.
     */
    @GetMapping("/reconcile")
    @PreAuthorize("hasAuthority('REWARD:CONFIG')")
    public ResponseEntity<ApiResponse<List<UUID>>> reconcile() {
        return ResponseEntity.ok(ApiResponse.success(walletService.findInconsistentWallets()));
    }
}
