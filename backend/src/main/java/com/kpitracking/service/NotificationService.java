package com.kpitracking.service;

import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.notification.NotificationResponse;
import com.kpitracking.entity.Notification;
import com.kpitracking.entity.User;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.NotificationRepository;
import com.kpitracking.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    @Transactional
    public Notification createNotification(User user, String title, String message, String type, UUID referenceId) {
        Notification notification = Notification.builder()
                .company(user.getCompany())
                .user(user)
                .title(title)
                .message(message)
                .type(type)
                .referenceId(referenceId)
                .isRead(false)
                .build();
        return notificationRepository.save(notification);
    }

    @Transactional(readOnly = true)
    public PageResponse<NotificationResponse> getMyNotifications(int page, int size) {
        User currentUser = getCurrentUser();
        UUID companyId = currentUser.getCompany().getId();
        Pageable pageable = PageRequest.of(page, size);

        Page<Notification> notifPage = notificationRepository
                .findByCompanyIdAndUserIdOrderByCreatedAtDesc(companyId, currentUser.getId(), pageable);

        return PageResponse.<NotificationResponse>builder()
                .content(notifPage.getContent().stream().map(this::toResponse).toList())
                .page(notifPage.getNumber())
                .size(notifPage.getSize())
                .totalElements(notifPage.getTotalElements())
                .totalPages(notifPage.getTotalPages())
                .last(notifPage.isLast())
                .build();
    }

    @Transactional
    public NotificationResponse markAsRead(UUID notificationId) {
        User currentUser = getCurrentUser();
        UUID companyId = currentUser.getCompany().getId();

        Notification notification = notificationRepository.findByIdAndCompanyId(notificationId, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification", "id", notificationId));

        if (!notification.getUser().getId().equals(currentUser.getId())) {
             throw new com.kpitracking.exception.ForbiddenException("Cannot mark another user's notification as read");
        }

        notification.setIsRead(true);
        notification.setReadAt(Instant.now());
        notification = notificationRepository.save(notification);
        return toResponse(notification);
    }

    @Transactional(readOnly = true)
    public long getUnreadCount() {
        User currentUser = getCurrentUser();
        UUID companyId = currentUser.getCompany().getId();
        return notificationRepository.countByCompanyIdAndUserIdAndIsReadFalse(companyId, currentUser.getId());
    }

    private NotificationResponse toResponse(Notification notification) {
        return NotificationResponse.builder()
                .id(notification.getId())
                .title(notification.getTitle())
                .message(notification.getMessage())
                .type(notification.getType())
                .referenceId(notification.getReferenceId())
                .isRead(notification.getIsRead())
                .readAt(notification.getReadAt())
                .createdAt(notification.getCreatedAt())
                .build();
    }
}
