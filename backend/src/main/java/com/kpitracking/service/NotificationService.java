package com.kpitracking.service;

import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.notification.NotificationResponse;
import com.kpitracking.entity.Notification;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.exception.ForbiddenException;
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
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
    }

    @Transactional
    public Notification createNotification(OrgUnit orgUnit, User user, String title, String message, String type, UUID referenceId) {
        Notification notification = Notification.builder()
                .orgUnit(orgUnit)
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
        Pageable pageable = PageRequest.of(page, size);

        Page<Notification> notifPage = notificationRepository
                .findByUserIdOrderByCreatedAtDesc(currentUser.getId(), pageable);

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

        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Thông báo", "id", notificationId));

        if (!notification.getUser().getId().equals(currentUser.getId())) {
             throw new ForbiddenException("Không thể đánh dấu thông báo của người khác là đã đọc");
        }

        notification.setIsRead(true);
        notification.setReadAt(Instant.now());
        notification = notificationRepository.save(notification);
        return toResponse(notification);
    }

    @Transactional(readOnly = true)
    public long getUnreadCount() {
        User currentUser = getCurrentUser();
        return notificationRepository.countByUserIdAndIsReadFalse(currentUser.getId());
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
