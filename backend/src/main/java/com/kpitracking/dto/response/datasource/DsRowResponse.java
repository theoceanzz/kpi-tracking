package com.kpitracking.dto.response.datasource;

import lombok.*;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DsRowResponse {

    private UUID id;
    private Integer rowOrder;
    // Map of columnId -> cell value object
    private Map<String, CellValueResponse> cells;
    private Instant createdAt;
}
