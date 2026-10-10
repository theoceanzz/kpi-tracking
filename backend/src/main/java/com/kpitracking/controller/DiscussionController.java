package com.kpitracking.controller;

import com.kpitracking.dto.request.discussion.UpdateCommentRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.discussion.DiscussionCommentResponse;
import com.kpitracking.dto.response.discussion.DiscussionLocateResponse;
import com.kpitracking.dto.response.discussion.DiscussionPageResponse;
import com.kpitracking.dto.response.discussion.MentionCandidateResponse;
import com.kpitracking.enums.DiscussionReactionType;
import com.kpitracking.enums.DiscussionTargetType;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.service.discussion.DiscussionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Thảo luận trên KPI / công việc. {@code {target}} là {@code kpi} hoặc {@code task}. Quyền xem / bình luận /
 * kiểm duyệt do service kiểm theo từng đối tượng (KPI_COMMENT:* + luật xem KPI/task), nên ở đây chỉ đòi đăng nhập.
 */
@RestController
@RequestMapping("/api/v1/discussions")
@RequiredArgsConstructor
@Tag(name = "Discussion", description = "Thảo luận trên KPI và công việc")
public class DiscussionController {

    private final DiscussionService discussionService;

    @GetMapping("/{target}/{targetId}/comments")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Bình luận gốc mới nhất trước, kèm 3 trả lời mới nhất; cursor = trang cũ hơn")
    public ResponseEntity<ApiResponse<DiscussionPageResponse>> page(@PathVariable String target, @PathVariable UUID targetId,
                                                                    @RequestParam(required = false) String cursor,
                                                                    @RequestParam(required = false) Integer size) {
        return ResponseEntity.ok(ApiResponse.success(discussionService.page(type(target), targetId, cursor, size)));
    }

    @PostMapping(value = "/{target}/{targetId}/comments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<DiscussionCommentResponse>> create(@PathVariable String target, @PathVariable UUID targetId,
                                                                         @RequestParam(required = false) String body,
                                                                         @RequestParam(required = false) UUID parentId,
                                                                         @RequestParam(required = false) List<UUID> mentionIds,
                                                                         @RequestParam(required = false) MultipartFile[] files,
                                                                         @RequestParam(required = false) List<String> sourceDocumentIds) throws IOException {
        return ResponseEntity.ok(ApiResponse.success(
                discussionService.create(type(target), targetId, body, parentId, mentionIds, files, sourceDocumentIds)));
    }

    @PostMapping("/{target}/{targetId}/read")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> markRead(@PathVariable String target, @PathVariable UUID targetId) {
        discussionService.markRead(type(target), targetId);
        return ResponseEntity.ok(ApiResponse.success((Void) null));
    }

    @GetMapping("/{target}/{targetId}/mentionable")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Gợi ý @tag: chỉ những người xem được đối tượng")
    public ResponseEntity<ApiResponse<List<MentionCandidateResponse>>> mentionable(@PathVariable String target,
                                                                                   @PathVariable UUID targetId,
                                                                                   @RequestParam(required = false) String q) {
        return ResponseEntity.ok(ApiResponse.success(discussionService.mentionCandidates(type(target), targetId, q)));
    }

    @GetMapping("/comments/{commentId}/replies")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<DiscussionPageResponse>> replies(@PathVariable UUID commentId,
                                                                       @RequestParam(required = false) String cursor,
                                                                       @RequestParam(required = false) Integer size) {
        return ResponseEntity.ok(ApiResponse.success(discussionService.replies(commentId, cursor, size)));
    }

    @GetMapping("/comments/{commentId}/around")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Trang chứa đúng bình luận này (mở từ thông báo)")
    public ResponseEntity<ApiResponse<DiscussionPageResponse>> around(@PathVariable UUID commentId) {
        return ResponseEntity.ok(ApiResponse.success(discussionService.around(commentId)));
    }

    @GetMapping("/comments/{commentId}/locate")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<DiscussionLocateResponse>> locate(@PathVariable UUID commentId) {
        return ResponseEntity.ok(ApiResponse.success(discussionService.locate(commentId)));
    }

    @PatchMapping("/comments/{commentId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<DiscussionCommentResponse>> update(@PathVariable UUID commentId,
                                                                         @RequestBody UpdateCommentRequest request) {
        return ResponseEntity.ok(ApiResponse.success(discussionService.update(commentId, request)));
    }

    @DeleteMapping("/comments/{commentId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID commentId) {
        discussionService.delete(commentId);
        return ResponseEntity.ok(ApiResponse.success((Void) null));
    }

    @PutMapping("/comments/{commentId}/reactions/{reaction}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Bật / tắt một cảm xúc của người gọi")
    public ResponseEntity<ApiResponse<DiscussionCommentResponse>> react(@PathVariable UUID commentId,
                                                                        @PathVariable DiscussionReactionType reaction) {
        return ResponseEntity.ok(ApiResponse.success(discussionService.toggleReaction(commentId, reaction)));
    }

    private static DiscussionTargetType type(String raw) {
        try {
            return DiscussionTargetType.valueOf(raw.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.BAD_REQUEST_PARAM);
        }
    }
}
