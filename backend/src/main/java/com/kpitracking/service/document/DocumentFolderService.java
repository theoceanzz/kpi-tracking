package com.kpitracking.service.document;

import com.kpitracking.dto.request.document.CreateFolderRequest;
import com.kpitracking.dto.response.document.DocumentFolderListResponse;
import com.kpitracking.dto.response.document.DocumentFolderResponse;
import com.kpitracking.dto.response.document.DocumentResponse;
import com.kpitracking.entity.Document;
import com.kpitracking.entity.DocumentFolder;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.enums.DocumentScope;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.DocumentFolderRepository;
import com.kpitracking.repository.DocumentRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.*;

/**
 * Thư mục của thư viện tài liệu — phần "Drive" kiểu Lark (docs/DOCUMENTS_DESIGN.md §15.2).
 *
 * <p>Thư mục thuộc ĐÚNG MỘT phạm vi (kho cá nhân của một người, một đơn vị, hoặc công ty) và chỉ chứa tài liệu cùng
 * phạm vi đó. Thư mục không phải một lớp quyền: ai xem được phạm vi thì xem được thư mục; sửa thư mục cần quyền tạo
 * tài liệu ở phạm vi đó ({@link DocumentAccess#canEditFolder}).
 *
 * <p>Xoá thư mục = xoá cả cây thư mục con, tài liệu bên trong vào THÙNG RÁC (khôi phục được 30 ngày, về gốc của phạm
 * vi vì thư mục cũ không còn).
 */
@Service
@Slf4j
public class DocumentFolderService {

    private final DocumentService base;
    private final DocumentFolderRepository folders;
    private final DocumentRepository documents;
    private final TransactionTemplate tx;

    public DocumentFolderService(DocumentService base, DocumentFolderRepository folders, DocumentRepository documents,
                                 PlatformTransactionManager txManager) {
        this.base = base;
        this.folders = folders;
        this.documents = documents;
        this.tx = new TransactionTemplate(txManager);
    }

    /**
     * Một cấp thư mục: gốc của phạm vi ({@code parentId = null}, cần {@code scope} [+ {@code unitId}]) hoặc bên trong
     * {@code parentId}.
     */
    public DocumentFolderListResponse list(DocumentScope scope, UUID unitId, UUID parentId) {
        DocumentService.Viewer v = base.viewer();
        DocumentAccess a = v.access();
        if (parentId != null) {
            DocumentFolder parent = visibleFolder(v, parentId);
            List<DocumentFolder> children = folders.findAll(childrenOf(parent.getId()), Sort.by("name"));
            return new DocumentFolderListResponse(toResponse(v, parent), breadcrumb(v, parent),
                    children.stream().map(f -> toResponse(v, f)).toList(), a.canEditFolder(parent));
        }
        if (scope == null) throw new BusinessException(ErrorCode.DOCUMENT_SCOPE_INVALID, "null");
        if (scope == DocumentScope.UNIT && (unitId == null || !a.visibleUnitIds().contains(unitId))) {
            return new DocumentFolderListResponse(null, List.of(), List.of(), false);
        }
        UUID me = v.user().getId();
        Specification<DocumentFolder> spec = (r, q, cb) -> cb.and(
                cb.equal(r.get("organizationId"), v.orgId()),
                cb.equal(r.get("scope"), scope),
                cb.isNull(r.get("parentId")),
                scope == DocumentScope.PERSONAL ? cb.equal(r.get("ownerUserId"), me)
                        : scope == DocumentScope.UNIT ? cb.equal(r.get("orgUnitId"), unitId) : cb.conjunction());
        List<DocumentFolder> roots = a.member() ? folders.findAll(spec, Sort.by("name")) : List.of();
        return new DocumentFolderListResponse(null, List.of(), roots.stream().map(f -> toResponse(v, f)).toList(),
                a.canCreate(scope, unitId));
    }

    public DocumentFolderResponse create(CreateFolderRequest req) {
        DocumentService.Viewer v = base.viewer();
        DocumentAccess a = v.access();
        String name = cleanName(req.name());
        DocumentFolder.DocumentFolderBuilder b = DocumentFolder.builder()
                .organizationId(v.orgId())
                .name(name)
                .createdBy(v.user().getId());
        if (req.parentId() != null) {
            DocumentFolder parent = visibleFolder(v, req.parentId());
            if (!a.canEditFolder(parent)) throw new ForbiddenException(ErrorCode.DOCUMENT_FORBIDDEN);
            // Thư mục con kế thừa phạm vi của cha — không có thư mục công ty nằm trong kho cá nhân.
            b.scope(parent.getScope()).ownerUserId(parent.getOwnerUserId()).orgUnitId(parent.getOrgUnitId())
                    .parentId(parent.getId());
        } else {
            DocumentScope scope = req.scope();
            if (scope == null) throw new BusinessException(ErrorCode.DOCUMENT_SCOPE_INVALID, "null");
            DocumentService.rejectRootUnit(v, scope, req.orgUnitId());
            if (!a.canCreate(scope, req.orgUnitId())) throw new ForbiddenException(ErrorCode.DOCUMENT_FORBIDDEN);
            b.scope(scope)
                    .ownerUserId(scope == DocumentScope.PERSONAL ? v.user().getId() : null)
                    .orgUnitId(scope == DocumentScope.UNIT ? req.orgUnitId() : null);
        }
        DocumentFolder saved = folders.save(b.build());
        return toResponse(v, saved);
    }

    public DocumentFolderResponse rename(UUID id, String name) {
        DocumentService.Viewer v = base.viewer();
        DocumentFolder f = editableFolder(v, id);
        f.setName(cleanName(name));
        return toResponse(v, folders.save(f));
    }

    /**
     * Xoá thư mục và cả cây con. Tài liệu bên trong vào thùng rác TRƯỚC (gỡ vector từng tài liệu), rồi mới xoá mềm
     * các thư mục.
     *
     * @return số tài liệu đã đưa vào thùng rác
     */
    public int delete(UUID id) {
        DocumentService.Viewer v = base.viewer();
        DocumentFolder f = editableFolder(v, id);
        List<UUID> tree = folders.findSubtreeIds(f.getId());
        List<Document> inside = documents.findByFolderIdIn(tree);
        int trashed = base.softDeleteAll(inside, v.user().getId());
        tx.executeWithoutResult(s -> folders.softDeleteAll(tree, Instant.now()));
        return trashed;
    }

    /** Chuyển tài liệu vào thư mục cùng phạm vi, hoặc về gốc ({@code folderId = null}). */
    public DocumentResponse moveDocument(UUID documentId, UUID folderId) {
        DocumentService.Viewer v = base.viewer();
        Document d = DocumentService.editable(v, base.visible(v, documentId));
        if (folderId != null) {
            DocumentFolder f = editableFolder(v, folderId);
            boolean sameScope = f.getScope() == d.getScope()
                    && Objects.equals(f.getOwnerUserId(), d.getOwnerUserId())
                    && Objects.equals(f.getOrgUnitId(), d.getOrgUnitId());
            if (!sameScope) throw new BusinessException(ErrorCode.DOCUMENT_FOLDER_SCOPE_MISMATCH);
        }
        Document saved = tx.execute(s -> documents.findByIdForUpdate(documentId).map(doc -> {
            doc.setFolderId(folderId);
            return documents.save(doc);
        }).orElseThrow(() -> new ResourceNotFoundException(ErrorCode.DOCUMENT_NOT_FOUND)));
        return base.toResponse(v, saved);
    }

    // ── trợ giúp ───────────────────────────────────────────────────────────────────────────────────

    DocumentFolder visibleFolder(DocumentService.Viewer v, UUID id) {
        DocumentFolder f = v.orgId() == null ? null : folders.findByIdAndOrganizationId(id, v.orgId()).orElse(null);
        if (f == null || !v.access().canViewFolder(f)) throw new ResourceNotFoundException(ErrorCode.DOCUMENT_FOLDER_NOT_FOUND);
        return f;
    }

    private DocumentFolder editableFolder(DocumentService.Viewer v, UUID id) {
        DocumentFolder f = visibleFolder(v, id);
        if (!v.access().canEditFolder(f)) throw new ForbiddenException(ErrorCode.DOCUMENT_FORBIDDEN);
        return f;
    }

    private static Specification<DocumentFolder> childrenOf(UUID parentId) {
        return (r, q, cb) -> cb.equal(r.get("parentId"), parentId);
    }

    /** Đường dẫn từ gốc tới {@code f} (gồm cả {@code f}). Có trần độ sâu để dữ liệu hỏng không làm treo. */
    private List<DocumentFolderResponse> breadcrumb(DocumentService.Viewer v, DocumentFolder f) {
        LinkedList<DocumentFolderResponse> path = new LinkedList<>();
        DocumentFolder cur = f;
        for (int depth = 0; cur != null && depth < 32; depth++) {
            path.addFirst(toResponse(v, cur));
            cur = cur.getParentId() == null ? null : folders.findById(cur.getParentId()).orElse(null);
        }
        return path;
    }

    private DocumentFolderResponse toResponse(DocumentService.Viewer v, DocumentFolder f) {
        OrgUnit unit = f.getOrgUnitId() == null ? null : v.units().get(f.getOrgUnitId());
        String creator = base.userNames(List.of(f.getCreatedBy())).get(f.getCreatedBy());
        return new DocumentFolderResponse(f.getId(), f.getName(), f.getScope(), f.getOrgUnitId(),
                unit == null ? null : unit.getName(), f.getParentId(), v.access().canEditFolder(f), f.getCreatedAt(), creator);
    }

    private static String cleanName(String name) {
        String n = name == null ? "" : name.strip();
        if (n.isEmpty()) throw new BusinessException(ErrorCode.DOCUMENT_FOLDER_NAME_REQUIRED);
        return n.length() <= 255 ? n : n.substring(0, 255);
    }
}
