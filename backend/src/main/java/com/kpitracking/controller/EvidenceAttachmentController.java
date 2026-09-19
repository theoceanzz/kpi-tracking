package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.submission.AttachmentResponse;
import com.kpitracking.enums.EvidenceTargetType;
import com.kpitracking.service.EvidenceAttachmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

/**
 * Tệp minh chứng cho lượt chấm đợt / kỳ / hạnh kiểm. Khoá đích do server quy ước theo loại —
 * xem {@link EvidenceTargetType}; quyền xét trong service theo đơn vị của người được chấm.
 */
@RestController
@RequestMapping("/api/v1/evidence")
@Tag(name = "Evidence", description = "Tệp minh chứng của lượt chấm")
@RequiredArgsConstructor
public class EvidenceAttachmentController {

    private final EvidenceAttachmentService service;

    @GetMapping
    @Operation(summary = "Danh sách tệp minh chứng của một lượt chấm")
    public ResponseEntity<ApiResponse<List<AttachmentResponse>>> list(
            @RequestParam EvidenceTargetType targetType,
            @RequestParam String targetKey) {
        return ResponseEntity.ok(ApiResponse.success(service.list(targetType, targetKey)));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Tải tệp minh chứng lên cho một lượt chấm")
    public ResponseEntity<ApiResponse<List<AttachmentResponse>>> upload(
            @RequestParam EvidenceTargetType targetType,
            @RequestParam String targetKey,
            @RequestParam("files") MultipartFile[] files,
            @RequestParam(required = false) String note) throws IOException {
        return ResponseEntity.ok(ApiResponse.success(service.upload(targetType, targetKey, files, note)));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá một tệp minh chứng")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Đã xoá tệp minh chứng"));
    }
}
