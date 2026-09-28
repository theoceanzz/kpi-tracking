package com.kpitracking.service;

import com.kpitracking.dto.request.ai.CreateConversationRequest;
import com.kpitracking.dto.request.ai.UpdateConversationRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.ai.ConversationResponse;
import com.kpitracking.dto.response.ai.MessageResponse;
import com.kpitracking.entity.Conversation;
import com.kpitracking.entity.User;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.Terms;
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
                .findByUserIdPinnedFirst(currentUser.getId(), PageRequest.of(page, size));

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
        Conversation conversation = requireOwned(id, ErrorCode.NO_PERMISSION_DELETE_CONVERSATION);
        conversation.setDeletedAt(Instant.now());
        conversationRepository.save(conversation);
    }

    /** Đổi tên và/hoặc ghim. Trường null trong request giữ nguyên giá trị cũ. */
    @Transactional
    public ConversationResponse updateConversation(UUID id, UpdateConversationRequest request) {
        Conversation conversation = requireOwned(id, ErrorCode.NO_PERMISSION_EDIT_CONVERSATION);
        if (request.getTitle() != null) {
            String title = request.getTitle().trim();
            if (title.isEmpty()) {
                throw new BusinessException(ErrorCode.CONVERSATION_NAME_CANNOT_EMPTY);
            }
            conversation.setTitle(title.length() > 255 ? title.substring(0, 255) : title);
        }
        if (request.getPinned() != null) {
            conversation.setPinnedAt(request.getPinned() ? Instant.now() : null);
        }
        return toConversationResponse(conversationRepository.save(conversation));
    }

    /**
     * Hoàn tác xoá — chỉ có tác dụng trong lúc toast "Hoàn tác" còn hiện, nhưng backend không
     * giới hạn thời gian: dòng xoá mềm vẫn còn đó cho tới khi dọn.
     */
    @Transactional
    public ConversationResponse restoreConversation(UUID id) {
        User currentUser = getCurrentUser();
        int restored = conversationRepository.restore(id, currentUser.getId());
        if (restored == 0) {
            throw new ResourceNotFoundException(Terms.of("resource.conversation"), "id", id);
        }
        return conversationRepository.findById(id)
                .map(this::toConversationResponse)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.conversation"), "id", id));
    }

    private Conversation requireOwned(UUID id, ErrorCode forbiddenCode) {
        User currentUser = getCurrentUser();
        Conversation conversation = conversationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.conversation"), "id", id));
        if (!conversation.getUser().getId().equals(currentUser.getId())) {
            throw new ForbiddenException(forbiddenCode);
        }
        return conversation;
    }

    @Transactional(readOnly = true)
    public PageResponse<MessageResponse> getMessages(UUID conversationId, int page, int size) {
        User currentUser = getCurrentUser();
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.conversation"), "id", conversationId));

        if (!conversation.getUser().getId().equals(currentUser.getId())) {
            throw new ForbiddenException(ErrorCode.NO_PERMISSION_VIEW_CONVERSATION);
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
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "email", email));
    }

    private ConversationResponse toConversationResponse(Conversation conversation) {
        return ConversationResponse.builder()
                .id(conversation.getId())
                .title(conversation.getTitle())
                .createdAt(conversation.getCreatedAt())
                .updatedAt(conversation.getUpdatedAt())
                .pinnedAt(conversation.getPinnedAt())
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
