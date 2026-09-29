package com.kpitracking.service;

import com.kpitracking.dto.response.CursorPageResponse;
import com.kpitracking.dto.response.notification.NotificationResponse;
import com.kpitracking.entity.Notification;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.i18n.SupportedLanguages;
import com.kpitracking.i18n.Terms;
import com.kpitracking.i18n.UserLanguageResolver;
import com.kpitracking.repository.NotificationRepository;
import com.kpitracking.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final UserLanguageResolver languageResolver;

    @Lazy
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "email", email));
    }

    /**
     * Lưu key + tham số để thông báo dịch theo ngôn ngữ người XEM lúc đọc; cột title/message giữ bản
     * tiếng Việt. Bản đẩy qua WebSocket dịch theo ngôn ngữ của người nhận.
     */
    @Transactional
    public Notification createNotification(OrgUnit orgUnit, User user, LocalizedText title, LocalizedText message,
                                           String type, UUID referenceId) {
        Notification notification = Notification.builder()
                .orgUnit(orgUnit)
                .user(user)
                .title(title.render(SupportedLanguages.DEFAULT_LOCALE))
                .message(message.render(SupportedLanguages.DEFAULT_LOCALE))
                .titleI18n(title.toJson())
                .messageI18n(message.toJson())
                .type(type)
                .referenceId(referenceId)
                .isRead(false)
                .build();
        notification = notificationRepository.save(notification);
        messagingTemplate.convertAndSendToUser(user.getEmail(), "/queue/notifications",
                toResponse(notification, languageResolver.effectiveLocale(user)));
        return notification;
    }

    /** Giới hạn trên của {@code size} — bảng thông báo có thể rất lớn, không cho client kéo cả bảng. */
    private static final int MAX_PAGE_SIZE = 100;

    /**
     * Danh sách thông báo của người dùng theo con trỏ (keyset pagination).
     *
     * <p>{@code cursor} là {@code <createdAt ISO-8601>_<id>} của phần tử cuối trang trước (chuỗi
     * mờ do server phát, client chỉ gửi lại). Không có OFFSET và không có COUNT(*): chi phí mỗi
     * trang không đổi dù người dùng có 20 hay 20.000 thông báo. Xem docs/DATABASE_SCALING.md H1.
     */
    @Transactional(readOnly = true)
    public CursorPageResponse<NotificationResponse> getMyNotifications(int size, String cursor) {
        User currentUser = getCurrentUser();
        int limit = Math.max(1, Math.min(size, MAX_PAGE_SIZE));

        // Lấy dư 1 dòng để biết còn trang sau hay không mà không cần đếm.
        List<Notification> rows;
        if (cursor == null || cursor.isBlank()) {
            rows = notificationRepository.findByUserIdOrderByCreatedAtDescIdDesc(
                    currentUser.getId(), PageRequest.of(0, limit + 1));
        } else {
            Cursor c = Cursor.parse(cursor);
            rows = notificationRepository.findPageBefore(currentUser.getId(), c.createdAt(), c.id(), limit + 1);
        }

        boolean hasMore = rows.size() > limit;
        List<Notification> pageRows = hasMore ? rows.subList(0, limit) : rows;
        String nextCursor = hasMore ? Cursor.of(pageRows.get(pageRows.size() - 1)) : null;

        return CursorPageResponse.<NotificationResponse>builder()
                .content(pageRows.stream().map(n -> toResponse(n, ErrorMessages.currentLocale())).toList())
                .size(limit)
                .nextCursor(nextCursor)
                .hasMore(hasMore)
                .build();
    }

    /** Con trỏ keyset: (created_at, id) của phần tử cuối trang. */
    private record Cursor(Instant createdAt, UUID id) {
        static String of(Notification n) {
            return n.getCreatedAt() + "_" + n.getId();
        }

        static Cursor parse(String raw) {
            int sep = raw.lastIndexOf('_');
            if (sep <= 0 || sep == raw.length() - 1) {
                throw new com.kpitracking.exception.BusinessException(ErrorCode.INVALID_PAGE_CURSOR);
            }
            try {
                return new Cursor(Instant.parse(raw.substring(0, sep)), UUID.fromString(raw.substring(sep + 1)));
            } catch (java.time.format.DateTimeParseException | IllegalArgumentException e) {
                throw new com.kpitracking.exception.BusinessException(ErrorCode.INVALID_PAGE_CURSOR);
            }
        }
    }

    @Transactional
    public NotificationResponse markAsRead(UUID notificationId) {
        User currentUser = getCurrentUser();

        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.notification"), "id", notificationId));

        if (!notification.getUser().getId().equals(currentUser.getId())) {
             throw new ForbiddenException(ErrorCode.CANNOT_MARK_SOMEONE_ELSE_NOTIFICATIONS_READ);
        }

        notification.setIsRead(true);
        notification.setReadAt(Instant.now());
        notification = notificationRepository.save(notification);
        return toResponse(notification, ErrorMessages.currentLocale());
    }

    @Transactional
    public void markAllAsRead() {
        User currentUser = getCurrentUser();
        notificationRepository.markAllAsReadForUser(currentUser.getId(), Instant.now());
    }

    @Transactional(readOnly = true)
    public long getUnreadCount() {
        User currentUser = getCurrentUser();
        return notificationRepository.countByUserIdAndIsReadFalse(currentUser.getId());
    }

    private NotificationResponse toResponse(Notification notification, Locale locale) {
        return NotificationResponse.builder()
                .id(notification.getId())
                .title(LocalizedText.renderOr(notification.getTitleI18n(), notification.getTitle(), locale))
                .message(LocalizedText.renderOr(notification.getMessageI18n(), notification.getMessage(), locale))
                .type(notification.getType())
                .referenceId(notification.getReferenceId())
                .isRead(notification.getIsRead())
                .readAt(notification.getReadAt())
                .createdAt(notification.getCreatedAt())
                .build();
    }
}
