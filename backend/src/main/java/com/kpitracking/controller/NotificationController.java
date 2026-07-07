package com.kpitracking.controller;

import com.kpitracking.dto.request.notification.SaveNotificationConfigRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.notification.NotificationConfigResponse;
import com.kpitracking.dto.response.notification.NotificationResponse;
import com.kpitracking.service.NotificationService;
import com.kpitracking.service.OrgNotificationConfigService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
@Tag(name = "Notifications", description = "Notification endpoints")
public class NotificationController {

    private final NotificationService notificationService;
    private final OrgNotificationConfigService orgNotificationConfigService;

    @GetMapping
    @Operation(summary = "Get current user's notifications")
    public ResponseEntity<ApiResponse<PageResponse<NotificationResponse>>> getMyNotifications(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<NotificationResponse> response = notificationService.getMyNotifications(page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PatchMapping("/{notificationId}/read")
    @Operation(summary = "Mark notification as read")
    public ResponseEntity<ApiResponse<NotificationResponse>> markAsRead(@PathVariable UUID notificationId) {
        NotificationResponse response = notificationService.markAsRead(notificationId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/unread-count")
    @Operation(summary = "Get unread notifications count")
    public ResponseEntity<ApiResponse<Long>> getUnreadCount() {
        long count = notificationService.getUnreadCount();
        return ResponseEntity.ok(ApiResponse.success(count));
    }

    @PatchMapping("/read-all")
    @Operation(summary = "Mark all notifications as read")
    public ResponseEntity<ApiResponse<Void>> markAllAsRead() {
        notificationService.markAllAsRead();
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @GetMapping("/config")
    @Operation(summary = "Get notification config for current user's organization")
    public ResponseEntity<ApiResponse<List<NotificationConfigResponse>>> getNotificationConfig() {
        return ResponseEntity.ok(ApiResponse.success(orgNotificationConfigService.getMyOrgConfigs()));
    }

    @PutMapping("/config")
    @Operation(summary = "Save notification config for current user's organization")
    public ResponseEntity<ApiResponse<List<NotificationConfigResponse>>> saveNotificationConfig(
            @Valid @RequestBody SaveNotificationConfigRequest request) {
        return ResponseEntity.ok(ApiResponse.success(orgNotificationConfigService.saveMyOrgConfigs(request)));
    }
}
