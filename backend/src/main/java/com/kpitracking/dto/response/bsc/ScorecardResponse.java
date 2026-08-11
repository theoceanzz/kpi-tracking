package com.kpitracking.dto.response.bsc;

import com.kpitracking.enums.BscEmptyPerspectivePolicy;
import com.kpitracking.enums.BscScorecardStatus;
import com.kpitracking.enums.BscScoringMode;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ScorecardResponse {
    private UUID id;
    private String name;
    private String vision;
    private UUID kpiPeriodId;
    private String kpiPeriodName;
    /** Các phòng ban áp dụng; RỖNG = thẻ điểm mặc định toàn tổ chức. */
    private List<ScorecardOrgUnitResponse> orgUnits;
    /** Nhãn gộp tên các phòng ban (tiện hiển thị); null nếu là mặc định toàn tổ chức. */
    private String orgUnitName;
    private BscScorecardStatus status;
    private BscScoringMode scoringMode;
    private BscEmptyPerspectivePolicy emptyPerspectivePolicy;
    private List<ScorecardPerspectiveResponse> perspectives;
    private Double totalWeight;
    private Instant createdAt;
    private Instant updatedAt;
}
