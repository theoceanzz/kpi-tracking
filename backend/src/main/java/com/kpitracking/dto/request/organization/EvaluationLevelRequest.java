package com.kpitracking.dto.request.organization;

import lombok.Data;
import java.util.UUID;

@Data
public class EvaluationLevelRequest {
    private UUID id;
    private String name;
    private Double threshold;
    private String color;
}
