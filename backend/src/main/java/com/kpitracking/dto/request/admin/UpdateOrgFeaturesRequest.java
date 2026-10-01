package com.kpitracking.dto.request.admin;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class UpdateOrgFeaturesRequest {

    private Boolean enableAi;
    private Boolean enableOkr;
    private Boolean enableWaterfall;
    /** AI đánh giá bài nộp — trọng số do tổ chức tự đặt ở màn cấu hình của họ. */
    private Boolean enableAiReview;
}
