package com.kpitracking.dto.request.datasource;

import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CellValueRequest {

    private String valueText;
    private Double valueNumber;
    private Boolean valueBoolean;
    private String valueDate; // ISO string
    private String valueJson; // JSON string
}
