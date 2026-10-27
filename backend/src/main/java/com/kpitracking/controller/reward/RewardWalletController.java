package com.kpitracking.controller.reward;

import com.kpitracking.dto.request.reward.RewardCelebrationAckRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.reward.RewardActivityResponse;
import com.kpitracking.dto.response.reward.RewardCelebrationResponse;
import com.kpitracking.dto.response.reward.RewardLeaderboardEntryResponse;
import com.kpitracking.dto.response.reward.RewardMonthlySummaryResponse;
import com.kpitracking.dto.response.reward.RewardTransactionResponse;
import com.kpitracking.dto.response.reward.RewardWalletResponse;
import com.kpitracking.service.reward.RewardWalletService;
import com.kpitracking.service.reward.RewardActivityService;
import com.kpitracking.service.reward.RewardCelebrationService;
import com.kpitracking.service.reward.RewardQueryService;
import jakarta.validation.Valid;
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
    private final RewardActivityService activityService;
    private final com.kpitracking.service.reward.RewardStatsService statsService;
    private final RewardCelebrationService celebrationService;

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

    /**
     * Lượt thưởng / đổi quà của tôi CHƯA được ăn mừng (hiệu ứng chúc mừng ở frontend). Xem
     * {@link RewardCelebrationService}: WebSocket chỉ báo "có thưởng mới", đây mới là nguồn sự thật.
     */
    @GetMapping("/me/celebrations")
    @PreAuthorize("hasAuthority('REWARD:VIEW_MY')")
    public ResponseEntity<ApiResponse<List<RewardCelebrationResponse>>> getMyCelebrations() {
        return ResponseEntity.ok(ApiResponse.success(celebrationService.listMine()));
    }

    /** Đánh dấu đã ăn mừng. Idempotent — gọi lại với cùng id không đổi gì. */
    @PostMapping("/me/celebrations/ack")
    @PreAuthorize("hasAuthority('REWARD:VIEW_MY')")
    public ResponseEntity<ApiResponse<Integer>> acknowledgeCelebrations(
            @Valid @RequestBody RewardCelebrationAckRequest request) {
        return ResponseEntity.ok(ApiResponse.success(celebrationService.acknowledge(request.getRefIds())));
    }

    /**
     * Bảng tin điểm thưởng của cả tổ chức.
     *
     * <p>Quyền chỉ là {@code REWARD:VIEW_MY} — quyền ai cũng có — vì tính năng chỉ có
     * nghĩa khi mọi người đều thấy. Xem phần "Ai xem được gì" ở {@link RewardActivityService}.
     */
    @GetMapping("/activity")
    @PreAuthorize("hasAuthority('REWARD:VIEW_MY')")
    public ResponseEntity<ApiResponse<List<RewardActivityResponse>>> getActivityFeed(
            @RequestParam(required = false) Integer limit) {
        return ResponseEntity.ok(ApiResponse.success(activityService.getRecentActivity(limit)));
    }

    /**
     * Nhận thưởng nhiều điểm nhất trong khoảng thời gian.
     *
     * <p>Khác {@code /activity}: bảng tin chỉ trả vài chục việc gần nhất nên không cộng
     * dồn được; ở đây tổng hợp ngay tại DB trên toàn bộ giao dịch trong khoảng.
     */
    @GetMapping("/leaderboard")
    @PreAuthorize("hasAuthority('REWARD:VIEW')")
    public ResponseEntity<ApiResponse<List<RewardLeaderboardEntryResponse>>> leaderboard(
            @RequestParam(required = false) java.time.Instant from,
            @RequestParam(required = false) java.time.Instant to,
            @RequestParam(required = false) Integer limit) {
        return ResponseEntity.ok(ApiResponse.success(statsService.leaderboard(from, to, limit)));
    }

    /** Điểm phát ra / tiêu đi theo từng tháng, gồm cả tháng không có giao dịch. */
    @GetMapping("/monthly-summary")
    @PreAuthorize("hasAuthority('REWARD:VIEW')")
    public ResponseEntity<ApiResponse<List<RewardMonthlySummaryResponse>>> monthlySummary(
            @RequestParam(required = false) Integer months) {
        return ResponseEntity.ok(ApiResponse.success(statsService.monthlySummary(months)));
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
