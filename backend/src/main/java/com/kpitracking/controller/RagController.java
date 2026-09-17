package com.kpitracking.controller;

import com.kpitracking.ai.agent.help.HelpService;
import com.kpitracking.ai.rag.LocalRagImageStore;
import com.kpitracking.ai.rag.RagIngestionService;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.entity.RagDocument;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.RagDocumentRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.reward.RewardContext;
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
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Kho tri thức của trợ lý (RAG): nạp tài liệu, liệt kê, xoá, và hỏi đáp.
 *
 * <p>Hai loại tài liệu, hai mức quyền:
 * <ul>
 *   <li>{@code GUIDE} — bộ hướng dẫn KeyGo, chung toàn hệ thống: chỉ {@code SYSTEM:ADMIN};</li>
 *   <li>{@code REGULATION} — quy chế của MỘT tổ chức: {@code COMPANY:UPDATE}, và luôn gắn vào tổ
 *       chức của chính người tải lên — client không được chọn tổ chức.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
@Tag(name = "AI Knowledge", description = "Kho tri thức của trợ lý: hướng dẫn KeyGo và quy chế tổ chức")
public class RagController {

    private final RagIngestionService ingestion;
    private final RagDocumentRepository documents;
    private final HelpService helpService;
    private final RewardContext currentUser;
    private final PermissionChecker permissionChecker;
    /** Chỉ có khi app.ai.rag.image-store = local; với Cloudinary thì URL ảnh là tuyệt đối, không qua đây. */
    private final ObjectProvider<LocalRagImageStore> localImages;

    @Data
    public static class AskRequest {
        private String question;
    }

    @PostMapping("/help")
    @Operation(summary = "Hỏi đáp về cách dùng KeyGo và quy chế của tổ chức")
    public ResponseEntity<ApiResponse<HelpService.Answer>> ask(@RequestBody AskRequest request) {
        if (request == null || request.getQuestion() == null || request.getQuestion().isBlank()) {
            throw new BusinessException("Câu hỏi không được để trống");
        }
        return ResponseEntity.ok(ApiResponse.success(helpService.ask(request.getQuestion().trim())));
    }

    @PostMapping(value = "/rag/documents", consumes = "multipart/form-data")
    @Operation(summary = "Nạp một tài liệu .docx vào kho tri thức")
    public ResponseEntity<ApiResponse<RagDocument>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam("source") RagDocument.Source source,
            @RequestParam(value = "title", required = false) String title) throws IOException {

        var user = currentUser.getCurrentUser();
        UUID orgId;
        if (source == RagDocument.Source.GUIDE) {
            if (!permissionChecker.hasPermission(user.getId(), "SYSTEM:ADMIN")) {
                throw new ForbiddenException("Chỉ quản trị hệ thống mới nạp được bộ hướng dẫn chung");
            }
            orgId = null;
        } else {
            if (!permissionChecker.hasPermission(user.getId(), "COMPANY:UPDATE")) {
                throw new ForbiddenException("Bạn không có quyền quản lý tài liệu của tổ chức");
            }
            orgId = currentUser.getCurrentOrgId();
        }

        String name = file.getOriginalFilename() == null ? "tai-lieu.docx" : file.getOriginalFilename();
        if (!name.toLowerCase().endsWith(".docx")) {
            throw new BusinessException("Hiện chỉ nhận tệp .docx");
        }
        String docTitle = title != null && !title.isBlank() ? title.trim()
                : name.replaceAll("(?i)\\.docx$", "");

        try (var in = file.getInputStream()) {
            RagDocument doc = ingestion.ingestDocx(in, name, docTitle, source, orgId, user.getId());
            return ResponseEntity.ok(ApiResponse.success(doc));
        }
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
    @Operation(summary = "Tài liệu trong kho: chung toàn hệ thống + của tổ chức mình")
    public ResponseEntity<ApiResponse<List<RagDocument>>> list() {
        List<RagDocument> out = new ArrayList<>(documents.findByOrganizationIdIsNullOrderByCreatedAtDesc());
        out.addAll(documents.findByOrganizationIdOrderByCreatedAtDesc(currentUser.getCurrentOrgId()));
        return ResponseEntity.ok(ApiResponse.success(out));
    }

    @DeleteMapping("/rag/documents/{id}")
    @Operation(summary = "Xoá tài liệu khỏi kho (cả vector lẫn bản ghi)")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        RagDocument doc = documents.findById(id)
                .orElseThrow(() -> new BusinessException("Tài liệu không tồn tại"));
        var user = currentUser.getCurrentUser();
        boolean allowed = doc.getOrganizationId() == null
                ? permissionChecker.hasPermission(user.getId(), "SYSTEM:ADMIN")
                : doc.getOrganizationId().equals(currentUser.getCurrentOrgId())
                        && permissionChecker.hasPermission(user.getId(), "COMPANY:UPDATE");
        if (!allowed) throw new ForbiddenException("Bạn không có quyền xoá tài liệu này");

        ingestion.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
