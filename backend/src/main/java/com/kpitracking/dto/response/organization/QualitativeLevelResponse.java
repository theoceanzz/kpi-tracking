package com.kpitracking.dto.response.organization;

import lombok.Data;
import java.util.UUID;

@Data
public class QualitativeLevelResponse {
    private UUID id;
    private String name;
    private Double value;
    private Integer position;
    private String color;
}
