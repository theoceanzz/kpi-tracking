package com.kpitracking.dto.response.document;

import com.kpitracking.entity.DocumentPromotionRequest.Status;
import com.kpitracking.enums.DocumentCategory;
import com.kpitracking.enums.DocumentScope;

import java.time.Instant;
import java.util.UUID;

/**
 * Một đề xuất đưa tài liệu lên. Người duyệt KHÔNG xem được tài liệu gốc qua quyền thường (vd. tài liệu cá nhân của
 * người khác) — họ xem / tải qua {@code GET /documents/promotions/{id}/file}, chỉ khi đang có quyền quyết định.
 */
public record DocumentPromotionResponse(
        UUID id,
        Status status,
        UUID documentId,
        String documentTitle,
        String fileName,
        String contentType,
        Long fileSize,
        DocumentCategory category,
        DocumentScope sourceScope,
        DocumentScope targetScope,
        UUID targetUnitId,
        String targetUnitName,
        String note,
        UUID requestedBy,
        String requestedByName,
        Instant createdAt,
        String decidedByName,
        Instant decidedAt,
        String decisionNote,
        UUID resultDocumentId,
        /** Người xem đang quyết được đề xuất này. */
        boolean canDecide,
        /** Người xem là người đề xuất và đề xuất còn chờ. */
        boolean canCancel) {}
