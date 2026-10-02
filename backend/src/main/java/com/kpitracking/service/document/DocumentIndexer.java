package com.kpitracking.service.document;

import com.kpitracking.ai.document.ingest.DocumentIngestionPipeline;
import com.kpitracking.ai.document.model.FileRef;
import com.kpitracking.ai.document.parse.DocumentParser;
import com.kpitracking.ai.document.profile.DocumentKind;
import com.kpitracking.entity.Document;
import com.kpitracking.enums.DocumentCategory;
import com.kpitracking.enums.DocumentAiStatus;
import com.kpitracking.enums.DocumentScope;
import com.kpitracking.event.DocumentIndexRequestedEvent;
import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.logging.MdcTaskDecorator;
import com.kpitracking.repository.DocumentRepository;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.RejectedExecutionException;

/**
 * Nạp tài liệu vào kho tri thức, chạy nền (docs/DOCUMENTS_DESIGN.md §5.2).
 *
 * <p>Luồng: giành quyền nạp ({@code PENDING/FAILED → INDEXING}, 0 dòng = đã có luồng khác) → đọc tệp gốc →
 * {@link DocumentIngestionPipeline#indexLibraryDocument} (cùng đường nạp với kho tri thức: đọc theo định dạng, cắt
 * mục theo loại tài liệu, xoá vector cũ rồi nạp) → CHỐT: khoá dòng, so với ảnh chụp lúc bắt đầu.
 *
 * <p>Bước chốt là thứ giữ kho vector đúng quyền khi người dùng thao tác TRONG LÚC đang nạp:
 * <ul>
 *   <li>tài liệu bị xoá hoặc tắt AI → xoá sạch vector vừa nạp (nếu không, vector mồ côi vẫn truy hồi được);</li>
 *   <li>phạm vi/tên/danh mục/tệp đã đổi → vector vừa nạp mang metadata cũ, đặt lại PENDING và nạp lại.</li>
 * </ul>
 * Lượt sửa của người dùng KHÔNG tự đặt PENDING khi tài liệu đang INDEXING (xem {@code DocumentService}), nên
 * không bao giờ có hai luồng nạp cùng một tài liệu song song.
 *
 * <p>Kho vector nằm ngoài giao dịch DB (có thể ở DB khác): thứ tự luôn là vector trước, trạng thái sau; hỏng
 * giữa chừng thì tài liệu kẹt ở INDEXING và {@link #recoverStuck} chạy lại — an toàn vì nạp là "xoá rồi ghi".
 */
@Component
@Slf4j
public class DocumentIndexer {

    private static final List<DocumentAiStatus> CLAIMABLE = List.of(DocumentAiStatus.PENDING, DocumentAiStatus.FAILED);

    private final DocumentRepository documents;
    private final DocumentStorage storage;
    private final DocumentIngestionPipeline ingestion;
    private final DocumentSettings settings;
    private final TransactionTemplate tx;
    private final ThreadPoolTaskExecutor executor;

    public DocumentIndexer(DocumentRepository documents, DocumentStorage storage, DocumentIngestionPipeline ingestion,
                           DocumentSettings settings, PlatformTransactionManager txManager) {
        this.documents = documents;
        this.storage = storage;
        this.ingestion = ingestion;
        this.settings = settings;
        this.tx = new TransactionTemplate(txManager);
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setThreadNamePrefix("doc-index-");
        int n = Math.max(1, Math.min(2, settings.getIndexConcurrency()));
        ex.setCorePoolSize(n);
        ex.setMaxPoolSize(n);
        ex.setQueueCapacity(200);
        ex.setTaskDecorator(new MdcTaskDecorator());
        ex.setWaitForTasksToCompleteOnShutdown(false);
        ex.initialize();
        this.executor = ex;
    }

    @PreDestroy
    void shutdown() {
        executor.shutdown();
    }

    /** Sau commit của giao dịch đã tạo/sửa tài liệu — trước commit thì luồng nạp chưa thấy dòng mới. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onIndexRequested(DocumentIndexRequestedEvent event) {
        dispatch(event.documentId());
    }

    /** Đưa vào hàng đợi nạp. Hàng đợi đầy thì bỏ — tài liệu vẫn PENDING, job khôi phục sẽ nhặt lại. */
    public void dispatch(UUID documentId) {
        try {
            executor.execute(() -> index(documentId));
        } catch (RejectedExecutionException e) {
            log.warn("Hàng đợi nạp tài liệu đầy — {} chờ job khôi phục", documentId);
        }
    }

    /** Nạp một tài liệu. Công khai để test gọi đồng bộ. */
    public void index(UUID documentId) {
        Integer claimed = tx.execute(s -> documents.claimForIndexing(documentId, CLAIMABLE, Instant.now()));
        if (claimed == null || claimed == 0) return;

        Document doc = documents.findById(documentId).orElse(null);
        if (doc == null) return;
        String snapshot = fingerprint(doc);

        LocalizedText error = null;
        DocumentAiStatus outcome;
        DocumentIngestionPipeline.Indexed result = null;
        try {
            long othersChunks = documents.sumChunks(doc.getOrganizationId()) - doc.getAiChunkCount();
            if (othersChunks >= settings.getOrgMaxChunks()) {
                error = LocalizedText.of("document.aiError.chunkQuota", settings.getOrgMaxChunks());
                outcome = DocumentAiStatus.FAILED;
            } else {
                byte[] bytes = read(doc);
                boolean withImages = doc.getScope() == DocumentScope.COMPANY;
                result = ingestion.indexLibraryDocument(documentId, FileRef.of(doc.getFileName(), bytes),
                        kindOf(doc.getCategory()), doc.getTitle(), baseMetadata(doc), withImages);
                outcome = DocumentAiStatus.READY;
            }
        } catch (DocumentParser.Unparseable e) {
            error = LocalizedText.of("document.aiError.noText");
            outcome = DocumentAiStatus.UNSUPPORTED;
        } catch (StorageReadException e) {
            error = LocalizedText.of("document.aiError.storageRead");
            outcome = DocumentAiStatus.FAILED;
        } catch (java.io.IOException e) {
            log.warn("Không đọc được nội dung tài liệu {}: {}", documentId, e.getMessage());
            error = LocalizedText.of("document.aiError.parseFailed", shorten(e.getMessage()));
            outcome = DocumentAiStatus.FAILED;
        } catch (Exception e) {
            log.error("Nạp tài liệu {} thất bại", documentId, e);
            error = LocalizedText.of("document.aiError.unexpected", shorten(e.getMessage()));
            outcome = DocumentAiStatus.FAILED;
        }
        if (outcome != DocumentAiStatus.READY) {
            // Fail-closed: nạp hỏng thì KHÔNG để lại vector nào — kể cả vector của lần nạp trước, vì chúng có
            // thể mang phạm vi cũ (vd tài liệu công ty vừa chuyển về cá nhân) mà ai cũng đọc được.
            removeVectorsQuietly(documentId);
        }
        finish(documentId, snapshot, outcome, result, error);
    }

    private void removeVectorsQuietly(UUID id) {
        try {
            ingestion.removeVectors(id);
        } catch (Exception e) {
            log.error("Không xoá được vector của tài liệu {} sau khi nạp hỏng", id, e);
        }
    }

    /** Bước chốt — xem javadoc của lớp. */
    private void finish(UUID id, String snapshot, DocumentAiStatus outcome, DocumentIngestionPipeline.Indexed result,
                        LocalizedText error) {
        UUID[] legacyToDelete = new UUID[1];
        boolean[] redo = new boolean[1];
        boolean[] purge = new boolean[1];
        tx.executeWithoutResult(s -> {
            Document doc = documents.findByIdForUpdate(id).orElse(null);
            if (doc == null || doc.getDeletedAt() != null || !Boolean.TRUE.equals(doc.getAiEnabled())) {
                // Xoá hoặc tắt AI trong lúc nạp: vector vừa ghi không được sống sót.
                purge[0] = true;
                if (doc != null && doc.getDeletedAt() == null) {
                    doc.setAiStatus(DocumentAiStatus.NONE);
                    doc.setAiChunkCount(0);
                }
                return;
            }
            if (!snapshot.equals(fingerprint(doc))) {
                doc.setAiStatus(DocumentAiStatus.PENDING);
                redo[0] = true;
                return;
            }
            doc.setAiStatus(outcome);
            doc.setAiErrorI18n(error == null ? null : error.toJson());
            if (outcome == DocumentAiStatus.READY && result != null) {
                doc.setAiChunkCount(result.chunks());
                doc.setAiIndexedAt(Instant.now());
                legacyToDelete[0] = doc.getLegacyRagDocumentId();
                doc.setLegacyRagDocumentId(null);
            } else {
                doc.setAiChunkCount(0);
            }
        });
        if (purge[0]) ingestion.removeVectors(id);
        if (redo[0]) dispatch(id);
        if (legacyToDelete[0] != null) {
            // Bản mới đã sẵn sàng → giờ mới gỡ tài liệu cũ không có tệp gốc (§4.4).
            try {
                ingestion.delete(legacyToDelete[0]);
            } catch (Exception e) {
                log.warn("Không xoá được tài liệu cũ {} sau khi thay thế: {}", legacyToDelete[0], e.getMessage());
            }
        }
    }

    /**
     * Loại tài liệu của đường nạp (quyết định cách cắt mục và {@code source} trong metadata — hồ sơ truy hồi lọc theo
     * {@code source}: gợi ý KPI chỉ đọc mô tả công việc/chiến lược, chấm bài đọc quy chế/mô tả công việc).
     */
    public static DocumentKind kindOf(DocumentCategory category) {
        return switch (category) {
            case REGULATION -> DocumentKind.REGULATION;
            case JOB_DESCRIPTION -> DocumentKind.JOB_DESCRIPTION;
            case STRATEGY -> DocumentKind.STRATEGY;
            default -> DocumentKind.GENERIC;
        };
    }

    /**
     * Metadata chung của mọi đoạn — đúng những khoá bộ lọc quyền đọc (§4.2). Thiếu khoá nào thì
     * {@code RagMetadata.requireScope} từ chối nạp.
     */
    static Map<String, Object> baseMetadata(Document doc) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put(DocumentAccess.KEY_ORG, doc.getOrganizationId().toString());
        m.put(DocumentAccess.KEY_SCOPE, doc.getScope().name());
        if (doc.getScope() == DocumentScope.UNIT) m.put(DocumentAccess.KEY_UNIT, doc.getOrgUnitId().toString());
        if (doc.getScope() == DocumentScope.PERSONAL) m.put(DocumentAccess.KEY_OWNER, doc.getOwnerUserId().toString());
        m.put("category", doc.getCategory().name());
        m.put("docTitle", doc.getTitle());
        m.put("version", doc.getVersion());
        String validity = validity(doc);
        if (validity != null) m.put(VALIDITY, validity);
        return m;
    }

    /** Khoá metadata K.AI đọc kèm đoạn trích: có giá trị khi tài liệu đã hết hiệu lực (§16.3). */
    public static final String VALIDITY = "validity";

    private static final java.time.format.DateTimeFormatter DMY = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy");

    /**
     * Câu ghi chú hiệu lực cho K.AI, hoặc {@code null} khi còn hiệu lực. Viết tiếng Việt như phần còn lại của khung
     * prompt; model tự trả lời theo ngôn ngữ người hỏi.
     */
    static String validity(Document doc) {
        if (!DocumentDates.expired(doc, DocumentDates.today())) return null;
        return "Tài liệu này ĐÃ HẾT HIỆU LỰC từ " + doc.getExpiryDate().format(DMY)
                + " — nói rõ điều đó khi trích, không coi là quy định đang áp dụng.";
    }

    /** Phần metadata đổi được tại chỗ (không cần nạp lại): tên và ghi chú hiệu lực. */
    static Map<String, Object> mutableMetadata(Document doc) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("docTitle", doc.getTitle());
        m.put(VALIDITY, validity(doc));
        return m;
    }

    /** Những gì nằm trong metadata vector hoặc quyết định nội dung — đổi bất kỳ thứ nào là phải nạp lại. */
    static String fingerprint(Document d) {
        return String.join("|", d.getScope().name(), String.valueOf(d.getOrgUnitId()), String.valueOf(d.getOwnerUserId()),
                d.getTitle(), d.getCategory().name(), String.valueOf(d.getVersion()), d.getStorageKey(),
                String.valueOf(d.getExpiryDate()));
    }

    private byte[] read(Document doc) throws StorageReadException {
        try {
            return storage.read(doc.getStorageKey());
        } catch (Exception e) {
            log.error("Không đọc được tệp gốc của tài liệu {}: {}", doc.getId(), e.getMessage());
            throw new StorageReadException();
        }
    }

    private static final class StorageReadException extends Exception {}

    private static String shorten(String msg) {
        if (msg == null) return "";
        return msg.length() <= 200 ? msg : msg.substring(0, 200) + "…";
    }

    // ── Khôi phục ──────────────────────────────────────────────────────────────────────────────────

    /**
     * Nhặt tài liệu kẹt: PENDING quá 2 phút (event mất vì khởi động lại / hàng đợi đầy), INDEXING quá 30 phút
     * (luồng nạp chết giữa chừng). INDEXING được đưa về PENDING trước để {@code claimForIndexing} nhận lại.
     */
    @Scheduled(fixedDelayString = "${app.documents.index.recover-interval-ms:300000}", initialDelay = 60_000)
    public void recoverStuck() {
        Instant now = Instant.now();
        List<UUID> stuck = documents.findStuck(now.minus(Duration.ofMinutes(2)), now.minus(Duration.ofMinutes(30)));
        if (stuck.isEmpty()) return;
        tx.executeWithoutResult(s -> documents.resetStuckIndexing(stuck, now));
        log.info("Khôi phục {} tài liệu kẹt ở hàng đợi nạp", stuck.size());
        stuck.forEach(this::dispatch);
    }
}
