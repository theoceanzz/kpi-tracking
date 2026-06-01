package com.kpitracking.repository;

import com.kpitracking.entity.ConversationMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ConversationMessageRepository extends JpaRepository<ConversationMessage, UUID> {

    List<ConversationMessage> findByConversationIdOrderByMsgIndex(UUID conversationId);

    Page<ConversationMessage> findByConversationIdOrderByMsgIndex(UUID conversationId, Pageable pageable);

    Optional<ConversationMessage> findTopByConversationIdOrderByMsgIndexDesc(UUID conversationId);

    void deleteByConversationId(UUID conversationId);
}
