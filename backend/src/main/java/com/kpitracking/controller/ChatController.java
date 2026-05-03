package com.kpitracking.controller;

import com.kpitracking.service.OrganizationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor
public class ChatController {

    private final OrganizationService organizationService;

    @GetMapping("/organizations/{organizationId}/members/count")
    public ResponseEntity<Long> countMembers(@PathVariable UUID organizationId) {
        long count = organizationService.countMembers(organizationId);
        return ResponseEntity.ok(count);
    }
}
