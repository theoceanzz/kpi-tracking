package com.kpitracking.controller;

import com.kpitracking.ai.rag.RagIngestionService;
import com.kpitracking.ai.rag.RagVectorReader;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.ai.RagChunkResponse;
import com.kpitracking.dto.response.ai.RagSearchHitResponse;
import com.kpitracking.entity.RagDocument;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.repository.RagDocumentRepository;
import com.kpitracking.service.reward.RewardContext;
import dev.langchain4j.invocation.InvocationParameters;
import dev.langchain4j.rag.content.retriever.ContentRetriever;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

/**
 * Kho tri thức phần CHUNG TOÀN HỆ THỐNG: bộ hướng dẫn sử dụng KeyGo.
 *
 * <p>Là việc của quản trị NỀN TẢNG ({@code users.is_platform_admin}), không phải của một công ty:
 * bộ hướng dẫn mô tả chính sản phẩm và được mọi tổ chức dùng chung, nên nạp/xoá ở đây thay đổi câu
 * trả lời của trợ lý cho tất cả khách hàng. Trước đây nó nằm ở màn Thiết lập công ty sau quyền
 * {@code SYSTEM:ADMIN} — quyền đó là của giám đốc MỘT công ty, sai chỗ.
 *
 * <p>Quản trị nền tảng không thuộc tổ chức nào, nên "thử tìm" ở đây chỉ chạy trên tài liệu chung —
 * đúng phần mà mọi tổ chức đều thấy.
 */
@RestController
@RequestMapping("/api/v1/admin/rag")
@RequiredArgsConstructor
@PreAuthorize("@permissionChecker.isPlatformAdmin(authentication.name)")
@Tag(name = "Platform Admin", description = "Bộ hướng dẫn KeyGo trong kho tri thức của trợ lý")
public class PlatformRagController {

    private final RagIngestionService ingestion;
    private final RagDocumentRepository documents;
    private final RewardContext currentUser;
    private final RagVectorReader vectorReader;
    private final ContentRetriever helpContentRetriever;

    @GetMapping("/documents")
    @Operation(summary = "Tài liệu chung toàn hệ thống trong kho tri thức")
    public ResponseEntity<ApiResponse<List<RagDocument>>> list() {
        return ResponseEntity.ok(ApiResponse.success(documents.findByOrganizationIdIsNullOrderByCreatedAtDesc()));
    }

    @PostMapping(value = "/documents", consumes = "multipart/form-data")
    @Operation(summary = "Nạp bộ hướng dẫn KeyGo (.docx) — dùng chung cho mọi tổ chức")
    public ResponseEntity<ApiResponse<RagDocument>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "title", required = false) String title) throws IOException {
        String name = RagIngestionService.docxFileName(file.getOriginalFilename());
        try (var in = file.getInputStream()) {
            RagDocument doc = ingestion.ingestDocx(in, name, RagIngestionService.titleOf(title, name),
                    RagDocument.Source.GUIDE, null, currentUser.getCurrentUser().getId());
            return ResponseEntity.ok(ApiResponse.success(doc));
        }
    }

    @GetMapping("/documents/{id}/chunks")
    @Operation(summary = "Các đoạn của một tài liệu chung, đúng như trong kho vector")
    public ResponseEntity<ApiResponse<List<RagChunkResponse>>> chunks(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(vectorReader.chunks(globalDocument(id).getId())));
    }

    @GetMapping("/search")
    @Operation(summary = "Thử tìm trong tài liệu chung bằng bộ truy hồi của trợ lý")
    public ResponseEntity<ApiResponse<List<RagSearchHitResponse>>> search(@RequestParam("q") String q) {
        // Không có orgId: bộ lọc truy hồi lùi về chỉ tài liệu chung.
        return ResponseEntity.ok(ApiResponse.success(
                RagQueries.search(helpContentRetriever, q, new InvocationParameters())));
    }

    @DeleteMapping("/documents/{id}")
    @Operation(summary = "Xoá một tài liệu chung khỏi kho (cả vector lẫn bản ghi)")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        ingestion.delete(globalDocument(id).getId());
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    /** Tài liệu tồn tại VÀ là tài liệu chung — tài liệu của một tổ chức không quản lý ở đây. */
    private RagDocument globalDocument(UUID id) {
        return documents.findById(id)
                .filter(d -> d.getOrganizationId() == null)
                .orElseThrow(() -> new BusinessException("Tài liệu không tồn tại"));
    }
}
