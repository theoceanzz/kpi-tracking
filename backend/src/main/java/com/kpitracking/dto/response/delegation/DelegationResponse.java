package com.kpitracking.dto.response.delegation;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DelegationResponse {

    private UUID id;

    private UUID delegateUserId;
    private String delegateUserName;
    private String delegateUserEmail;
    private String delegateUserAvatarUrl;
    /** Vai trò tốt nhất của người này ở đơn vị gốc — để người đọc biết ai đang kiêm nhiệm. */
    private String delegateRoleName;

    private UUID orgUnitId;
    private String orgUnitName;

    private UUID fromOrgUnitId;
    private String fromOrgUnitName;

    private Boolean includeSubtree;
    private Boolean canActAsLeader;
    private String reason;

    private Instant startsAt;
    private Instant expiresAt;

    /** Còn hiệu lực tại thời điểm gọi — UI khỏi tự so ngày. */
    private Boolean active;
    /** Chưa tới ngày bắt đầu. */
    private Boolean scheduled;
    /** Đã qua ngày hết hạn. */
    private Boolean expired;

    private String createdByName;
    private Instant createdAt;
}
