package com.kpitracking.dto.request.document;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Lưu nội dung soạn trực tuyến. {@code baseHash} là {@code contentHash} của bản người soạn đã mở — khác bản hiện hành
 * nghĩa là có người lưu chen vào giữa, máy chủ trả {@code DOCUMENT_EDIT_CONFLICT} thay vì ghi đè im lặng.
 */
public record SaveDocumentContentRequest(@NotNull String content, @NotBlank String baseHash) {}
