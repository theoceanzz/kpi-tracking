package com.kpitracking.dto.response.ai;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

/**
 * A proactively-surfaced, rule-based KPI insight shown when a manager opens the chat.
 * {@code insightText}/{@code questionText} are filled from fixed templates (no AI), and
 * {@code context} carries the structured data used to seed follow-up question generation.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class InsightCardResponse {

    private String id;
    private String type;        // EXCEED | BELOW | SPIKE | DROP | DEADLINE_RISK
    private String severity;    // success | info | medium | high | critical
    private String title;
    private String insightText;
    private String questionText;
    private InsightContext context;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class InsightContext {
        private String entityType;   // ORG_UNIT | PERIOD
        private String entityId;
        private String entityName;
        private String metricKey;    // completion | avg_performance
        private Double value;        // current metric value (percent)
        private Double deltaPct;     // period-over-period change (percent), nullable
        private String periodLabel;  // nullable
        private Integer daysLeft;    // nullable, for DEADLINE_RISK
    }
}
