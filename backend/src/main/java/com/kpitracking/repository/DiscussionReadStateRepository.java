package com.kpitracking.repository;

import com.kpitracking.entity.DiscussionReadState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.UUID;

@Repository
public interface DiscussionReadStateRepository extends JpaRepository<DiscussionReadState, DiscussionReadState.Key> {

    /** Đánh dấu đã đọc tới {@code at}; không lùi mốc nếu đã đọc xa hơn (hai tab mở cùng lúc). */
    @Modifying
    @Query(value = "INSERT INTO discussion_read_states (user_id, target_type, target_id, last_read_at) " +
            "VALUES (:userId, :type, :targetId, :at) " +
            "ON CONFLICT (user_id, target_type, target_id) " +
            "DO UPDATE SET last_read_at = GREATEST(discussion_read_states.last_read_at, EXCLUDED.last_read_at)",
            nativeQuery = true)
    void markRead(@Param("userId") UUID userId, @Param("type") String type, @Param("targetId") UUID targetId,
                  @Param("at") Instant at);
}
