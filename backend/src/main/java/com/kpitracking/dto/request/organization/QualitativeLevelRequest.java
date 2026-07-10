package com.kpitracking.dto.request.organization;

import lombok.Data;
import java.util.UUID;

@Data
public class QualitativeLevelRequest {
    private UUID id;
    private String name;
    private Double value;
    private Integer position;
    private String color;
}
