package com.kpitracking.ai.rag;

import com.kpitracking.entity.RagAsset;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.entity.RagDocument;
import com.kpitracking.repository.RagAssetRepository;
import com.kpitracking.repository.RagDocumentRepository;
import dev.langchain4j.data.document.Document;
import dev.langchain4j.data.document.Metadata;
import dev.langchain4j.data.document.splitter.DocumentSplitters;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.EmbeddingStoreIngestor;
import dev.langchain4j.store.embedding.filter.MetadataFilterBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Nạp một tài liệu vào kho tri thức: đọc mục → tải ảnh → cắt đoạn → embedding → pgvector.
 *
 * <p><b>Không chạy trong một giao dịch DB.</b> Nạp là việc dài (tải ảnh lên Cloudinary, embedding
 * tại chỗ vài chục đoạn) và kho vector nằm ở DB KHÁC; giữ giao dịch ứng dụng mở suốt quãng đó vừa
 * khoá kết nối vừa vô ích vì không rollback được kho vector. Thay vào đó bản ghi {@code RagDocument}
 * đi qua PENDING → READY/FAILED để người quản trị thấy được tài liệu đang ở đâu.
 *
 * <p><b>Nạp lại là thay thế.</b> Trước khi thêm vector mới, xoá mọi vector của {@code docId} đó —
 * nếu không, sửa tài liệu rồi nạp lại sẽ để bản cũ và bản mới cùng trả lời.
 *
 * <p>Metadata mỗi đoạn (kho chỉ nhận String/số/UUID nên danh sách ảnh ghép bằng {@code |}):
 * {@code docId, orgId, source, title, parent, order, images, captions, route, roles}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RagIngestionService {

    /** Giá trị {@code orgId} của tài liệu chung toàn hệ thống. */
    public static final String GLOBAL_ORG = "GLOBAL";
    public static final String SEP = "|";

    /** Tên tệp đã kiểm: hiện chỉ nhận .docx. Dùng chung cho hai cửa nạp (tổ chức và nền tảng). */
    public static String docxFileName(String originalName) {
        String name = originalName == null || originalName.isBlank() ? "tai-lieu.docx" : originalName;
        if (!name.toLowerCase(java.util.Locale.ROOT).endsWith(".docx")) {
            throw new BusinessException("Hiện chỉ nhận tệp .docx");
        }
        return name;
    }

    /** Tên hiển thị: người dùng đặt, không thì lấy tên tệp bỏ đuôi. */
    public static String titleOf(String title, String fileName) {
        return title != null && !title.isBlank() ? title.trim() : fileName.replaceAll("(?i)[.]docx$", "");
    }

    /**
     * Cắt theo KÝ TỰ, không theo token: e5-small nhận tối đa 512 token và tiếng Việt qua tokenizer
     * XLM-R vào khoảng 3 ký tự/token, nên 1200 ký tự ≈ 400 token — còn chỗ cho tiêu đề chèn đầu
     * đoạn. Chồng 150 để một câu bị cắt đôi vẫn nguyên ở một trong hai đoạn.
     */
    static final int MAX_CHARS = 1200;
    static final int OVERLAP_CHARS = 150;

    private final RagDocumentRepository documents;
    private final RagAssetRepository assets;
    private final RagImageStore imageStore;
    private final EmbeddingModel embeddingModel;
    private final EmbeddingStore<TextSegment> embeddingStore;
    private final GuideScreenIndex guideScreens;

    public RagDocument ingestDocx(InputStream docx, String fileName, String title,
                                  RagDocument.Source source, UUID organizationId, UUID createdBy) {
        RagDocument doc = documents.save(RagDocument.builder()
                .organizationId(organizationId)
                .source(source)
                .title(title)
                .fileName(fileName)
                .createdBy(createdBy)
                .build());
        try {
            List<DocxSectionWalker.Section> sections = DocxSectionWalker.walk(docx);
            int images = 0;
            List<Document> lcDocs = new ArrayList<>();
            String orgKey = organizationId == null ? GLOBAL_ORG : organizationId.toString();

            for (int i = 0; i < sections.size(); i++) {
                DocxSectionWalker.Section s = sections.get(i);
                List<String> urls = new ArrayList<>();
                List<String> captions = new ArrayList<>();
                for (DocxSectionWalker.Image img : s.images()) {
                    urls.add(uploadOnce(img, doc.getId()));
                    captions.add(img.caption() == null ? "" : img.caption());
                    images++;
                }
                lcDocs.add(Document.from(s.text(), metadataOf(doc, orgKey, s, i, urls, captions)));
            }

            int chunks = replaceVectors(doc.getId(), lcDocs);

            doc.setStatus(RagDocument.Status.READY);
            doc.setChunkCount(chunks);
            doc.setImageCount(images);
            doc.setErrorMessage(null);
        } catch (Exception e) {
            log.error("Nạp tài liệu {} thất bại: {}", fileName, e.getMessage(), e);
            doc.setStatus(RagDocument.Status.FAILED);
            doc.setErrorMessage(e.getMessage());
        }
        doc.setUpdatedAt(Instant.now());
        return documents.save(doc);
    }

    /** Xoá tài liệu: vector trước, bản ghi sau — thứ tự ngược lại để lại vector mồ côi nếu hỏng giữa chừng. */
    public void delete(UUID docId) {
        embeddingStore.removeAll(MetadataFilterBuilder.metadataKey("docId").isEqualTo(docId.toString()));
        documents.deleteById(docId);
    }

    // ── nội bộ ──────────────────────────────────────────────────────────────

    /**
     * Xoá vector cũ của tài liệu rồi nạp lại qua {@link EmbeddingStoreIngestor} chuẩn của langchain4j:
     * tách đoạn → biến đổi đoạn → embed → cất. Phần "của KeyGo" chỉ còn một
     * {@code TextSegmentTransformer}: {@link #withHeading}.
     *
     * @return số đoạn đã nạp
     */
    private int replaceVectors(UUID docId, List<Document> docs) {
        embeddingStore.removeAll(MetadataFilterBuilder.metadataKey("docId").isEqualTo(docId.toString()));

        AtomicInteger count = new AtomicInteger();
        EmbeddingStoreIngestor.builder()
                .documentSplitter(DocumentSplitters.recursive(MAX_CHARS, OVERLAP_CHARS))
                .textSegmentTransformer(seg -> {
                    count.incrementAndGet();
                    return withHeading(seg);
                })
                .embeddingModel(embeddingModel)
                .embeddingStore(embeddingStore)
                .build()
                .ingest(docs);
        log.info("Đã nạp {} đoạn cho tài liệu {}", count.get(), docId);
        return count.get();
    }

    /**
     * Tiêu đề chèn vào ĐẦU mỗi đoạn: đoạn thứ ba của "3.11. Quy trình" mà không có chữ "quy trình"
     * nào thì vector của nó không biết mình thuộc mục nào. Bộ tách đoạn đã chép metadata của mục
     * sang từng đoạn nên đọc {@code parent}/{@code title} ngay trên đoạn.
     */
    static TextSegment withHeading(TextSegment seg) {
        String head = "[" + seg.metadata().getString("parent") + " › " + seg.metadata().getString("title") + "]\n";
        return TextSegment.from(head + seg.text(), seg.metadata());
    }

    private Metadata metadataOf(RagDocument doc, String orgKey, DocxSectionWalker.Section s, int order,
                                List<String> urls, List<String> captions) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("docId", doc.getId().toString());
        m.put("orgId", orgKey);
        m.put("source", doc.getSource().name());
        m.put("docTitle", doc.getTitle());
        m.put("title", s.title());
        m.put("parent", s.parent());
        m.put("order", order);
        if (!urls.isEmpty()) {
            m.put("images", String.join(SEP, urls));
            m.put("captions", String.join(SEP, captions));
        }
        // Với bộ hướng dẫn: gắn route/vai trò khi tiêu đề mục hoặc chú thích ảnh khớp danh mục màn hình.
        if (doc.getSource() == RagDocument.Source.GUIDE) {
            guideScreens.match(s.title())
                    .or(() -> captions.stream().map(guideScreens::match)
                            .filter(java.util.Optional::isPresent).map(java.util.Optional::get).findFirst())
                    .ifPresent(screen -> {
                        m.put("route", screen.route());
                        if (screen.role() != null) m.put("roles", screen.role());
                    });
        }
        return Metadata.from(m);
    }

    /** Cất ảnh đúng một lần theo băm nội dung; nạp lại cùng tài liệu không cất lại. */
    private String uploadOnce(DocxSectionWalker.Image img, UUID docId) throws Exception {
        String hash = sha256(img.bytes());
        RagAsset existing = assets.findById(hash).orElse(null);
        if (existing != null) return existing.getUrl();

        String url = imageStore.store(img.bytes(), img.fileName(), hash);
        assets.save(RagAsset.builder()
                .contentSha256(hash)
                .url(url)
                .publicId(hash)
                .build());
        return url;
    }

    private static String sha256(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }
}
