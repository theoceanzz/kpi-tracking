package com.kpitracking.repository;

import com.kpitracking.entity.DiscussionMention;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface DiscussionMentionRepository extends JpaRepository<DiscussionMention, DiscussionMention.Key> {

    List<DiscussionMention> findByCommentIdIn(Collection<UUID> commentIds);

    @Modifying
    @Query("DELETE FROM DiscussionMention m WHERE m.commentId = :commentId")
    void deleteByCommentId(@Param("commentId") UUID commentId);
}
