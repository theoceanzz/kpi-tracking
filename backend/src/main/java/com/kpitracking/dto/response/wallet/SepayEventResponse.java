package com.kpitracking.dto.response.wallet;

import com.kpitracking.enums.SepayEventStatus;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class SepayEventResponse {

    private UUID id;
    private Long sepayId;
    private String gateway;
    private Instant transactionDate;
    private String accountNumber;
    private String code;
    private String content;
    private String transferType;
    private Long transferAmount;
    private String referenceCode;

    private SepayEventStatus status;
    private Boolean amountMismatch;
    private String errorMessage;

    private UUID matchedOrderId;
    private String matchedOrderCode;
    private Long matchedOrderAmount;
    private String matchedOrderUserName;

    private Instant resolvedAt;
    private String resolvedByName;
    private String resolutionNote;
    private UUID resolutionTransactionId;

    /** Còn nằm trong hàng đợi đối soát hay không. */
    private Boolean inQueue;

    /**
     * Chưa quy được về tổ chức nào — tiền về một tài khoản chưa ai khai trong cấu
     * hình ví. Giao diện phải nói rõ điều này: nhóm sự kiện đó hiện trong hàng đợi
     * của mọi tổ chức và KHÔNG cho ghi có thẳng cho người dùng.
     */
    private Boolean unattributed;

    private Instant receivedAt;
}
