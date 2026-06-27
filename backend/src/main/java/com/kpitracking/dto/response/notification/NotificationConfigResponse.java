package com.kpitracking.dto.response.notification;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class NotificationConfigResponse {
    private String eventCode;
    private boolean emailEnabled;
    private boolean systemEnabled;
}
