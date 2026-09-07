package com.kpitracking.controller;

import com.kpitracking.dto.request.reward.CertificateTemplateRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.reward.CertificateCatalogResponse;
import com.kpitracking.dto.response.reward.CertificateTemplateResponse;
import com.kpitracking.service.CloudinaryStorageService;
import com.kpitracking.service.reward.RewardCertificateService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

/**
 * Mẫu chứng nhận khen thưởng.
 *
 * <p>Đọc mở cho mọi người có ví điểm ({@code REWARD:VIEW_MY}): nhân viên tự in chứng nhận
 * của mình cũng cần chọn mẫu. Sửa mẫu thì đóng ở {@code REWARD:CONFIG} — đây là nhận diện
 * của công ty, không phải thứ ai cũng đổi được.
 */
@RestController
@RequestMapping("/api/v1/reward-certificate-templates")
@RequiredArgsConstructor
public class RewardCertificateController {

    private final RewardCertificateService certificateService;
    private final CloudinaryStorageService cloudinaryStorageService;

    /** Danh sách mẫu đang bật + nhận diện tổ chức, đủ để vẽ chứng nhận. */
    @GetMapping
    @PreAuthorize("hasAuthority('REWARD:VIEW_MY')")
    public ResponseEntity<ApiResponse<CertificateCatalogResponse>> getCatalog() {
        return ResponseEntity.ok(ApiResponse.success(certificateService.getCatalog()));
    }

    /** Màn hình quản trị: lấy cả mẫu đang tắt. */
    @GetMapping("/manage")
    @PreAuthorize("hasAuthority('REWARD:CONFIG')")
    public ResponseEntity<ApiResponse<CertificateCatalogResponse>> getCatalogForManage() {
        return ResponseEntity.ok(ApiResponse.success(certificateService.getCatalogForManage()));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('REWARD:CONFIG')")
    public ResponseEntity<ApiResponse<CertificateTemplateResponse>> create(
            @Valid @RequestBody CertificateTemplateRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã lưu mẫu chứng nhận",
                certificateService.create(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('REWARD:CONFIG')")
    public ResponseEntity<ApiResponse<CertificateTemplateResponse>> update(
            @PathVariable UUID id, @Valid @RequestBody CertificateTemplateRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã cập nhật mẫu chứng nhận",
                certificateService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('REWARD:CONFIG')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        certificateService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Đã xoá mẫu chứng nhận"));
    }

    /**
     * Tải ảnh dùng trong mẫu: chữ ký scan, con dấu, ảnh nền. Trả về URL công khai —
     * cùng cách làm với ảnh quà tặng, không nhúng base64 vì sẽ làm phình cột trong DB.
     *
     * <p>Nới lên 5MB và chấp nhận cả PNG nền trong: chữ ký scan ở độ phân giải in được
     * thì nặng hơn ảnh thumbnail khá nhiều.
     */
    @PostMapping(value = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('REWARD:CONFIG')")
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
        String url = cloudinaryStorageService.uploadFile(file, "reward-certificates").get("url");
        return ResponseEntity.ok(ApiResponse.success(Map.of("url", url)));
    }
}
