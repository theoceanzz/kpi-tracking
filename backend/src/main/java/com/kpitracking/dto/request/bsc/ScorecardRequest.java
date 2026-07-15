package com.kpitracking.dto.request.bsc;

import com.kpitracking.enums.BscEmptyPerspectivePolicy;
import com.kpitracking.enums.BscScorecardStatus;
import com.kpitracking.enums.BscScoringMode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ScorecardRequest {
    @NotBlank
    private String name;
    private String vision;
    @NotNull
    private UUID kpiPeriodId;
    private BscScorecardStatus status;
    private BscScoringMode scoringMode;
    private BscEmptyPerspectivePolicy emptyPerspectivePolicy;
    /** Danh sách viễn cảnh + trọng số (%). Tổng phải = 100 nếu có ít nhất 1 viễn cảnh. */
    private List<ScorecardPerspectiveWeightRequest> perspectives;
}
