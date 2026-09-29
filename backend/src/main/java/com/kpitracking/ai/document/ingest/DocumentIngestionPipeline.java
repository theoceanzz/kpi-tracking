package com.kpitracking.ai.document.ingest;

import com.kpitracking.ai.document.model.DocumentSection;
import com.kpitracking.ai.document.model.FileRef;
import com.kpitracking.ai.document.model.ParsedDocument;
import com.kpitracking.ai.document.parse.DocumentParser;
import com.kpitracking.ai.document.parse.DocumentReader;
import com.kpitracking.ai.document.profile.DocumentKind;
import com.kpitracking.ai.document.profile.DocumentProfile;
import com.kpitracking.ai.document.profile.DocumentProfileRegistry;
import com.kpitracking.entity.RagDocument;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.repository.RagDocumentRepository;
import dev.langchain4j.data.document.Document;
import dev.langchain4j.data.document.Metadata;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Đường nạp kho tri thức DUY NHẤT (Template Method): các bước cố định
 * <pre>đọc (theo định dạng) → cắt mục (theo loại tài liệu) → làm giàu (chuỗi enricher) → lập chỉ mục</pre>
 * còn phương án của từng bước do {@link DocumentProfile} của loại tài liệu quyết định.
 *
 * <p><b>Không chạy trong một giao dịch DB.</b> Nạp là việc dài (tải ảnh, embedding tại chỗ vài chục đoạn) và
 * kho vector nằm ở DB KHÁC; bản ghi {@link RagDocument} đi qua PENDING → READY/FAILED để người quản trị thấy
 * tài liệu đang ở đâu.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentIngestionPipeline {

    private final RagDocumentRepository documents;
    private final DocumentReader reader;
    private final DocumentProfileRegistry profiles;
    private final List<SectionEnricher> enrichers;
    private final EmbeddingIndexer indexer;

    /** Tên tệp tải lên đã kiểm: định dạng phải đọc được. */
    public String checkUploadName(String originalName) {
        String name = originalName == null || originalName.isBlank() ? "tai-lieu" : originalName.strip();
        if (!reader.supports(FileRef.of(name, new byte[0]))) {
            throw new BusinessException("Chưa đọc được tệp này. Nhận: " + String.join(", ", reader.formats()));
        }
        return name;
    }

    /** Tên hiển thị: người dùng đặt, không thì tên tệp bỏ đuôi. */
    public static String titleOf(String title, String fileName) {
        if (title != null && !title.isBlank()) return title.trim();
        int dot = fileName.lastIndexOf('.');
        return dot > 0 ? fileName.substring(0, dot) : fileName;
    }

    /** Đọc tệp rồi nạp theo phương án của loại tài liệu {@code kind}. */
    public RagDocument ingest(FileRef file, DocumentKind kind, String title, UUID organizationId, UUID createdBy) {
        DocumentProfile profile = indexable(kind);
        RagDocument doc = newDocument(file.name(), title, kind, organizationId, createdBy);
        try {
            ParsedDocument parsed = reader.read(file);
            List<DocumentSection> sections = profile.sectioning(parsed).sections(parsed);
            return index(doc, profile, sections);
        } catch (DocumentParser.Unparseable u) {
            return fail(doc, "Không đọc được tài liệu: " + u.getMessage(), null);
        } catch (Exception e) {
            return fail(doc, e.getMessage(), e);
        }
    }

    /** Nạp các mục đã cắt sẵn (vd bộ tiêu chí vừa xác nhận — chữ đã đọc lúc tải lên). */
    public RagDocument ingestSections(List<DocumentSection> sections, String fileName, String title, DocumentKind kind,
                                      UUID organizationId, UUID createdBy) {
        DocumentProfile profile = indexable(kind);
        RagDocument doc = newDocument(fileName, title, kind, organizationId, createdBy);
        try {
            return index(doc, profile, sections);
        } catch (Exception e) {
            return fail(doc, e.getMessage(), e);
        }
    }

    /** Xoá tài liệu: vector trước, bản ghi sau — ngược lại để lại vector mồ côi nếu hỏng giữa chừng. */
    public void delete(UUID docId) {
        indexer.remove(docId);
        documents.deleteById(docId);
    }

    // ── các bước ─────────────────────────────────────────────────────────

    private DocumentProfile indexable(DocumentKind kind) {
        DocumentProfile profile = profiles.forKind(kind);
        if (profile.indexPolicy() == DocumentProfile.IndexPolicy.NO_INDEX || kind.storedAs() == null) {
            throw new IllegalArgumentException("Loại tài liệu " + kind + " không nạp vào kho tri thức");
        }
        return profile;
    }

    private RagDocument index(RagDocument doc, DocumentProfile profile, List<DocumentSection> sections) throws Exception {
        String orgKey = doc.getOrganizationId() == null ? RagMetadata.GLOBAL_ORG : doc.getOrganizationId().toString();
        SectionEnricher.Context ctx = new SectionEnricher.Context(doc, profile);
        List<Document> lcDocs = new ArrayList<>();
        for (int i = 0; i < sections.size(); i++) {
            DocumentSection s = sections.get(i);
            if (s.isBlank()) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put(RagMetadata.DOC_ID, doc.getId().toString());
            m.put(RagMetadata.ORG_ID, orgKey);
            m.put(RagMetadata.SOURCE, doc.getSource().name());
            m.put("docTitle", doc.getTitle());
            m.put("title", s.title());
            m.put("parent", s.parent());
            m.put("order", i);
            for (SectionEnricher e : enrichers) {
                if (e.appliesTo(profile)) e.enrich(ctx, s, m);
            }
            lcDocs.add(Document.from(s.text(), Metadata.from(m)));
        }
        int chunks = indexer.replace(doc.getId(), lcDocs);
        doc.setStatus(RagDocument.Status.READY);
        doc.setChunkCount(chunks);
        doc.setImageCount(ctx.images());
        doc.setErrorMessage(null);
        doc.setUpdatedAt(Instant.now());
        log.info("Nạp «{}» ({}): {} mục → {} đoạn, {} ảnh", doc.getTitle(), profile.kind(),
                sections.size(), chunks, ctx.images());
        return documents.save(doc);
    }

    private RagDocument fail(RagDocument doc, String message, Exception e) {
        if (e != null) log.error("Nạp tài liệu {} thất bại: {}", doc.getFileName(), e.getMessage(), e);
        else log.warn("Nạp tài liệu {} thất bại: {}", doc.getFileName(), message);
        doc.setStatus(RagDocument.Status.FAILED);
        doc.setErrorMessage(message);
        doc.setUpdatedAt(Instant.now());
        return documents.save(doc);
    }

    private RagDocument newDocument(String fileName, String title, DocumentKind kind, UUID organizationId, UUID createdBy) {
        return documents.save(RagDocument.builder()
                .organizationId(organizationId)
                .source(kind.storedAs())
                .title(title)
                .fileName(fileName)
                .createdBy(createdBy)
                .build());
    }
}
