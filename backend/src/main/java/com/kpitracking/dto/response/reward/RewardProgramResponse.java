package com.kpitracking.dto.response.reward;

import com.kpitracking.dto.request.reward.RewardProgramRequest;
import com.kpitracking.enums.RewardProgramScope;
import com.kpitracking.enums.RewardRankWithin;
import com.kpitracking.enums.RewardRankingMetric;
import com.kpitracking.enums.RewardTiePolicy;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class RewardProgramResponse {

    private UUID id;
    private String name;
    private String description;

    private RewardProgramScope scope;
    private UUID orgUnitId;
    private String orgUnitName;

    /** Null = chương trình dùng cho mọi kỳ/đợt. */
    private UUID fixedTargetId;
    private String fixedTargetName;

    private RewardRankWithin rankWithin;
    private RewardRankingMetric metric;
    private RewardTiePolicy tiePolicy;

    private Double minMetricValue;
    private Integer maxPointsPerRun;
    private Boolean includeUnitHeads;

    private List<RewardProgramRequest.Tier> tiers;

    private Boolean enabled;
    private Boolean autoTrigger;
    private Instant createdAt;

    /** Số lần đã PHÁT thưởng — lớn hơn 0 thì chương trình bị khoá xoá. */
    private Integer issuedRunCount;
}
