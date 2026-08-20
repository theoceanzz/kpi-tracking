package com.kpitracking.dto.response.kpi;

import lombok.*;

import java.util.UUID;

/**
 * Một dòng trong bảng xếp hạng chốt kỳ.
 *
 * <p>Chỉ giữ phần cần để xếp hạng và nhận ra người; chi tiết từng đợt vẫn nằm ở
 * {@link CycleUserEvaluationResponse} khi mở phiếu của riêng người đó.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CycleUserRankResponse {

    private UUID userId;
    private String userName;
    private String userAvatarUrl;
    private String orgUnitName;

    private Double finalScore;
    private Double qualScore;
    private Integer matrixRating;

    /** Hạng trong phạm vi người gọi nhìn thấy, 1 là cao nhất. Bằng null khi chưa có điểm. */
    private Integer rank;
}
