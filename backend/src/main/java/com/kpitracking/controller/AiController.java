package com.kpitracking.controller;

import com.kpitracking.dto.request.ai.AiChatRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.ai.AiChatResponse;
import com.kpitracking.service.AiService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;

    @PostMapping("/chat-org")
    public ApiResponse<AiChatResponse> chatOrg(@RequestBody AiChatRequest request) {
        String result = aiService.processOrgChat(request.getMessage());
        AiChatResponse response = AiChatResponse.builder()
                .text(result)
                .build();
        return ApiResponse.success(response);
    }

    @PostMapping("/chat-org-unit")
    public ApiResponse<AiChatResponse> chatOrgUnit(@RequestBody AiChatRequest request) {
        String result = aiService.processOrgUnitChat(request.getMessage());
        AiChatResponse response = AiChatResponse.builder()
                .text(result)
                .build();
        return ApiResponse.success(response);
    }
}
