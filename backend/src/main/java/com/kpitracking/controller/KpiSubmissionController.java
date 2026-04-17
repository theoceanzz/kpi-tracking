package com.kpitracking.controller;

import com.kpitracking.dto.request.submission.CreateSubmissionRequest;
import com.kpitracking.dto.request.submission.ReviewSubmissionRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.submission.AttachmentResponse;
import com.kpitracking.dto.response.submission.SubmissionResponse;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.service.KpiSubmissionService;
import com.kpitracking.service.SubmissionAttachmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/submissions")
@RequiredArgsConstructor
@Tag(name = "Submissions", description = "KPI Submission endpoints")
public class KpiSubmissionController {

    private final KpiSubmissionService submissionService;
    private final SubmissionAttachmentService attachmentService;

    @PostMapping
    @Operation(summary = "Create a new submission")
    public ResponseEntity<ApiResponse<SubmissionResponse>> createSubmission(
            @Valid @RequestBody CreateSubmissionRequest request) {
        SubmissionResponse response = submissionService.createSubmission(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Submission created successfully", response));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('DIRECTOR', 'HEAD', 'DEPUTY')")
    @Operation(summary = "List submissions with optional filters")
    public ResponseEntity<ApiResponse<PageResponse<SubmissionResponse>>> getSubmissions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) SubmissionStatus status,
            @RequestParam(required = false) UUID kpiCriteriaId) {
        PageResponse<SubmissionResponse> response = submissionService.getSubmissions(page, size, status, kpiCriteriaId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/{submissionId}")
    @Operation(summary = "Get submission by ID")
    public ResponseEntity<ApiResponse<SubmissionResponse>> getSubmission(@PathVariable UUID submissionId) {
        SubmissionResponse response = submissionService.getSubmissionById(submissionId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/{submissionId}/review")
    @PreAuthorize("hasAnyRole('DIRECTOR', 'HEAD', 'DEPUTY')")
    @Operation(summary = "Review (approve/reject) a submission")
    public ResponseEntity<ApiResponse<SubmissionResponse>> reviewSubmission(
            @PathVariable UUID submissionId,
            @Valid @RequestBody ReviewSubmissionRequest request) {
        SubmissionResponse response = submissionService.reviewSubmission(submissionId, request);
        return ResponseEntity.ok(ApiResponse.success("Submission reviewed successfully", response));
    }

    @GetMapping("/my")
    @Operation(summary = "Get current user's submissions")
    public ResponseEntity<ApiResponse<PageResponse<SubmissionResponse>>> getMySubmissions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<SubmissionResponse> response = submissionService.getMySubmissions(page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @DeleteMapping("/{submissionId}")
    @Operation(summary = "Delete a pending submission")
    public ResponseEntity<ApiResponse<Void>> deleteSubmission(@PathVariable UUID submissionId) {
        submissionService.deleteSubmission(submissionId);
        return ResponseEntity.ok(ApiResponse.success("Submission deleted successfully"));
    }

    @PostMapping(value = "/{submissionId}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload attachments to a submission")
    public ResponseEntity<ApiResponse<List<AttachmentResponse>>> uploadAttachments(
            @PathVariable UUID submissionId,
            @RequestParam("files") MultipartFile[] files) throws IOException {
        List<AttachmentResponse> response = attachmentService.uploadAttachments(submissionId, files);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Attachments uploaded successfully", response));
    }

    @GetMapping("/{submissionId}/attachments")
    @Operation(summary = "Get attachments for a submission")
    public ResponseEntity<ApiResponse<List<AttachmentResponse>>> getAttachments(@PathVariable UUID submissionId) {
        List<AttachmentResponse> response = attachmentService.getAttachments(submissionId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @DeleteMapping("/attachments/{attachmentId}")
    @Operation(summary = "Delete an attachment")
    public ResponseEntity<ApiResponse<Void>> deleteAttachment(@PathVariable UUID attachmentId) {
        attachmentService.deleteAttachment(attachmentId);
        return ResponseEntity.ok(ApiResponse.success("Attachment deleted successfully"));
    }
}
