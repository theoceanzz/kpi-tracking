package com.kpitracking.dto.response.reward;

import lombok.*;

import java.util.UUID;

/** Một dòng trong bảng "nhận thưởng nhiều nhất". */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RewardLeaderboardEntryResponse {

    private UUID userId;
    private String userName;
    private String userAvatarUrl;
    /** Tổng điểm được thưởng trong khoảng thời gian đã lọc. */
    private long totalPoints;
}
