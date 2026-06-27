package com.kpitracking.dto.request.admin;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class UpdateOrgFeaturesRequest {

    private Boolean enableAi;
    private Boolean enableOkr;
    private Boolean enableWaterfall;
}
