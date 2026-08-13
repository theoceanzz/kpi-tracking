package com.kpitracking.dto.response.reward;

import com.kpitracking.enums.RewardApprovalMode;
import com.kpitracking.enums.RewardGrantStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class RewardGrantResponse {

    private UUID id;
    private UUID orgUnitId;
    private String orgUnitName;

    private UUID grantorUserId;
    private String grantorName;

    private Integer totalPoints;
    private Integer pointsPerRecipient;
    private String reason;

    private RewardGrantStatus status;
    private RewardApprovalMode approvalMode;

    /** Vì sao đề nghị này phải qua duyệt. Hiện nguyên văn cho người trao đọc. */
    private String approvalReason;

    private UUID approverUserId;
    private String approverName;
    private Instant approvedAt;
    private String decisionNote;

    private List<Recipient> recipients;

    private Instant createdAt;

    /**
     * Chỉ có ở phản hồi lúc TẠO. Cho giao diện biết cần hiện "đã thưởng xong" hay
     * "đã gửi, chờ duyệt" — không phải đoán từ status.
     */
    private Boolean requiresApproval;

    @Data
    @Builder
    public static class Recipient {
        private UUID userId;
        private String fullName;
        private String email;
        private String employeeCode;
        private String avatarUrl;
        private Integer points;
        private UUID transactionId;
    }
}
