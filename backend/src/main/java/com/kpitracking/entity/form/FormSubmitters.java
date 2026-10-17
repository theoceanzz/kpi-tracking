package com.kpitracking.entity.form;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;
import java.util.UUID;

/** Người được nộp khi phạm vi là SPECIFIED: người cụ thể + đơn vị (gồm cả đơn vị con). */
@JsonIgnoreProperties(ignoreUnknown = true)
public record FormSubmitters(List<UUID> userIds, List<UUID> orgUnitIds) {

    public static FormSubmitters none() {
        return new FormSubmitters(List.of(), List.of());
    }

    public List<UUID> userIdsOrEmpty() {
        return userIds == null ? List.of() : userIds;
    }

    public List<UUID> orgUnitIdsOrEmpty() {
        return orgUnitIds == null ? List.of() : orgUnitIds;
    }
}
