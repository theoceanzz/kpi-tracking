package com.kpitracking.dto.response.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AiKpiSuggestionResponse {
    @JsonProperty("name")
    private String name;

    @JsonProperty("description")
    private String description;

    @JsonProperty("unit")
    private String unit;

    @JsonProperty("target_value")
    private Double targetValue;

    @JsonProperty("weight")
    private Double weight;

    @JsonProperty("frequency")
    private String frequency; // DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY
}
