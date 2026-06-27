package com.kpitracking.dto.request.notification;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class SaveNotificationConfigRequest {

    @NotEmpty
    @Valid
    private List<ConfigItem> configs;

    @Getter
    @Setter
    public static class ConfigItem {
        @NotNull
        private String eventCode;
        private boolean emailEnabled;
        private boolean systemEnabled;
    }
}
