package com.kpitracking.dto.response.datasource;

import com.kpitracking.enums.ColumnDataType;
import com.kpitracking.enums.DatasourceStatus;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DatasourceResponse {

    private UUID id;
    private String name;
    private String description;
    private String icon;
    private DatasourceStatus status;
    private UUID orgUnitId;
    private String orgUnitName;
    private UUID createdById;
    private String createdByName;
    private List<DsColumnResponse> columns;
    private long rowCount;
    private Instant createdAt;
    private Instant updatedAt;
}
