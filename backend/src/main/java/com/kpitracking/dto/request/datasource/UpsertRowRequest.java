package com.kpitracking.dto.request.datasource;

import lombok.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UpsertRowRequest {

    private UUID id; // null = create new row, present = update existing row

    // Map of columnId -> cell value
    private Map<String, CellValueRequest> cells;
}
