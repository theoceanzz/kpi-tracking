package com.kpitracking.service.document;

import com.kpitracking.dto.response.document.DocumentResponse;
import com.kpitracking.entity.Document;
import com.kpitracking.entity.DocumentVersion;
import com.kpitracking.enums.DocumentAiStatus;
import com.kpitracking.event.DocumentIndexRequestedEvent;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.DocumentRepository;
import com.kpitracking.repository.DocumentVersionRepository;
import com.kpitracking.security.audit.SecurityAuditEvent;
import com.kpitracking.security.audit.SecurityAuditService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Thùng rác (docs/DOCUMENTS_DESIGN.md §15.2). Tài liệu đã xoá nằm đây {@code deleted-file-retention-days} ngày (mặc
 * định 30) rồi job dọn dẹp xoá hẳn cả tệp. Ai SỬA được tài liệu (theo phạm vi hiện tại của nó) thì thấy, khôi phục và
 * xoá vĩnh viễn được — cùng luật với người được xoá nó. Chia sẻ không đi vào thùng rác.
 *
 * <p>Tài liệu trong thùng rác không có vector (đã gỡ lúc xoá) nên K.AI không đọc được; khôi phục thì nạp lại từ đầu.
 */
@Service
@Slf4j
public class DocumentTrashService {

    private final DocumentService base;
    private final DocumentRepository documents;
    private final DocumentVersionRepository versions;
    private final DocumentStorage storage;
    private final DocumentSettings settings;
    private final ApplicationEventPublisher events;
    private final SecurityAuditService audit;
    private final TransactionTemplate tx;

    public DocumentTrashService(DocumentService base, DocumentRepository documents, DocumentVersionRepository versions,
                                DocumentStorage storage, DocumentSettings settings, ApplicationEventPublisher events,
                                SecurityAuditService audit, PlatformTransactionManager txManager) {
        this.base = base;
        this.documents = documents;
        this.versions = versions;
        this.storage = storage;
        this.settings = settings;
        this.events = events;
        this.audit = audit;
        this.tx = new TransactionTemplate(txManager);
    }

    public List<DocumentResponse> list() {
        DocumentService.Viewer v = base.viewer();
        if (v.orgId() == null || !v.access().member()) return List.of();
        List<Document> trash = documents.findTrash(v.orgId(), cutoff()).stream()
                .filter(d -> v.access().canEdit(d))
                .toList();
        return base.toResponses(v, trash);
    }

    public DocumentResponse restore(UUID id) {
        DocumentService.Viewer v = base.viewer();
        Document d = ownTrashed(v, id);
        base.checkQuota(v, d.getScope(), d.getOwnerUserId(), d.getOrgUnitId(), d.getFileSize());
        boolean ai = Boolean.TRUE.equals(d.getAiEnabled());
        tx.executeWithoutResult(s -> {
            int n = documents.restore(id, (ai ? DocumentAiStatus.PENDING : DocumentAiStatus.NONE).name(), Instant.now());
            if (n == 0) throw new ResourceNotFoundException(ErrorCode.DOCUMENT_NOT_FOUND);
            if (ai) events.publishEvent(new DocumentIndexRequestedEvent(id));
        });
        audit.record(SecurityAuditEvent.DOCUMENT_RESTORED, SecurityAuditService.OK, "DOCUMENT", id.toString(), d.getScope().name());
        return base.get(id);
    }

    /** Xoá hẳn ngay, không chờ hết hạn: tệp các phiên bản cũ, tệp hiện hành, rồi bản ghi. */
    public void deletePermanently(UUID id) {
        DocumentService.Viewer v = base.viewer();
        purge(ownTrashed(v, id));
    }

    /**
     * "Dọn sạch thùng rác": xoá hẳn mọi tài liệu trong thùng rác mà người xem quản lý được — đúng tập {@link #list}
     * đang hiện. Tài liệu nào xoá hỏng (kho tệp lỗi) thì bỏ qua, các tài liệu khác vẫn xoá.
     *
     * @return số tài liệu đã xoá hẳn
     */
    public int empty() {
        DocumentService.Viewer v = base.viewer();
        if (v.orgId() == null || !v.access().member()) return 0;
        int n = 0;
        for (Document d : documents.findTrash(v.orgId(), cutoff())) {
            if (!v.access().canEdit(d)) continue;
            try {
                purge(d);
                n++;
            } catch (Exception e) {
                log.warn("Dọn thùng rác: không xoá được tài liệu {}: {}", d.getId(), e.getMessage());
            }
        }
        return n;
    }

    private void purge(Document d) {
        UUID id = d.getId();
        try {
            for (DocumentVersion ver : versions.findByDocumentIdOrderByVersionDesc(d.getId())) {
                storage.delete(ver.getStorageKey());
            }
            storage.delete(d.getStorageKey());
        } catch (IOException e) {
            log.error("Không xoá được tệp của tài liệu {}: {}", id, e.getMessage());
            throw new BusinessException(ErrorCode.DOCUMENT_STORAGE_FAILED);
        }
        tx.executeWithoutResult(s -> documents.hardDelete(id));
        audit.record(SecurityAuditEvent.DOCUMENT_DELETED_PERMANENTLY, SecurityAuditService.OK, "DOCUMENT", id.toString(),
                d.getScope().name());
    }

    /** Trong thùng rác của tổ chức, người xem sửa được nó, và chưa quá hạn khôi phục — không thì 404 / hết hạn. */
    private Document ownTrashed(DocumentService.Viewer v, UUID id) {
        Document d = v.orgId() == null ? null : documents.findDeletedById(id, v.orgId()).orElse(null);
        if (d == null || !v.access().canEdit(d)) throw new ResourceNotFoundException(ErrorCode.DOCUMENT_NOT_FOUND);
        if (d.getDeletedAt().isBefore(cutoff())) {
            throw new BusinessException(ErrorCode.DOCUMENT_TRASH_EXPIRED, settings.getDeletedFileRetentionDays());
        }
        return d;
    }

    private Instant cutoff() {
        return Instant.now().minus(Duration.ofDays(settings.getDeletedFileRetentionDays()));
    }
}
