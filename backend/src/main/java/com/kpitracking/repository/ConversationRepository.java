package com.kpitracking.repository;

import com.kpitracking.entity.Conversation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, UUID> {

    Page<Conversation> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    /** Ghim lên đầu (ghim mới nhất trước), còn lại theo ngày tạo giảm dần. */
    @Query("""
            SELECT c FROM Conversation c
            WHERE c.user.id = :userId
            ORDER BY CASE WHEN c.pinnedAt IS NULL THEN 1 ELSE 0 END, c.pinnedAt DESC, c.createdAt DESC
            """)
    Page<Conversation> findByUserIdPinnedFirst(@Param("userId") UUID userId, Pageable pageable);

    /**
     * Khôi phục sau khi xoá mềm (nút "Hoàn tác" trên toast). Native vì entity mang
     * {@code @SQLRestriction("deleted_at IS NULL")}, dòng đã xoá không tìm thấy bằng JPA được nữa.
     */
    @Modifying
    @Query(value = "UPDATE conversations SET deleted_at = NULL WHERE id = :id AND user_id = :userId AND deleted_at IS NOT NULL",
            nativeQuery = true)
    int restore(@Param("id") UUID id, @Param("userId") UUID userId);
}
