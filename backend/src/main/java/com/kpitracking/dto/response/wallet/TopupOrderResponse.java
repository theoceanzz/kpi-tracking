package com.kpitracking.dto.response.wallet;

import com.kpitracking.enums.TopupOrderStatus;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TopupOrderResponse {

    private UUID id;
    private UUID userId;
    private String fullName;

    /** Mã phải xuất hiện nguyên vẹn trong nội dung chuyển khoản. */
    private String code;

    private Long amount;
    private Long paidAmount;
    private TopupOrderStatus status;

    private String qrUrl;
    private String bankCode;
    private String bankAccountNumber;
    private String bankAccountHolder;

    private Instant expiresAt;
    private Instant paidAt;
    private Instant createdAt;
}
