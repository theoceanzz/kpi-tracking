package com.kpitracking.repository.discussion;

import com.kpitracking.entity.discussion.DiscussionReaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface DiscussionReactionRepository extends JpaRepository<DiscussionReaction, DiscussionReaction.Key> {

    List<DiscussionReaction> findByCommentIdIn(Collection<UUID> commentIds);
}
