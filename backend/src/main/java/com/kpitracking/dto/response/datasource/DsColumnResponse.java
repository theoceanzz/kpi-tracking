package com.kpitracking.dto.response.datasource;

import com.kpitracking.enums.ColumnDataType;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DsColumnResponse {

    private UUID id;
    private String name;
    private ColumnDataType dataType;
    private Integer columnOrder;
    private Boolean isRequired;
    private String config;
}
