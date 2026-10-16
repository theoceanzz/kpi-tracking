package com.kpitracking.repository;

import com.kpitracking.entity.DocumentPublicLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentPublicLinkRepository extends JpaRepository<DocumentPublicLink, UUID> {

    Optional<DocumentPublicLink> findByTokenHash(String tokenHash);

    List<DocumentPublicLink> findByDocumentIdOrderByCreatedAtDesc(UUID documentId);

    Optional<DocumentPublicLink> findByIdAndDocumentId(UUID id, UUID documentId);

    /** Số lần một người đã gửi kể từ mốc — chặn dùng hệ thống để rải thư hàng loạt. */
    long countByCreatedByAndCreatedAtAfter(UUID createdBy, Instant since);

    /** Tăng lượt mở bằng một câu UPDATE — không nạp/ghi cả dòng, hai người mở cùng lúc không đè nhau. */
    @Modifying
    @Query("UPDATE DocumentPublicLink l SET l.viewCount = l.viewCount + 1, l.lastViewedAt = :now WHERE l.id = :id")
    void markViewed(@Param("id") UUID id, @Param("now") Instant now);
}
