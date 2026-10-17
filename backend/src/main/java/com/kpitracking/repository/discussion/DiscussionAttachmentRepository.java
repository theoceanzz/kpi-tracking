package com.kpitracking.repository.discussion;

import com.kpitracking.entity.discussion.DiscussionAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface DiscussionAttachmentRepository extends JpaRepository<DiscussionAttachment, UUID> {

    List<DiscussionAttachment> findByCommentIdInOrderByCreatedAtAsc(Collection<UUID> commentIds);
}
