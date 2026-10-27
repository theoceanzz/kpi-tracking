package com.kpitracking.dto.response.wallet;

import com.kpitracking.enums.wallet.CashSourceType;
import com.kpitracking.enums.wallet.CashTransactionType;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CashTransactionResponse {

    private UUID id;
    private Long amount;
    private CashTransactionType type;
    private CashSourceType sourceType;
    private Long balanceAfter;

    /** Chỉ có ở bút toán quy đổi. */
    private Integer pointsGranted;
    private Long rateSnapshot;

    private String note;
    private UUID actorUserId;
    private String actorName;
    private Instant createdAt;
}
