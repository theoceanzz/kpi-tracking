package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.service.ReminderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reminders")
@RequiredArgsConstructor
@Tag(name = "Reminder", description = "Endpoints for sending reminders to employees")
public class ReminderController {

    private final ReminderService reminderService;

    @PostMapping("/assigned-kpi/{assignedKpiId}/user/{userId}")
    @PreAuthorize("hasAuthority('USER:VIEW')")
    @Operation(summary = "Send a reminder to a user for a specific assigned KPI")
    public ResponseEntity<ApiResponse<Void>> sendReminder(
            @PathVariable UUID assignedKpiId,
            @PathVariable UUID userId) {
        reminderService.sendReminder(assignedKpiId, userId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
