package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.ai.AiSelfCheckAvailabilityResponse;
import com.kpitracking.dto.response.ai.AiSelfCheckResponse;
import com.kpitracking.service.ai.review.SubmissionSelfCheckService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

/**
 * Nhân viên tự nhờ AI soi bài trước khi nộp. Không cần quyền riêng — cùng luật với nộp bài: chỉ người được giao
 * chỉ tiêu, kiểm trong service; cổng dùng là hạn mức token của chính người đó. Kết quả chỉ chính chủ đọc được.
 */
@RestController
@RequestMapping("/api/v1/ai/self-checks")
@Tag(name = "AI Self Check", description = "Nhân viên tự nhờ AI soi bài trước khi nộp (chỉ nhận xét, không điểm)")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class AiSelfCheckController {

    private final SubmissionSelfCheckService service;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Nhờ AI soi bài đang soạn của một chỉ tiêu (chạy nền; bài y hệt lần trước thì trả kết quả cũ)")
    public ResponseEntity<ApiResponse<AiSelfCheckResponse>> start(
            @RequestParam UUID kpiCriteriaId,
            @RequestParam(required = false) UUID submissionId,
            @RequestParam(required = false) Double actualValue,
            @RequestParam(required = false) UUID qualitativeLevelId,
            @RequestParam(required = false) String note,
            @RequestParam(value = "files", required = false) List<MultipartFile> files) {
        return ResponseEntity.ok(ApiResponse.success(service.start(
                new SubmissionSelfCheckService.Draft(kpiCriteriaId, submissionId, actualValue, qualitativeLevelId, note),
                files)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Kết quả một lần tự soi (chỉ chính chủ)")
    public ResponseEntity<ApiResponse<AiSelfCheckResponse>> get(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(service.get(id)));
    }

    @GetMapping("/latest")
    @Operation(summary = "Lần tự soi mới nhất của mình cho một chỉ tiêu (null nếu chưa có)")
    public ResponseEntity<ApiResponse<AiSelfCheckResponse>> latest(@RequestParam UUID kpiCriteriaId) {
        return ResponseEntity.ok(ApiResponse.success(service.latest(kpiCriteriaId)));
    }

    @GetMapping("/availability")
    @Operation(summary = "Mình có tự soi bài được không (tổ chức / đơn vị đã bật, còn token)")
    public ResponseEntity<ApiResponse<AiSelfCheckAvailabilityResponse>> availability() {
        return ResponseEntity.ok(ApiResponse.success(service.availability()));
    }
}
