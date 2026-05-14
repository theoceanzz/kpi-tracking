package com.kpitracking.controller;

import com.kpitracking.service.SidebarSettingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/sidebar-settings")
@RequiredArgsConstructor
public class SidebarSettingController {

    private final SidebarSettingService sidebarSettingService;

    @GetMapping("/{organizationId}")
    public ResponseEntity<Map<String, String>> getCustomLabels(@PathVariable UUID organizationId) {
        return ResponseEntity.ok(sidebarSettingService.getCustomLabels(organizationId));
    }

    @PostMapping("/{organizationId}")
    public ResponseEntity<Void> updateCustomLabel(
            @PathVariable UUID organizationId,
            @RequestBody Map<String, String> request) {
        
        request.forEach((key, value) -> 
            sidebarSettingService.updateCustomLabel(organizationId, key, value)
        );
        return ResponseEntity.ok().build();
    }
}
