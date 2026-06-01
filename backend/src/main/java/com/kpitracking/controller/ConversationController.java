package com.kpitracking.controller;

import com.kpitracking.dto.request.ai.CreateConversationRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.ai.ConversationResponse;
import com.kpitracking.dto.response.ai.MessageResponse;
import com.kpitracking.service.ConversationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ai/conversations")
@Tag(name = "AI", description = "AI-powered assistance endpoints")
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationService conversationService;

    @PostMapping
    @Operation(summary = "Create a new conversation")
    public ResponseEntity<ApiResponse<ConversationResponse>> createConversation(
            @RequestBody CreateConversationRequest request) {
        ConversationResponse response = conversationService.createConversation(request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    @Operation(summary = "Get conversations for the current user")
    public ResponseEntity<ApiResponse<PageResponse<ConversationResponse>>> getConversations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<ConversationResponse> response = conversationService.getConversations(page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Soft delete a conversation")
    public ResponseEntity<ApiResponse<Void>> deleteConversation(@PathVariable UUID id) {
        conversationService.deleteConversation(id);
        return ResponseEntity.ok(ApiResponse.success("Cuộc trò chuyện đã được xóa"));
    }

    @GetMapping("/{id}/messages")
    @Operation(summary = "Get paginated messages for a conversation")
    public ResponseEntity<ApiResponse<PageResponse<MessageResponse>>> getMessages(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        PageResponse<MessageResponse> response = conversationService.getMessages(id, page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
