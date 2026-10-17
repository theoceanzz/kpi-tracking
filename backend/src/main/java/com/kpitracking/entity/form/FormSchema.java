package com.kpitracking.entity.form;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.ArrayList;
import java.util.List;

/** Form của một đơn từ: danh sách widget theo thứ tự hiện (cột của bảng nằm trong widget bảng). */
@JsonIgnoreProperties(ignoreUnknown = true)
public record FormSchema(List<FormWidget> widgets) {

    public static FormSchema empty() {
        return new FormSchema(new ArrayList<>());
    }

    public List<FormWidget> widgetsOrEmpty() {
        return widgets == null ? List.of() : widgets;
    }
}
