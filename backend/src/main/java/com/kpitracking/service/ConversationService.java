package com.kpitracking.service;

import com.kpitracking.dto.request.ai.CreateConversationRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.ai.ConversationResponse;
import com.kpitracking.dto.response.ai.MessageResponse;
import com.kpitracking.entity.Conversation;
import com.kpitracking.entity.User;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.ConversationMessageRepository;
import com.kpitracking.repository.ConversationRepository;
import com.kpitracking.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final ConversationMessageRepository messageRepository;
    private final UserRepository userRepository;

    @Transactional
    public ConversationResponse createConversation(CreateConversationRequest request) {
        User currentUser = getCurrentUser();
        Conversation conversation = Conversation.builder()
                .user(currentUser)
                .title(request.getTitle())
                .build();
        conversation = conversationRepository.save(conversation);
        return toConversationResponse(conversation);
    }

    @Transactional(readOnly = true)
    public PageResponse<ConversationResponse> getConversations(int page, int size) {
        User currentUser = getCurrentUser();
        Page<Conversation> resultPage = conversationRepository
                .findByUserIdOrderByCreatedAtDesc(currentUser.getId(), PageRequest.of(page, size));

        return PageResponse.<ConversationResponse>builder()
                .content(resultPage.getContent().stream().map(this::toConversationResponse).toList())
                .page(resultPage.getNumber())
                .size(resultPage.getSize())
                .totalElements(resultPage.getTotalElements())
                .totalPages(resultPage.getTotalPages())
                .last(resultPage.isLast())
                .build();
    }

    @Transactional
    public void deleteConversation(UUID id) {
        User currentUser = getCurrentUser();
        Conversation conversation = conversationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation", "id", id));

        if (!conversation.getUser().getId().equals(currentUser.getId())) {
            throw new ForbiddenException("Bạn không có quyền xóa cuộc trò chuyện này");
        }

        conversation.setDeletedAt(Instant.now());
        conversationRepository.save(conversation);
    }

    @Transactional(readOnly = true)
    public PageResponse<MessageResponse> getMessages(UUID conversationId, int page, int size) {
        User currentUser = getCurrentUser();
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation", "id", conversationId));

        if (!conversation.getUser().getId().equals(currentUser.getId())) {
            throw new ForbiddenException("Bạn không có quyền xem cuộc trò chuyện này");
        }

        Page<com.kpitracking.entity.ConversationMessage> resultPage = messageRepository
                .findByConversationIdOrderByMsgIndex(conversationId, PageRequest.of(page, size));

        return PageResponse.<MessageResponse>builder()
                .content(resultPage.getContent().stream().map(this::toMessageResponse).toList())
                .page(resultPage.getNumber())
                .size(resultPage.getSize())
                .totalElements(resultPage.getTotalElements())
                .totalPages(resultPage.getTotalPages())
                .last(resultPage.isLast())
                .build();
    }

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    private ConversationResponse toConversationResponse(Conversation conversation) {
        return ConversationResponse.builder()
                .id(conversation.getId())
                .title(conversation.getTitle())
                .createdAt(conversation.getCreatedAt())
                .updatedAt(conversation.getUpdatedAt())
                .build();
    }

    private MessageResponse toMessageResponse(com.kpitracking.entity.ConversationMessage msg) {
        return MessageResponse.builder()
                .id(msg.getId())
                .role(msg.getRole())
                .content(msg.getContent())
                .msgIndex(msg.getMsgIndex())
                .createdAt(msg.getCreatedAt())
                .build();
    }
}
