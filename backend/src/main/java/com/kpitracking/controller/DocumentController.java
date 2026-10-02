package com.kpitracking.controller;

import com.kpitracking.dto.request.document.CreateFolderRequest;
import com.kpitracking.dto.request.document.FlagRequest;
import com.kpitracking.dto.request.document.MoveDocumentRequest;
import com.kpitracking.dto.request.document.PromotionDecisionRequest;
import com.kpitracking.dto.request.document.PromotionRequest;
import com.kpitracking.dto.request.document.RenameFolderRequest;
import com.kpitracking.dto.request.document.ShareDocumentRequest;
import com.kpitracking.dto.request.document.UpdateDocumentRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.ai.RagChunkResponse;
import com.kpitracking.dto.response.document.DocumentCapabilitiesResponse;
import com.kpitracking.dto.response.document.DocumentFolderListResponse;
import com.kpitracking.dto.response.document.DocumentFolderResponse;
import com.kpitracking.dto.response.document.DocumentPromotionResponse;
import com.kpitracking.dto.response.document.DocumentStorageStatsResponse;
import com.kpitracking.dto.response.document.DocumentResponse;
import com.kpitracking.dto.response.document.DocumentShareResponse;
import com.kpitracking.dto.response.document.DocumentVersionResponse;
import com.kpitracking.dto.response.document.ShareTargetResponse;
import com.kpitracking.dto.response.document.ShareUnitResponse;
import com.kpitracking.dto.response.document.DocumentUsageResponse;
import com.kpitracking.enums.DocumentAiStatus;
import com.kpitracking.enums.DocumentCategory;
import com.kpitracking.enums.DocumentScope;
import com.kpitracking.service.document.DocumentFolderService;
import com.kpitracking.service.document.DocumentHomeService;
import com.kpitracking.service.document.DocumentPromotionService;
import com.kpitracking.service.document.DocumentStatsService;
import com.kpitracking.service.document.DocumentService;
import com.kpitracking.service.document.DocumentShareService;
import com.kpitracking.service.document.DocumentTrashService;
import com.kpitracking.service.document.DocumentVersionService;
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
    private final DocumentFolderService folders;
    private final DocumentHomeService home;
    private final DocumentShareService shares;
    private final DocumentTrashService trash;
    private final DocumentVersionService versions;
    private final DocumentPromotionService promotions;
    private final DocumentStatsService stats;

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
            @RequestParam(required = false) UUID folderId,
            @RequestParam(defaultValue = "false") boolean rootOnly,
            @RequestParam(required = false) DocumentService.HomeView view,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "updatedAt") String sort,
            @RequestParam(defaultValue = "desc") String direction) {
        String sortBy = SORTABLE.contains(sort) ? sort : "updatedAt";
        Sort.Direction dir = "asc".equalsIgnoreCase(direction) ? Sort.Direction.ASC : Sort.Direction.DESC;
        var pageable = PageRequest.of(Math.max(0, page), Math.min(100, Math.max(1, size)), Sort.by(dir, sortBy));
        var filter = new DocumentService.ListFilter(scope, unitId, includeDescendants, category, aiStatus, q,
                folderId, rootOnly, view);
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
            @RequestParam(value = "aiEnabled", defaultValue = "true") boolean aiEnabled,
            @RequestParam(value = "folderId", required = false) UUID folderId,
            @RequestParam(value = "reviewDate", required = false)
            @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE)
            java.time.LocalDate reviewDate,
            @RequestParam(value = "expiryDate", required = false)
            @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE)
            java.time.LocalDate expiryDate) {
        return ResponseEntity.ok(ApiResponse.success(
                documents.upload(file, scope, unitId, title, description, category, aiEnabled, folderId, reviewDate, expiryDate)));
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
        return fileResponse(documents.download(id), inline);
    }

    private static ResponseEntity<byte[]> fileResponse(DocumentService.FileContent f, boolean inline) {
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

    // ── Trang chủ: gần đây, ghim, yêu thích (§15.1) ───────────────────────────────────────────────

    @GetMapping("/recent")
    @Operation(summary = "Tài liệu mở / tải lên gần đây của người đang đăng nhập")
    public ResponseEntity<ApiResponse<List<DocumentResponse>>> recent() {
        return ResponseEntity.ok(ApiResponse.success(home.recent()));
    }

    @GetMapping("/pinned")
    @Operation(summary = "Tài liệu ghim lên thanh bên")
    public ResponseEntity<ApiResponse<List<DocumentResponse>>> pinned() {
        return ResponseEntity.ok(ApiResponse.success(home.pinned()));
    }

    @PutMapping("/{id}/favorite")
    public ResponseEntity<ApiResponse<DocumentResponse>> favorite(@PathVariable UUID id, @RequestBody FlagRequest request) {
        return ResponseEntity.ok(ApiResponse.success(home.setFavorite(id, request.value())));
    }

    @PutMapping("/{id}/pin")
    public ResponseEntity<ApiResponse<DocumentResponse>> pin(@PathVariable UUID id, @RequestBody FlagRequest request) {
        return ResponseEntity.ok(ApiResponse.success(home.setPinned(id, request.value())));
    }

    @PostMapping("/{id}/open")
    @Operation(summary = "Ghi lần mở gần nhất (tab Gần đây)")
    public ResponseEntity<ApiResponse<Void>> open(@PathVariable UUID id) {
        home.markOpened(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // ── Thư mục (§15.2) ────────────────────────────────────────────────────────────────────────────

    @GetMapping("/folders")
    @Operation(summary = "Một cấp thư mục: gốc của phạm vi (scope [+ unitId]) hoặc bên trong parentId")
    public ResponseEntity<ApiResponse<DocumentFolderListResponse>> listFolders(
            @RequestParam(required = false) DocumentScope scope,
            @RequestParam(required = false) UUID unitId,
            @RequestParam(required = false) UUID parentId) {
        return ResponseEntity.ok(ApiResponse.success(folders.list(scope, unitId, parentId)));
    }

    @PostMapping("/folders")
    public ResponseEntity<ApiResponse<DocumentFolderResponse>> createFolder(@Valid @RequestBody CreateFolderRequest request) {
        return ResponseEntity.ok(ApiResponse.success(folders.create(request)));
    }

    @PatchMapping("/folders/{folderId}")
    public ResponseEntity<ApiResponse<DocumentFolderResponse>> renameFolder(@PathVariable UUID folderId,
                                                                            @Valid @RequestBody RenameFolderRequest request) {
        return ResponseEntity.ok(ApiResponse.success(folders.rename(folderId, request.name())));
    }

    @DeleteMapping("/folders/{folderId}")
    @Operation(summary = "Xoá thư mục và thư mục con; tài liệu bên trong vào thùng rác")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> deleteFolder(@PathVariable UUID folderId) {
        return ResponseEntity.ok(ApiResponse.success(Map.of("trashed", folders.delete(folderId))));
    }

    @PostMapping("/{id}/move")
    @Operation(summary = "Chuyển tài liệu vào thư mục cùng phạm vi (folderId = null: về gốc)")
    public ResponseEntity<ApiResponse<DocumentResponse>> move(@PathVariable UUID id, @RequestBody MoveDocumentRequest request) {
        return ResponseEntity.ok(ApiResponse.success(folders.moveDocument(id, request.folderId())));
    }

    // ── Thùng rác (§15.2) ──────────────────────────────────────────────────────────────────────────

    @GetMapping("/trash")
    @Operation(summary = "Tài liệu đã xoá người đang đăng nhập khôi phục được")
    public ResponseEntity<ApiResponse<List<DocumentResponse>>> trash() {
        return ResponseEntity.ok(ApiResponse.success(trash.list()));
    }

    @DeleteMapping("/trash")
    @Operation(summary = "Dọn sạch thùng rác: xoá hẳn mọi tài liệu trong thùng rác mà người xem quản lý được")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> emptyTrash() {
        return ResponseEntity.ok(ApiResponse.success(Map.of("deleted", trash.empty())));
    }

    @PostMapping("/{id}/restore")
    public ResponseEntity<ApiResponse<DocumentResponse>> restore(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(trash.restore(id)));
    }

    @DeleteMapping("/{id}/permanent")
    @Operation(summary = "Xoá vĩnh viễn một tài liệu trong thùng rác (cả tệp và các phiên bản)")
    public ResponseEntity<ApiResponse<Void>> deletePermanently(@PathVariable UUID id) {
        trash.deletePermanently(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // ── Phiên bản (§15.4) ──────────────────────────────────────────────────────────────────────────

    @GetMapping("/{id}/versions")
    public ResponseEntity<ApiResponse<List<DocumentVersionResponse>>> versions(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(versions.list(id)));
    }

    @GetMapping("/{id}/versions/{versionId}/download")
    public ResponseEntity<byte[]> downloadVersion(@PathVariable UUID id, @PathVariable UUID versionId) {
        return fileResponse(versions.download(id, versionId), false);
    }

    @PostMapping("/{id}/versions/{versionId}/restore")
    @Operation(summary = "Khôi phục một phiên bản cũ thành bản hiện hành")
    public ResponseEntity<ApiResponse<DocumentResponse>> restoreVersion(@PathVariable UUID id, @PathVariable UUID versionId) {
        return ResponseEntity.ok(ApiResponse.success(versions.restore(id, versionId)));
    }

    // ── Chia sẻ (§15.3) ────────────────────────────────────────────────────────────────────────────

    @GetMapping("/share-targets")
    @Operation(summary = "Tìm người / đơn vị để chia sẻ")
    public ResponseEntity<ApiResponse<List<ShareTargetResponse>>> shareTargets(@RequestParam(required = false) String q) {
        return ResponseEntity.ok(ApiResponse.success(shares.targets(q)));
    }

    @GetMapping("/share-units")
    @Operation(summary = "Cây đơn vị để chọn chia sẻ (trừ đơn vị gốc), kèm số người gắn trực tiếp")
    public ResponseEntity<ApiResponse<List<ShareUnitResponse>>> shareUnits() {
        return ResponseEntity.ok(ApiResponse.success(shares.unitTree()));
    }

    @GetMapping("/share-units/{unitId}/members")
    @Operation(summary = "Người gắn trực tiếp vào một đơn vị — để tích chọn từng người khi chia sẻ")
    public ResponseEntity<ApiResponse<List<ShareTargetResponse>>> shareUnitMembers(@PathVariable UUID unitId) {
        return ResponseEntity.ok(ApiResponse.success(shares.unitMembers(unitId)));
    }

    @GetMapping("/{id}/shares")
    public ResponseEntity<ApiResponse<List<DocumentShareResponse>>> shares(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(shares.list(id)));
    }

    @PostMapping("/{id}/shares")
    @Operation(summary = "Chia sẻ quyền xem cho người và/hoặc đơn vị")
    public ResponseEntity<ApiResponse<List<DocumentShareResponse>>> share(@PathVariable UUID id,
                                                                          @RequestBody ShareDocumentRequest request) {
        return ResponseEntity.ok(ApiResponse.success(shares.add(id, request)));
    }

    @DeleteMapping("/{id}/shares/{shareId}")
    public ResponseEntity<ApiResponse<Void>> unshare(@PathVariable UUID id, @PathVariable UUID shareId) {
        shares.remove(id, shareId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // ── Đề xuất đưa lên đơn vị / công ty (§16.2) ──────────────────────────────────────────────────

    @PostMapping("/{id}/promotions")
    @Operation(summary = "Đề xuất đưa tài liệu lên đơn vị / công ty (người quản lý phạm vi đích duyệt)")
    public ResponseEntity<ApiResponse<DocumentPromotionResponse>> propose(@PathVariable UUID id,
                                                                          @Valid @RequestBody PromotionRequest request) {
        return ResponseEntity.ok(ApiResponse.success(promotions.create(id, request)));
    }

    @GetMapping("/{id}/promotions")
    @Operation(summary = "Đề xuất đang chờ của một tài liệu")
    public ResponseEntity<ApiResponse<List<DocumentPromotionResponse>>> documentPromotions(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(promotions.ofDocument(id)));
    }

    @GetMapping("/promotions/inbox")
    @Operation(summary = "Đề xuất chờ người đang đăng nhập duyệt")
    public ResponseEntity<ApiResponse<List<DocumentPromotionResponse>>> promotionInbox() {
        return ResponseEntity.ok(ApiResponse.success(promotions.inbox()));
    }

    @GetMapping("/promotions/mine")
    @Operation(summary = "Đề xuất người đang đăng nhập đã gửi")
    public ResponseEntity<ApiResponse<List<DocumentPromotionResponse>>> myPromotions() {
        return ResponseEntity.ok(ApiResponse.success(promotions.mine()));
    }

    @PostMapping("/promotions/{promotionId}/approve")
    @Operation(summary = "Duyệt: sao chép tài liệu thành tài liệu mới ở phạm vi đích")
    public ResponseEntity<ApiResponse<DocumentResponse>> approvePromotion(@PathVariable UUID promotionId,
                                                                          @Valid @RequestBody(required = false) PromotionDecisionRequest request) {
        return ResponseEntity.ok(ApiResponse.success(promotions.approve(promotionId, request)));
    }

    @PostMapping("/promotions/{promotionId}/reject")
    public ResponseEntity<ApiResponse<DocumentPromotionResponse>> rejectPromotion(@PathVariable UUID promotionId,
                                                                                  @Valid @RequestBody(required = false) PromotionDecisionRequest request) {
        return ResponseEntity.ok(ApiResponse.success(promotions.reject(promotionId, request)));
    }

    @PostMapping("/promotions/{promotionId}/cancel")
    public ResponseEntity<ApiResponse<Void>> cancelPromotion(@PathVariable UUID promotionId) {
        promotions.cancel(promotionId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @GetMapping("/promotions/{promotionId}/file")
    @Operation(summary = "Tệp gốc của đề xuất — cho người duyệt xem trước khi quyết")
    public ResponseEntity<byte[]> promotionFile(@PathVariable UUID promotionId,
                                                @RequestParam(defaultValue = "false") boolean inline) {
        return fileResponse(promotions.file(promotionId), inline);
    }

    // ── Thống kê dung lượng (§16.5) ────────────────────────────────────────────────────────────────

    @GetMapping("/storage-stats")
    @Operation(summary = "Quản trị: dung lượng theo phạm vi, đơn vị, người; thùng rác; phiên bản cũ")
    public ResponseEntity<ApiResponse<DocumentStorageStatsResponse>> storageStats() {
        return ResponseEntity.ok(ApiResponse.success(stats.stats()));
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
