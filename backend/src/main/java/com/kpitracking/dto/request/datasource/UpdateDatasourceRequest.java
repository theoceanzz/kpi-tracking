package com.kpitracking.dto.request.datasource;

import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UpdateDatasourceRequest {

    private String name;
    private String description;
    private String icon;
}
