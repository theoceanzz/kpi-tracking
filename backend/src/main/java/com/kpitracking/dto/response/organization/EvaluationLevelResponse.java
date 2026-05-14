package com.kpitracking.dto.response.organization;

import lombok.Data;
import java.util.UUID;

@Data
public class EvaluationLevelResponse {
    private UUID id;
    private String name;
    private Double threshold;
    private String color;
}
