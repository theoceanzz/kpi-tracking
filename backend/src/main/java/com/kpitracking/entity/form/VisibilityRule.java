package com.kpitracking.entity.form;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.kpitracking.service.approvalprocess.ConditionOperator;

import java.util.List;

/**
 * Điều kiện hiện một widget: so một widget Chọn / số đứng TRƯỚC nó. Các điều kiện của một widget nối bằng VÀ.
 * Widget chọn: {@code IN / NOT_IN} id phương án; widget số: {@code EQ…LTE} với một số.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record VisibilityRule(String widget, ConditionOperator operator, List<String> values) {
    public List<String> valuesOrEmpty() {
        return values == null ? List.of() : values;
    }
}
