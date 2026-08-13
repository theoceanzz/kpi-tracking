package com.kpitracking.dto.response.reward;

import com.kpitracking.enums.RedemptionStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class RedemptionResponse {

    private UUID id;

    private UUID userId;
    private String userFullName;
    private String userEmail;
    private String userEmployeeCode;

    private UUID giftItemId;
    /** Tên quà CHỤP LẠI lúc đổi — quà đổi tên sau này không làm sai lịch sử. */
    private String giftNameSnapshot;
    private String giftImageUrl;

    private Integer quantity;
    private Integer pointsSpent;
    private RedemptionStatus status;

    private UUID handledByUserId;
    private String handledByName;
    private Instant handledAt;
    private Instant deliveredAt;

    private String note;
    private Instant createdAt;
}
