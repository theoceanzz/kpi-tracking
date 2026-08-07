package com.kpitracking.controller;

import com.kpitracking.dto.request.email.SaveEmailTemplateRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.email.EmailTemplateResponse;
import com.kpitracking.service.email.EmailTemplateService;
import com.kpitracking.service.CloudinaryStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Cấu hình template email của tổ chức. Dùng chung quyền với cấu hình thông báo
 * ({@code NOTIF:MANAGE}) vì đây cũng là cài đặt kênh gửi tin của tổ chức.
 */
@RestController
@RequestMapping("/api/v1/email-templates")
@RequiredArgsConstructor
public class EmailTemplateController {

    private final EmailTemplateService emailTemplateService;
    private final CloudinaryStorageService cloudinaryStorageService;

    @GetMapping
    @PreAuthorize("hasAuthority('NOTIF:MANAGE')")
    public ResponseEntity<ApiResponse<List<EmailTemplateResponse>>> list() {
        UUID orgId = emailTemplateService.getCurrentOrgId();
        return ResponseEntity.ok(ApiResponse.success(emailTemplateService.listForOrg(orgId)));
    }

    @GetMapping("/{code}")
    @PreAuthorize("hasAuthority('NOTIF:MANAGE')")
    public ResponseEntity<ApiResponse<EmailTemplateResponse>> get(@PathVariable String code) {
        UUID orgId = emailTemplateService.getCurrentOrgId();
        return ResponseEntity.ok(ApiResponse.success(emailTemplateService.getForOrg(orgId, code)));
    }

    @PutMapping("/{code}")
    @PreAuthorize("hasAuthority('NOTIF:MANAGE')")
    public ResponseEntity<ApiResponse<EmailTemplateResponse>> save(
            @PathVariable String code, @RequestBody SaveEmailTemplateRequest request) {
        UUID orgId = emailTemplateService.getCurrentOrgId();
        emailTemplateService.save(orgId, emailTemplateService.getCurrentUserId(), code,
                request.getSubject(), request.getBody(), request.isFullHtml(), request.isEnabled());
        return ResponseEntity.ok(ApiResponse.success(emailTemplateService.getForOrg(orgId, code)));
    }

    /** Xoá bản tuỳ chỉnh để quay về nội dung mặc định của hệ thống. */
    @DeleteMapping("/{code}")
    @PreAuthorize("hasAuthority('NOTIF:MANAGE')")
    public ResponseEntity<ApiResponse<EmailTemplateResponse>> reset(@PathVariable String code) {
        UUID orgId = emailTemplateService.getCurrentOrgId();
        emailTemplateService.resetToDefault(orgId, code);
        return ResponseEntity.ok(ApiResponse.success(emailTemplateService.getForOrg(orgId, code)));
    }

    /**
     * Tải ảnh dùng trong nội dung email, trả về URL công khai.
     *
     * <p>Cố tình KHÔNG nhúng ảnh dạng base64 vào HTML: nội dung sẽ phình lên rất lớn
     * trong DB và phần lớn mail client chặn ảnh nhúng kiểu đó.
     */
    @PostMapping(value = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('NOTIF:MANAGE')")
    public ResponseEntity<ApiResponse<Map<String, String>>> uploadImage(
            @RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Chưa chọn ảnh để tải lên");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new IllegalArgumentException("Chỉ chấp nhận tệp ảnh");
        }
        if (file.getSize() > 5 * 1024 * 1024) {
            throw new IllegalArgumentException("Ảnh không được vượt quá 5MB");
        }
        String url = cloudinaryStorageService.uploadFile(file, "email-templates").get("url");
        return ResponseEntity.ok(ApiResponse.success(Map.of("url", url)));
    }

    /** Xem trước bằng dữ liệu mẫu — không lưu gì. */
    @PostMapping("/{code}/preview")
    @PreAuthorize("hasAuthority('NOTIF:MANAGE')")
    public ResponseEntity<ApiResponse<Map<String, String>>> preview(
            @PathVariable String code, @RequestBody SaveEmailTemplateRequest request) {
        EmailTemplateService.RenderedEmail mail = emailTemplateService.preview(
                code, request.getSubject(), request.getBody(), request.isFullHtml());
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "subject", mail.subject() != null ? mail.subject() : "",
                "html", mail.html() != null ? mail.html() : "",
                // HTML gốc còn nguyên {{bien}} — dùng khi chuyển sang chế độ nâng cao.
                "source", mail.source() != null ? mail.source() : "")));
    }
}
