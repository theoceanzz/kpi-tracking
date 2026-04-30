package com.kpitracking.dto.response.datasource;

import lombok.*;

import java.time.Instant;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CellValueResponse {

    private String valueText;
    private Double valueNumber;
    private Boolean valueBoolean;
    private Instant valueDate;
    private String valueJson;
}
