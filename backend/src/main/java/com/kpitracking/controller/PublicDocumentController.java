package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.document.DocumentContentResponse;
import com.kpitracking.dto.response.document.PublicDocumentResponse;
import com.kpitracking.service.document.DocumentEmailService;
import com.kpitracking.service.document.DocumentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;

/**
 * Tài liệu mở qua link công khai trong email (không cần đăng nhập — {@code /api/v1/public/**}). Token là thứ duy nhất
 * xác định quyền; mọi lỗi (sai, hết hạn, thu hồi, tài liệu đã xoá) trả cùng một mã {@code DOCUMENT_LINK_UNAVAILABLE}.
 */
@RestController
@RequestMapping("/api/v1/public/documents/{token}")
@RequiredArgsConstructor
@Tag(name = "Public", description = "Tài liệu gửi qua email cho người ngoài hệ thống")
public class PublicDocumentController {

    private final DocumentEmailService mailer;

    @GetMapping
    @Operation(summary = "Thông tin tài liệu của link công khai (mỗi lần gọi tính một lượt mở)")
    public ResponseEntity<ApiResponse<PublicDocumentResponse>> open(@PathVariable String token) {
        return ResponseEntity.ok().header("X-Robots-Tag", "noindex, nofollow")
                .body(ApiResponse.success(mailer.open(token)));
    }

    @GetMapping("/content")
    @Operation(summary = "Nội dung tài liệu trực tuyến / Markdown / chữ thuần để xem ở chế độ đọc")
    public ResponseEntity<ApiResponse<DocumentContentResponse>> content(@PathVariable String token) {
        return ResponseEntity.ok().header("X-Robots-Tag", "noindex, nofollow")
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(ApiResponse.success(mailer.content(token)));
    }

    /** Tệp gốc. {@code inline=true} chỉ có tác dụng với PDF (xem trong trang); loại khác luôn tải về. */
    @GetMapping("/file")
    public ResponseEntity<byte[]> file(@PathVariable String token, @RequestParam(defaultValue = "false") boolean inline) {
        DocumentService.FileContent f = mailer.file(token);
        boolean pdf = "application/pdf".equalsIgnoreCase(f.contentType());
        ContentDisposition disposition = (inline && pdf ? ContentDisposition.inline() : ContentDisposition.attachment())
                .filename(f.fileName(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok()
                .contentType(pdf ? MediaType.APPLICATION_PDF : MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .header("X-Robots-Tag", "noindex, nofollow")
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(f.bytes());
    }
}
