package com.kpitracking.service.document;

import com.kpitracking.dto.response.document.DocumentResponse;
import com.kpitracking.dto.response.document.DocumentVersionResponse;
import com.kpitracking.entity.Document;
import com.kpitracking.entity.DocumentVersion;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.DocumentRepository;
import com.kpitracking.repository.DocumentVersionRepository;
import com.kpitracking.security.audit.SecurityAuditEvent;
import com.kpitracking.security.audit.SecurityAuditService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Lịch sử phiên bản tệp (docs/DOCUMENTS_DESIGN.md §15.4). Mỗi lần "Thay tệp", tệp cũ thành một phiên bản (giữ tối đa
 * {@link DocumentService#MAX_VERSIONS} bản). Chỉ người SỬA được tài liệu mới xem / tải / khôi phục phiên bản cũ — bản cũ
 * có thể chứa nội dung đã cố ý gỡ đi, người chỉ có quyền xem chỉ thấy bản hiện hành.
 */
@Service
@Slf4j
public class DocumentVersionService {

    private final DocumentService base;
    private final DocumentRepository documents;
    private final DocumentVersionRepository versions;
    private final DocumentStorage storage;
    private final SecurityAuditService audit;
    private final TransactionTemplate tx;

    public DocumentVersionService(DocumentService base, DocumentRepository documents, DocumentVersionRepository versions,
                                  DocumentStorage storage, SecurityAuditService audit, PlatformTransactionManager txManager) {
        this.base = base;
        this.documents = documents;
        this.versions = versions;
        this.storage = storage;
        this.audit = audit;
        this.tx = new TransactionTemplate(txManager);
    }

    /** Bản hiện hành (đầu danh sách, {@code current = true}) và các bản cũ, mới nhất trước. */
    public List<DocumentVersionResponse> list(UUID documentId) {
        DocumentService.Viewer v = base.viewer();
        Document d = DocumentService.editable(v, base.visible(v, documentId));
        List<DocumentVersion> old = versions.findByDocumentIdOrderByVersionDesc(d.getId());
        List<UUID> people = new ArrayList<>(old.stream().map(DocumentVersion::getCreatedBy).toList());
        people.add(d.getCreatedBy());
        Map<UUID, String> names = base.userNames(people);
        List<DocumentVersionResponse> out = new ArrayList<>();
        out.add(new DocumentVersionResponse(d.getId(), d.getVersion(), d.getFileName(), d.getFileSize(),
                d.getUpdatedAt(), null, true));
        old.forEach(ver -> out.add(new DocumentVersionResponse(ver.getId(), ver.getVersion(), ver.getFileName(),
                ver.getFileSize(), ver.getCreatedAt(), names.get(ver.getCreatedBy()), false)));
        return out;
    }

    public DocumentService.FileContent download(UUID documentId, UUID versionId) {
        DocumentService.Viewer v = base.viewer();
        Document d = DocumentService.editable(v, base.visible(v, documentId));
        DocumentVersion ver = versions.findByIdAndDocumentId(versionId, d.getId())
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.DOCUMENT_VERSION_NOT_FOUND));
        try {
            return new DocumentService.FileContent(storage.read(ver.getStorageKey()), ver.getFileName(), ver.getContentType());
        } catch (IOException e) {
            log.error("Không đọc được tệp phiên bản {} của tài liệu {}: {}", versionId, documentId, e.getMessage());
            throw new BusinessException(ErrorCode.DOCUMENT_STORAGE_FAILED);
        }
    }

    /**
     * Khôi phục một bản cũ thành bản hiện hành. Bản hiện hành lại thành một phiên bản (không mất gì), số phiên bản tăng
     * như một lần thay tệp, và AI nạp lại nội dung.
     */
    public DocumentResponse restore(UUID documentId, UUID versionId) {
        DocumentService.Viewer v = base.viewer();
        Document current = DocumentService.editable(v, base.visible(v, documentId));
        DocumentVersion target = versions.findByIdAndDocumentId(versionId, current.getId())
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.DOCUMENT_VERSION_NOT_FOUND));
        base.checkQuota(v, current.getScope(), current.getOwnerUserId(), current.getOrgUnitId(),
                target.getFileSize() - current.getFileSize());

        List<String> expiredKeys = new ArrayList<>();
        Document updated = tx.execute(s -> {
            Document d = documents.findByIdForUpdate(documentId)
                    .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.DOCUMENT_NOT_FOUND));
            DocumentService.editable(v, d);
            DocumentVersion ver = versions.findByIdAndDocumentId(versionId, documentId)
                    .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.DOCUMENT_VERSION_NOT_FOUND));
            // Gỡ dòng phiên bản TRƯỚC khi lưu bản hiện hành: nếu không, bước cắt bớt bản cũ có thể xoá đúng tệp đang khôi phục.
            versions.delete(ver);
            versions.flush();
            expiredKeys.addAll(base.archiveCurrentVersion(d, v.user().getId()));
            d.setFileName(ver.getFileName());
            d.setContentType(ver.getContentType());
            d.setFileSize(ver.getFileSize());
            d.setContentSha256(ver.getContentSha256());
            d.setStorageProvider(ver.getStorageProvider());
            d.setStorageKey(ver.getStorageKey());
            d.setVersion(d.getVersion() + 1);
            if (Boolean.TRUE.equals(d.getAiEnabled())) base.requestReindex(d);
            Document saved = documents.save(d);
            DocumentService.afterCommit(() -> expiredKeys.forEach(base::deleteFileQuietly));
            return saved;
        });
        audit.record(SecurityAuditEvent.DOCUMENT_VERSION_RESTORED, SecurityAuditService.OK, "DOCUMENT",
                documentId.toString(), "v" + target.getVersion());
        return base.toResponse(v, updated);
    }
}
