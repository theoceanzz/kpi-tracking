package com.kpitracking.dto.response.bsc;

/**
 * Kết quả kiểm tra trước khi xoá một bộ tiêu chí.
 *
 * @param reason câu giải thích (theo ngôn ngữ của request) khi không xoá được; null khi xoá được
 */
public record DeleteCheckResponse(boolean deletable, String reason) {}
