package com.kpitracking.dto.response.notification;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class NotificationResponse {

    private UUID id;
    private String title;
    private String message;
    private String type;
    private UUID referenceId;
    private Boolean isRead;
    private Instant readAt;
    private Instant createdAt;
}
