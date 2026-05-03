package com.kpitracking.controller;

import com.kpitracking.dto.request.ai.AiChatRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.ai.AiChatResponse;
import com.kpitracking.service.AiService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;

    @PostMapping("/chat")
    public ApiResponse<AiChatResponse> chat(@RequestBody AiChatRequest request) {
        String result = aiService.processChat(request.getMessage());
        AiChatResponse response = AiChatResponse.builder()
                .text(result)
                .build();
        return ApiResponse.success(response);
    }
}
