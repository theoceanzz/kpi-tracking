package com.kpitracking.controller;

import com.kpitracking.ai.agent.help.HelpAgentFactory;
import com.kpitracking.ai.agent.help.HelpService;
import com.kpitracking.ai.rag.LocalRagImageStore;
import com.kpitracking.ai.rag.RagIngestionService;
import com.kpitracking.ai.rag.RagVectorReader;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.ai.RagChunkResponse;
import com.kpitracking.dto.response.ai.RagSearchHitResponse;
import com.kpitracking.entity.RagDocument;
import com.kpitracking.dto.response.document.DocumentResponse;
import com.kpitracking.service.document.DocumentService;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.RagDocumentRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.reward.RewardContext;
import dev.langchain4j.invocation.InvocationParameters;
import dev.langchain4j.rag.content.retriever.ContentRetriever;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

/**
 * Kho tri thức của trợ lý, phần CỦA TỔ CHỨC: quy chế, mô tả công việc, chiến lược — và hỏi đáp.
 *
 * <p>Mọi tài liệu ở đây gắn vào tổ chức của chính người gọi; client không chọn được tổ chức, và
 * tài liệu của tổ chức khác trả "không tồn tại" chứ không phải "không có quyền" (không xác nhận id).
 * Bộ hướng dẫn KeyGo chung toàn hệ thống nằm ở {@link PlatformRagController} — quản trị nền tảng,
 * không phải quản trị công ty.
 *
 * <p>Riêng "thử tìm" chạy trên đúng những gì trợ lý thấy cho tổ chức này: tài liệu chung + của tổ
 * chức — xem {@link RagQueries}.
 */
@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
@Tag(name = "AI Knowledge", description = "Kho tri thức của trợ lý: tài liệu của tổ chức và hỏi đáp")
public class RagController {

    private final RagIngestionService ingestion;
    private final DocumentService documentService;
    private final RagDocumentRepository documents;
    private final HelpService helpService;
    private final RewardContext currentUser;
    private final PermissionChecker permissionChecker;
    private final ObjectProvider<LocalRagImageStore> localImages;
    private final RagVectorReader vectorReader;
    private final ContentRetriever helpContentRetriever;

    @Data
    public static class AskRequest {
        private String question;
    }

    @PostMapping("/help")
    @Operation(summary = "Hỏi đáp về cách dùng KeyGo và tài liệu của tổ chức")
    public ResponseEntity<ApiResponse<HelpService.Answer>> ask(@RequestBody AskRequest request) {
        if (request == null || request.getQuestion() == null || request.getQuestion().isBlank()) {
            throw new BusinessException(ErrorCode.QUESTION_CANNOT_EMPTY);
        }
        return ResponseEntity.ok(ApiResponse.success(helpService.ask(request.getQuestion().trim())));
    }

    /**
     * Cửa cũ để nạp tài liệu của tổ chức. Nay tạo một tài liệu CÔNG TY trong thư viện tài liệu (lưu tệp gốc, nạp
     * nền, metadata có scope) — không còn đường nào sinh vector thiếu scope (docs/DOCUMENTS_DESIGN.md §4.4).
     */
    @PostMapping(value = "/rag/documents", consumes = "multipart/form-data")
    @Operation(summary = "[Cũ] Tải tài liệu công ty — dùng POST /api/v1/documents")
    public ResponseEntity<ApiResponse<DocumentResponse>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "source", required = false) RagDocument.Source source,
            @RequestParam(value = "title", required = false) String title) {
        if (source != null && !source.isOrganizationScoped()) {
            throw new BusinessException(ErrorCode.KEYGO_GUIDE_LOADED_PLATFORM_ADMINISTRATOR_PLATFORM_ADMINISTRATION);
        }
        return ResponseEntity.ok(ApiResponse.success(documentService.uploadCompanyFromLegacyEndpoint(file, source, title)));
    }

    @GetMapping("/rag/assets/{name}")
    @Operation(summary = "Ảnh bóc từ tài liệu (khi kho ảnh là cục bộ)")
    public ResponseEntity<FileSystemResource> asset(@PathVariable String name) {
        LocalRagImageStore store = localImages.getIfAvailable();
        var path = store == null ? null : store.resolve(name);
        if (path == null) return ResponseEntity.notFound().build();
        MediaType type = name.endsWith(".png") ? MediaType.IMAGE_PNG
                : name.endsWith(".gif") ? MediaType.IMAGE_GIF
                : name.endsWith(".webp") ? MediaType.parseMediaType("image/webp")
                : MediaType.IMAGE_JPEG;
        return ResponseEntity.ok()
                .contentType(type)
                .header("Cache-Control", "private, max-age=86400")
                .body(new FileSystemResource(path));
    }

    @GetMapping("/rag/documents")
    @Operation(summary = "Tài liệu của tổ chức mình trong kho tri thức")
    public ResponseEntity<ApiResponse<List<RagDocument>>> list() {
        return ResponseEntity.ok(ApiResponse.success(
                documents.findByOrganizationIdOrderByCreatedAtDesc(currentUser.getCurrentOrgId())));
    }

    @GetMapping("/rag/documents/{id}/chunks")
    @Operation(summary = "Các đoạn của một tài liệu của tổ chức, đúng như trong kho vector")
    public ResponseEntity<ApiResponse<List<RagChunkResponse>>> chunks(@PathVariable UUID id) {
        requireOrgManager();
        RagDocument doc = ownDocument(id);
        return ResponseEntity.ok(ApiResponse.success(vectorReader.chunks(doc.getId())));
    }

    /**
     * Thử tìm: chạy ĐÚNG bộ truy hồi của trợ lý (hybrid, cùng số kết quả, cùng bộ lọc tổ chức) với
     * một câu hỏi, trả về những đoạn nó sẽ đưa cho model. Để người quản trị biết trợ lý "thấy gì"
     * trước khi đổ lỗi cho nó.
     */
    @GetMapping("/rag/search")
    @Operation(summary = "Thử tìm trong kho tri thức bằng bộ truy hồi của trợ lý")
    public ResponseEntity<ApiResponse<List<RagSearchHitResponse>>> search(@RequestParam("q") String q) {
        requireOrgManager();
        // Chạy với quyền của CHÍNH người thử: họ thấy đúng những gì trợ lý sẽ đưa cho họ.
        InvocationParameters params = HelpAgentFactory.params(
                currentUser.getCurrentOrgId(), currentUser.getCurrentUser().getId());
        return ResponseEntity.ok(ApiResponse.success(RagQueries.search(helpContentRetriever, q, params)));
    }

    @DeleteMapping("/rag/documents/{id}")
    @Operation(summary = "Xoá một tài liệu của tổ chức khỏi kho (cả vector lẫn bản ghi)")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        requireOrgManager();
        RagDocument doc = ownDocument(id);
        ingestion.delete(doc.getId());
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    /** Tài liệu tồn tại VÀ thuộc tổ chức của người gọi. */
    private RagDocument ownDocument(UUID id) {
        UUID orgId = currentUser.getCurrentOrgId();
        return documents.findById(id)
                .filter(d -> orgId.equals(d.getOrganizationId()))
                .orElseThrow(() -> new BusinessException(ErrorCode.DOCUMENT_DOES_NOT_EXIST));
    }

    private com.kpitracking.entity.User requireOrgManager() {
        var user = currentUser.getCurrentUser();
        if (!permissionChecker.hasPermission(user.getId(), "COMPANY:UPDATE")) {
            throw new ForbiddenException(ErrorCode.NO_PERMISSION_MANAGE_ORGANIZATION_DOCUMENTS);
        }
        return user;
    }
}
