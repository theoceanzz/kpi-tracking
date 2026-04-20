package com.kpitracking.dto.request.ai;

import java.util.UUID;

public class AiKpiSuggestionRequest {
    private UUID orgUnitId;
    private String context;

    public AiKpiSuggestionRequest() {}

    public UUID getOrgUnitId() {
        return orgUnitId;
    }

    public void setOrgUnitId(UUID orgUnitId) {
        this.orgUnitId = orgUnitId;
    }

    public String getContext() {
        return context;
    }

    public void setContext(String context) {
        this.context = context;
    }
}
