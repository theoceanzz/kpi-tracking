package com.kpitracking.entity.form;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Một phương án của widget Chọn một / Chọn nhiều. {@code id} cố định — điều kiện duyệt và giá trị đã nộp trỏ vào đây. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record FormOption(String id, String label) {}
