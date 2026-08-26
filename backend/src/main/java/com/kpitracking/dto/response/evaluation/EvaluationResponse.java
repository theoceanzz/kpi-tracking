package com.kpitracking.dto.response.evaluation;

import com.kpitracking.dto.response.bsc.PerspectiveScoreResponse;
import com.kpitracking.enums.BscScoringMode;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class EvaluationResponse {

    private UUID id;
    private UUID userId;
    private String userName;
    private String userAvatarUrl;
    private UUID orgUnitId;
    private String orgUnitName;
    private UUID kpiPeriodId;
    private String kpiPeriodName;
    private UUID evaluatorId;
    private String evaluatorName;
    private Double score;
    private String comment;
    private Double systemScore;
    private Double behaviorScore;
    private Double kpiCompletionPercent;
    private Integer matrixRating;
    private Instant periodStart;
    private Instant periodEnd;
    private Instant createdAt;
    private Instant updatedAt;
    private String evaluatorRole;
    private Integer evaluatorRoleLevel;
    private Integer orgUnitLevel;
    private Integer userLevel;
    private Integer userRank;
    private String userRoleName;
    private String evaluatorRoleName;

    // ── BSC ────────────────────────────────────────────────────
    /** Điểm BSC (0..100), luôn lưu khi org bật BSC — kể cả ở chế độ SHADOW. */
    private Double bscScore;
    /** Chế độ chấm điểm của kỳ (SHADOW = chạy song song, OFFICIAL = bsc_score là điểm chính thức). */
    private BscScoringMode bscScoringMode;
    /** Điểm chính thức: = bscScore khi OFFICIAL, ngược lại = systemScore. */
    private Double officialScore;
    /** Breakdown điểm từng lĩnh vực (giải thích điểm cho HR). */
    private List<PerspectiveScoreResponse> bscPerspectives;
}
