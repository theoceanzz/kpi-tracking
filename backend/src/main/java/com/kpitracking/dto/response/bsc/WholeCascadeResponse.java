package com.kpitracking.dto.response.bsc;

import com.kpitracking.enums.BscFixedPerspective;
import lombok.*;

import java.util.List;
import java.util.UUID;

/** Hiện trạng phân rã cả bộ của một thẻ nguồn: dòng đang giao đi đâu, trọng số bao nhiêu. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class WholeCascadeResponse {
    private UUID sourceScorecardId;
    /** null khi thẻ chưa từng giao cả bộ. */
    private String itemName;
    private BscFixedPerspective fixedPerspective;
    private List<Recipient> recipients;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Recipient {
        private UUID orgUnitId;
        private String orgUnitName;
        private UUID scorecardId;
        private String scorecardName;
        private UUID scorecardPerspectiveId;
        private Double weightPercentage;
        /** Tổng trọng số hiện tại của thẻ con — khác 100 thì đơn vị phải chia lại trước khi trình. */
        private Double scorecardTotalWeight;
    }
}
