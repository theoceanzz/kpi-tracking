package com.kpitracking.repository;

import com.kpitracking.entity.DocumentUserState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface DocumentUserStateRepository extends JpaRepository<DocumentUserState, DocumentUserState.Key> {

    List<DocumentUserState> findByUserIdAndDocumentIdIn(UUID userId, Collection<UUID> documentIds);

    /** Tài liệu mở gần nhất của người này (chưa lọc quyền — tầng service lọc). */
    @Query("SELECT s FROM DocumentUserState s WHERE s.userId = :userId AND s.lastOpenedAt IS NOT NULL ORDER BY s.lastOpenedAt DESC")
    List<DocumentUserState> findRecent(@Param("userId") UUID userId, org.springframework.data.domain.Pageable page);

    @Query("SELECT s.documentId FROM DocumentUserState s WHERE s.userId = :userId AND s.favorite = true")
    List<UUID> findFavoriteIds(@Param("userId") UUID userId);

    @Query("SELECT s.documentId FROM DocumentUserState s WHERE s.userId = :userId AND s.pinned = true")
    List<UUID> findPinnedIds(@Param("userId") UUID userId);

    // Ghi kiểu upsert (ON CONFLICT): hai tab mở cùng một tài liệu cùng lúc không đụng khoá chính.

    @org.springframework.data.jpa.repository.Modifying
    @Query(value = """
            INSERT INTO document_user_states (user_id, document_id, last_opened_at) VALUES (:userId, :docId, :now)
            ON CONFLICT (user_id, document_id) DO UPDATE SET last_opened_at = EXCLUDED.last_opened_at
            """, nativeQuery = true)
    int markOpened(@Param("userId") UUID userId, @Param("docId") UUID docId, @Param("now") java.time.Instant now);

    @org.springframework.data.jpa.repository.Modifying
    @Query(value = """
            INSERT INTO document_user_states (user_id, document_id, favorite) VALUES (:userId, :docId, :value)
            ON CONFLICT (user_id, document_id) DO UPDATE SET favorite = EXCLUDED.favorite
            """, nativeQuery = true)
    int setFavorite(@Param("userId") UUID userId, @Param("docId") UUID docId, @Param("value") boolean value);

    @org.springframework.data.jpa.repository.Modifying
    @Query(value = """
            INSERT INTO document_user_states (user_id, document_id, pinned) VALUES (:userId, :docId, :value)
            ON CONFLICT (user_id, document_id) DO UPDATE SET pinned = EXCLUDED.pinned
            """, nativeQuery = true)
    int setPinned(@Param("userId") UUID userId, @Param("docId") UUID docId, @Param("value") boolean value);
}
