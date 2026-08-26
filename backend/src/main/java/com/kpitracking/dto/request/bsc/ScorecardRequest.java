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
    /** Các phòng ban áp dụng bộ tiêu chí; RỖNG/null = bộ tiêu chí mặc định toàn tổ chức. */
    private List<UUID> orgUnitIds;
    private BscScorecardStatus status;
    private BscScoringMode scoringMode;
    private BscEmptyPerspectivePolicy emptyPerspectivePolicy;
    /** Danh sách lĩnh vực + trọng số (%). Tổng phải = 100 nếu có ít nhất 1 lĩnh vực. */
    private List<ScorecardPerspectiveWeightRequest> perspectives;
}
