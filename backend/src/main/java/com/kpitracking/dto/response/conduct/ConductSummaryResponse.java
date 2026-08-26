package com.kpitracking.dto.response.conduct;

import com.kpitracking.enums.ConductStatus;
import lombok.*;

import java.util.UUID;

/** Một dòng trong danh sách chấm hạnh kiểm của đơn vị (mỗi nhân sự một dòng). */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ConductSummaryResponse {
    private UUID userId;
    private String userName;
    private String userAvatarUrl;
    private String roleName;
    private UUID orgUnitId;
    private String orgUnitName;

    private ConductStatus status;
    private Double selfScore;
    private Double managerScore;
    private Double maxScore;
}
