package com.kpitracking.service.document;

import com.kpitracking.dto.response.document.DocumentResponse;
import com.kpitracking.entity.Document;
import com.kpitracking.entity.DocumentUserState;
import com.kpitracking.repository.DocumentRepository;
import com.kpitracking.repository.DocumentUserStateRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Trang chủ kiểu Lark (docs/DOCUMENTS_DESIGN.md §15.1): "Gần đây", ghim lên thanh bên, yêu thích. Trạng thái riêng của
 * từng người ({@link DocumentUserState}) không phải quyền — mọi danh sách ở đây lọc lại qua quyền xem hiện tại, nên
 * tài liệu đã mất quyền / đã xoá tự biến mất khỏi "Gần đây" và thanh ghim.
 */
@Service
public class DocumentHomeService {

    static final int RECENT_LIMIT = 50;
    private static final int MAX_PINNED = 30;

    private final DocumentService base;
    private final DocumentRepository documents;
    private final DocumentUserStateRepository states;
    private final TransactionTemplate tx;

    public DocumentHomeService(DocumentService base, DocumentRepository documents, DocumentUserStateRepository states,
                               PlatformTransactionManager txManager) {
        this.base = base;
        this.documents = documents;
        this.tx = new TransactionTemplate(txManager);
        this.states = states;
    }

    /**
     * Tài liệu mở gần đây, kèm tài liệu chính mình vừa tải lên (chưa mở lần nào vẫn hiện, như Lark). Sắp theo mốc
     * mới hơn giữa "mở gần nhất" và "tải lên".
     */
    public List<DocumentResponse> recent() {
        DocumentService.Viewer v = base.viewer();
        if (v.orgId() == null || !v.access().member()) return List.of();
        UUID me = v.user().getId();
        Map<UUID, Instant> opened = states.findRecent(me, PageRequest.of(0, RECENT_LIMIT)).stream()
                .collect(Collectors.toMap(DocumentUserState::getDocumentId, DocumentUserState::getLastOpenedAt, (a, b) -> a));
        Map<UUID, Document> docs = new LinkedHashMap<>();
        documents.findAllById(opened.keySet()).forEach(d -> docs.put(d.getId(), d));
        documents.findAll(v.access().toSpecification().and((r, q, cb) -> cb.equal(r.get("createdBy"), me)),
                        PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "createdAt")))
                .forEach(d -> docs.putIfAbsent(d.getId(), d));
        Function<Document, Instant> when = d -> {
            Instant o = opened.get(d.getId());
            return o != null && o.isAfter(d.getCreatedAt()) ? o : d.getCreatedAt();
        };
        List<Document> visible = docs.values().stream()
                .filter(d -> v.orgId().equals(d.getOrganizationId()) && v.access().canView(d))
                .sorted(Comparator.comparing(when).reversed())
                .limit(RECENT_LIMIT)
                .toList();
        return base.toResponses(v, visible);
    }

    /** Tài liệu ghim lên thanh bên, theo tên. */
    public List<DocumentResponse> pinned() {
        DocumentService.Viewer v = base.viewer();
        if (v.orgId() == null || !v.access().member()) return List.of();
        List<UUID> ids = states.findPinnedIds(v.user().getId());
        if (ids.isEmpty()) return List.of();
        List<Document> visible = documents.findAllById(ids).stream()
                .filter(d -> v.orgId().equals(d.getOrganizationId()) && v.access().canView(d))
                .sorted(Comparator.comparing(d -> d.getTitle().toLowerCase(Locale.ROOT)))
                .limit(MAX_PINNED)
                .toList();
        return base.toResponses(v, visible);
    }

    public DocumentResponse setFavorite(UUID id, boolean value) {
        DocumentService.Viewer v = base.viewer();
        Document d = base.visible(v, id);
        tx.executeWithoutResult(s -> states.setFavorite(v.user().getId(), d.getId(), value));
        return base.toResponse(v, d);
    }

    public DocumentResponse setPinned(UUID id, boolean value) {
        DocumentService.Viewer v = base.viewer();
        Document d = base.visible(v, id);
        tx.executeWithoutResult(s -> states.setPinned(v.user().getId(), d.getId(), value));
        return base.toResponse(v, d);
    }

    /** Ghi lần mở gần nhất (cho tab "Gần đây"). Không có quyền xem thì 404, không ghi gì. */
    public void markOpened(UUID id) {
        DocumentService.Viewer v = base.viewer();
        Document d = base.visible(v, id);
        tx.executeWithoutResult(s -> states.markOpened(v.user().getId(), d.getId(), Instant.now()));
    }
}
