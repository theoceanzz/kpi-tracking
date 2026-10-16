package com.kpitracking.dto.response.document;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Một lần gửi tài liệu qua email — link công khai đi kèm, ai nhận, còn mở được không, đã mở mấy lần. */
public record DocumentPublicLinkResponse(UUID id, List<String> recipients, String subject, String senderName,
                                         Instant createdAt, Instant expiresAt, Instant revokedAt,
                                         int viewCount, Instant lastViewedAt, boolean active) {}
