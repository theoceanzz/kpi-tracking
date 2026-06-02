package com.kpitracking.repository;

import com.kpitracking.entity.ConversationMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Repository
public interface ConversationMessageRepository extends JpaRepository<ConversationMessage, UUID> {

    List<ConversationMessage> findByConversationIdOrderByMsgIndex(UUID conversationId);

    Page<ConversationMessage> findByConversationIdOrderByMsgIndex(UUID conversationId, Pageable pageable);

    @Modifying(clearAutomatically = true)
    @Transactional
    @Query("DELETE FROM ConversationMessage m WHERE m.conversationId = :conversationId")
    void deleteByConversationId(UUID conversationId);
}
