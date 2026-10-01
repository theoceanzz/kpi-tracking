package com.kpitracking.controller;

import com.kpitracking.dto.request.document.UpdateDocumentRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.ai.RagChunkResponse;
import com.kpitracking.dto.response.document.DocumentCapabilitiesResponse;
import com.kpitracking.dto.response.document.DocumentResponse;
import com.kpitracking.dto.response.document.DocumentUsageResponse;
import com.kpitracking.enums.DocumentAiStatus;
import com.kpitracking.enums.DocumentCategory;
import com.kpitracking.enums.DocumentScope;
import com.kpitracking.service.document.DocumentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Thư viện tài liệu 3 phạm vi — tri thức cho K.AI (docs/DOCUMENTS_DESIGN.md §7). Không có {@code @PreAuthorize}
 * ở đây: quyền phụ thuộc từng tài liệu (phạm vi, đơn vị, chủ), nên {@link DocumentService} kiểm qua
 * {@code DocumentAccess} cho mọi thao tác.
 */
@RestController
@RequestMapping("/api/v1/documents")
@RequiredArgsConstructor
@Tag(name = "Documents", description = "Tài liệu cá nhân / đơn vị / công ty làm tri thức cho K.AI")
public class DocumentController {

    private static final Set<String> SORTABLE = Set.of("updatedAt", "createdAt", "title", "fileSize");

    private final DocumentService documents;

    @GetMapping("/capabilities")
    @Operation(summary = "Người đang đăng nhập làm được gì với thư viện tài liệu")
    public ResponseEntity<ApiResponse<DocumentCapabilitiesResponse>> capabilities() {
        return ResponseEntity.ok(ApiResponse.success(documents.capabilities()));
    }

    @GetMapping
    @Operation(summary = "Danh sách tài liệu người đang đăng nhập được xem")
    public ResponseEntity<ApiResponse<PageResponse<DocumentResponse>>> list(
            @RequestParam(required = false) DocumentScope scope,
            @RequestParam(required = false) UUID unitId,
            @RequestParam(defaultValue = "false") boolean includeDescendants,
            @RequestParam(required = false) DocumentCategory category,
            @RequestParam(required = false) DocumentAiStatus aiStatus,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "updatedAt") String sort,
            @RequestParam(defaultValue = "desc") String direction) {
        String sortBy = SORTABLE.contains(sort) ? sort : "updatedAt";
        Sort.Direction dir = "asc".equalsIgnoreCase(direction) ? Sort.Direction.ASC : Sort.Direction.DESC;
        var pageable = PageRequest.of(Math.max(0, page), Math.min(100, Math.max(1, size)), Sort.by(dir, sortBy));
        var filter = new DocumentService.ListFilter(scope, unitId, includeDescendants, category, aiStatus, q);
        return ResponseEntity.ok(ApiResponse.success(documents.list(filter, pageable)));
    }

    @GetMapping("/usage")
    @Operation(summary = "Dung lượng đã dùng và hạn mức")
    public ResponseEntity<ApiResponse<DocumentUsageResponse>> usage() {
        return ResponseEntity.ok(ApiResponse.success(documents.usage()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DocumentResponse>> get(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(documents.get(id)));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Tải tài liệu lên (.docx, .pdf); nạp vào kho tri thức chạy nền")
    public ResponseEntity<ApiResponse<DocumentResponse>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam("scope") DocumentScope scope,
            @RequestParam(value = "unitId", required = false) UUID unitId,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam(value = "category", required = false) DocumentCategory category,
            @RequestParam(value = "aiEnabled", defaultValue = "true") boolean aiEnabled) {
        return ResponseEntity.ok(ApiResponse.success(
                documents.upload(file, scope, unitId, title, description, category, aiEnabled)));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Sửa tên/mô tả/danh mục, bật tắt AI, đổi phạm vi")
    public ResponseEntity<ApiResponse<DocumentResponse>> update(@PathVariable UUID id,
                                                                @Valid @RequestBody UpdateDocumentRequest request) {
        return ResponseEntity.ok(ApiResponse.success(documents.update(id, request)));
    }

    @PutMapping(value = "/{id}/file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Thay tệp (phiên bản mới), nạp lại")
    public ResponseEntity<ApiResponse<DocumentResponse>> replaceFile(@PathVariable UUID id,
                                                                     @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(ApiResponse.success(documents.replaceFile(id, file)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        documents.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{id}/reindex")
    @Operation(summary = "Nạp lại vào kho tri thức")
    public ResponseEntity<ApiResponse<DocumentResponse>> reindex(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(documents.reindex(id)));
    }

    @GetMapping("/{id}/chunks")
    @Operation(summary = "Các đoạn AI đang đọc của tài liệu")
    public ResponseEntity<ApiResponse<List<RagChunkResponse>>> chunks(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(documents.chunks(id)));
    }

    /**
     * Tải tệp gốc. Luôn đi qua backend (kiểm quyền, kho riêng tư) — không có link tệp nào ra trình duyệt.
     * {@code inline=true} chỉ có tác dụng với PDF (xem trước); loại khác luôn tải về.
     */
    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> download(@PathVariable UUID id, @RequestParam(defaultValue = "false") boolean inline) {
        DocumentService.FileContent f = documents.download(id);
        boolean pdf = "application/pdf".equalsIgnoreCase(f.contentType());
        ContentDisposition disposition = (inline && pdf ? ContentDisposition.inline() : ContentDisposition.attachment())
                .filename(f.fileName(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok()
                .contentType(pdf ? MediaType.APPLICATION_PDF : MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(f.bytes());
    }

    // ── Tài liệu cũ không có tệp gốc (§4.4) ────────────────────────────────────────────────────────

    @GetMapping("/legacy")
    @Operation(summary = "Tài liệu tri thức cũ của tổ chức (không có tệp gốc)")
    public ResponseEntity<ApiResponse<List<DocumentResponse>>> legacy() {
        return ResponseEntity.ok(ApiResponse.success(documents.listLegacy()));
    }

    @DeleteMapping("/legacy/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteLegacy(@PathVariable UUID id) {
        documents.deleteLegacy(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping(value = "/legacy/{id}/replace", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Tải tệp gốc lên thay cho tài liệu cũ; bản cũ bị xoá khi bản mới nạp xong")
    public ResponseEntity<ApiResponse<DocumentResponse>> replaceLegacy(@PathVariable UUID id,
                                                                       @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(ApiResponse.success(documents.replaceLegacy(id, file)));
    }

    // ── Quản trị ───────────────────────────────────────────────────────────────────────────────────

    @GetMapping("/personal/summary")
    @Operation(summary = "Admin: số tài liệu và dung lượng kho cá nhân của một người (không tên, không nội dung)")
    public ResponseEntity<ApiResponse<DocumentService.PersonalSummary>> personalSummary(@RequestParam UUID ownerId) {
        return ResponseEntity.ok(ApiResponse.success(documents.personalSummaryOf(ownerId)));
    }

    @DeleteMapping("/personal")
    @Operation(summary = "Admin xoá sớm tài liệu cá nhân của người đang bị vô hiệu hoá")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> purgePersonal(@RequestParam UUID ownerId) {
        return ResponseEntity.ok(ApiResponse.success(Map.of("deleted", documents.purgePersonalOf(ownerId))));
    }
}
