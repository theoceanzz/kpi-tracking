package com.kpitracking.controller;

import com.kpitracking.dto.request.wallet.*;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.wallet.*;
import com.kpitracking.service.wallet.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/cash")
@RequiredArgsConstructor
public class CashWalletController {

    private final CashQueryService queryService;
    private final TopupOrderService topupService;
    private final PointConversionService conversionService;
    private final SepayReconcileService reconcileService;

    // ===== Ví của tôi =====

    @GetMapping("/me")
    @PreAuthorize("hasAuthority('WALLET:VIEW_MY')")
    public ResponseEntity<ApiResponse<CashWalletResponse>> getMyWallet() {
        return ResponseEntity.ok(ApiResponse.success(queryService.getMyWallet()));
    }

    @GetMapping("/me/transactions")
    @PreAuthorize("hasAuthority('WALLET:VIEW_MY')")
    public ResponseEntity<ApiResponse<PageResponse<CashTransactionResponse>>> getMyTransactions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(queryService.getMyTransactions(page, size)));
    }

    // ===== Nạp tiền =====

    @PostMapping("/topups")
    @PreAuthorize("hasAuthority('WALLET:VIEW_MY')")
    public ResponseEntity<ApiResponse<TopupOrderResponse>> createTopup(
            @Valid @RequestBody CreateTopupRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Đã tạo đơn nạp tiền, vui lòng chuyển khoản theo mã QR",
                topupService.create(request)));
    }

    @GetMapping("/topups/me")
    @PreAuthorize("hasAuthority('WALLET:VIEW_MY')")
    public ResponseEntity<ApiResponse<PageResponse<TopupOrderResponse>>> getMyTopups(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(topupService.getMine(page, size)));
    }

    /** Giao diện hỏi lại endpoint này mỗi vài giây trong lúc chờ người dùng chuyển khoản. */
    @GetMapping("/topups/{id}")
    @PreAuthorize("hasAuthority('WALLET:VIEW_MY')")
    public ResponseEntity<ApiResponse<TopupOrderResponse>> getTopup(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(topupService.getById(id)));
    }

    @PostMapping("/topups/{id}/cancel")
    @PreAuthorize("hasAuthority('WALLET:VIEW_MY')")
    public ResponseEntity<ApiResponse<TopupOrderResponse>> cancelTopup(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success("Đã huỷ đơn nạp tiền", topupService.cancel(id)));
    }

    // ===== Quy đổi sang điểm =====

    @GetMapping("/convert/quote")
    @PreAuthorize("hasAuthority('WALLET:VIEW_MY')")
    public ResponseEntity<ApiResponse<ConversionQuoteResponse>> quote(@RequestParam int points) {
        return ResponseEntity.ok(ApiResponse.success(conversionService.quote(points)));
    }

    @PostMapping("/convert")
    @PreAuthorize("hasAuthority('WALLET:VIEW_MY')")
    public ResponseEntity<ApiResponse<ConversionQuoteResponse>> convert(
            @Valid @RequestBody ConvertToPointsRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Đã quy đổi thành công sang điểm thưởng", conversionService.convert(request)));
    }

    // ===== Xem ví nhân sự =====

    @GetMapping("/wallets")
    @PreAuthorize("hasAuthority('WALLET:VIEW')")
    public ResponseEntity<ApiResponse<PageResponse<CashWalletResponse>>> searchWallets(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(defaultValue = "false") boolean onlyInconsistent,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                queryService.searchWallets(keyword, orgUnitId, onlyInconsistent, page, size)));
    }

    @GetMapping("/wallets/summary")
    @PreAuthorize("hasAuthority('WALLET:VIEW')")
    public ResponseEntity<ApiResponse<CashWalletSummaryResponse>> walletSummary() {
        return ResponseEntity.ok(ApiResponse.success(queryService.getSummary()));
    }

    @GetMapping("/users/{userId}/transactions")
    @PreAuthorize("hasAuthority('WALLET:VIEW')")
    public ResponseEntity<ApiResponse<PageResponse<CashTransactionResponse>>> getUserTransactions(
            @PathVariable UUID userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                queryService.getUserTransactions(userId, page, size)));
    }

    // ===== Cấu hình =====

    @GetMapping("/config")
    @PreAuthorize("hasAuthority('WALLET:CONFIG')")
    public ResponseEntity<ApiResponse<WalletConfigResponse>> getConfig() {
        return ResponseEntity.ok(ApiResponse.success(queryService.getConfig()));
    }

    @PutMapping("/config")
    @PreAuthorize("hasAuthority('WALLET:CONFIG')")
    public ResponseEntity<ApiResponse<WalletConfigResponse>> updateConfig(
            @Valid @RequestBody WalletConfigRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Đã lưu cấu hình ví tiền", queryService.updateConfig(request)));
    }

    // ===== Đối soát =====

    @GetMapping("/sepay-events")
    @PreAuthorize("hasAuthority('WALLET:RECONCILE')")
    public ResponseEntity<ApiResponse<PageResponse<SepayEventResponse>>> listEvents(
            @RequestParam(defaultValue = "queue") String scope,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                reconcileService.list("all".equalsIgnoreCase(scope), page, size)));
    }

    @PostMapping("/sepay-events/{id}/resolve")
    @PreAuthorize("hasAuthority('WALLET:RECONCILE')")
    public ResponseEntity<ApiResponse<SepayEventResponse>> resolveEvent(
            @PathVariable UUID id, @Valid @RequestBody ResolveSepayEventRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Đã xử lý giao dịch SePay", reconcileService.resolve(id, request)));
    }

    @GetMapping("/reconcile")
    @PreAuthorize("hasAuthority('WALLET:RECONCILE')")
    public ResponseEntity<ApiResponse<WalletReconcileResponse>> reconcile() {
        return ResponseEntity.ok(ApiResponse.success(reconcileService.reconcile()));
    }
}
