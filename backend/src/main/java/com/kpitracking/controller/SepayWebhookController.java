package com.kpitracking.controller;

import com.kpitracking.dto.request.wallet.SepayWebhookPayload;
import com.kpitracking.service.wallet.SepayWebhookService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Cổng nhận webhook biến động số dư của SePay.
 *
 * <p>Không đi qua JWT (SePay không có tài khoản trong hệ thống) nên đường dẫn này
 * được mở {@code permitAll} trong {@code SecurityConfig} và tự xác thực bằng khoá
 * API dùng chung. Đây là endpoint duy nhất của toàn hệ thống có thể làm tăng số
 * dư tiền mà không cần đăng nhập, nên mọi lớp bảo vệ đều nằm ở đây.
 *
 * <p><b>Luôn trả 200.</b> SePay chỉ cần biết là đã nhận; trả lỗi chỉ khiến họ
 * retry vô ích trong khi vấn đề thật nằm ở phía này và cần người xử lý tay. Bản
 * ghi sự kiện đã được lưu kèm lý do, và nó sẽ hiện ra ở hàng đợi đối soát.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/webhooks/sepay")
@RequiredArgsConstructor
public class SepayWebhookController {

    private final SepayWebhookService webhookService;
    private final com.kpitracking.security.audit.SecurityAuditService securityAudit;

    private void audit(String outcome, SepayWebhookPayload payload, String detail) {
        // Chỉ ghi id giao dịch + số tiền; không ghi header Authorization, không ghi nội dung CK.
        securityAudit.recordAnonymous(com.kpitracking.security.audit.SecurityAuditEvent.WALLET_WEBHOOK, outcome,
                "SEPAY_TX", String.valueOf(payload.getId()),
                detail + (payload.getTransferAmount() != null ? ", amount=" + payload.getTransferAmount() : ""));
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> receive(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @RequestHeader(value = "X-Forwarded-For", required = false) String forwardedFor,
            @RequestBody SepayWebhookPayload payload,
            HttpServletRequest servletRequest) {

        if (!webhookService.isAllowedIp(forwardedFor, servletRequest.getRemoteAddr())) {
            audit(com.kpitracking.security.audit.SecurityAuditService.BLOCKED, payload, "IP không được phép");
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("success", false, "message", "IP không được phép"));
        }

        // KHÔNG log header Authorization ở bất kỳ nhánh nào — khoá lọt vào log là
        // khoá đã lộ, và log thường được chia sẻ rộng hơn nhiều so với cấu hình.
        if (!webhookService.isAuthorized(authorization)) {
            log.warn("Webhook SePay bị từ chối do khoá API không hợp lệ, sepayId={}", payload.getId());
            audit(com.kpitracking.security.audit.SecurityAuditService.BLOCKED, payload, "Khoá API không hợp lệ");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Khoá API không hợp lệ"));
        }

        log.info("Webhook SePay nhận sepayId={} transferType={} amount={}",
                payload.getId(), payload.getTransferType(), payload.getTransferAmount());
        var status = webhookService.handle(payload);
        audit(com.kpitracking.security.audit.SecurityAuditService.OK, payload, "status=" + status.name());
        return ResponseEntity.ok(Map.of("success", true, "status", status.name()));
    }
}
