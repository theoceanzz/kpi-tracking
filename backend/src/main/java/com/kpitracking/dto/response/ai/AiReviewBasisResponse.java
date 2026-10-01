package com.kpitracking.dto.response.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Một căn cứ của nhận xét AI: dòng bộ tiêu chí ({@code CRITERIA}) hoặc đoạn quy chế trong kho
 * ({@code REGULATION}), kèm đoạn văn GỐC do hệ thống tra — không phải chữ mô hình viết.
 *
 * @param verified đoạn gốc khớp tài liệu (máy đối chiếu hoặc người duyệt đã xác nhận dòng)
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AiReviewBasisResponse(String ref, String kind, String title, String source, String excerpt,
                                    boolean verified) {}
