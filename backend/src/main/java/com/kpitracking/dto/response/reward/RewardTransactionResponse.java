package com.kpitracking.dto.response.reward;

import com.kpitracking.enums.RewardSourceType;
import com.kpitracking.enums.RewardTransactionType;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class RewardTransactionResponse {

    private UUID id;
    private Integer amount;
    private RewardTransactionType type;
    private RewardSourceType sourceType;
    private Integer balanceAfter;
    private String note;

    private UUID actorUserId;
    private String actorName;

    private Instant createdAt;
}
