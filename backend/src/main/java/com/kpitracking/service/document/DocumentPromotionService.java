package com.kpitracking.service.document;

import com.kpitracking.dto.request.document.PromotionDecisionRequest;
import com.kpitracking.dto.request.document.PromotionRequest;
import com.kpitracking.dto.response.document.DocumentPromotionResponse;
import com.kpitracking.dto.response.document.DocumentResponse;
import com.kpitracking.entity.Document;
import com.kpitracking.entity.DocumentPromotionRequest;
import com.kpitracking.entity.DocumentPromotionRequest.Status;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.enums.DocumentScope;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.repository.DocumentPromotionRequestRepository;
import com.kpitracking.repository.DocumentRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.security.audit.SecurityAuditEvent;
import com.kpitracking.security.audit.SecurityAuditService;
import com.kpitracking.service.notification.NotificationDispatcher;
import com.kpitracking.service.reward.RewardContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Đề xuất đưa tài liệu lên đơn vị / công ty có bước duyệt (docs/DOCUMENTS_DESIGN.md §16.2).
 *
 * <ul>
 *   <li>Ai đề xuất: người SỬA được tài liệu (chủ tài liệu cá nhân, người quản lý tài liệu đơn vị) nhưng KHÔNG tự tạo
 *       được ở phạm vi đích — tạo được thì cứ đổi phạm vi, khỏi chờ ai.</li>
 *   <li>Đích đơn vị: chỉ đơn vị mình xem được (đơn vị mình và các đơn vị cha) — không "đẩy" tài liệu sang phòng khác.</li>
 *   <li>Ai duyệt: ai tạo được tài liệu ở phạm vi đích ({@link DocumentAccess#canCreate}). Thông báo chỉ tới cấp quản lý
 *       gần nhất ({@link DocumentManagers}), nhưng mọi người có quyền đều thấy trong hộp "Chờ tôi duyệt".</li>
 *   <li>Duyệt = SAO CHÉP tệp thành tài liệu mới ở phạm vi đích, người tạo ghi là người đề xuất; tài liệu gốc giữ
 *       nguyên (vẫn là của người đề xuất). Bản sao tính vào hạn mức của phạm vi đích.</li>
 * </ul>
 * Người duyệt không xem được tài liệu gốc qua quyền thường (tài liệu cá nhân) — xem qua {@link #file}, chỉ khi đang
 * có quyền quyết định đề xuất đó.
 */
@Service
@Slf4j
public class DocumentPromotionService {

    static final String EVENT_REQUESTED = "document_promotion_requested";
    static final String EVENT_DECIDED = "document_promotion_decided";
    /** Thông báo cho người duyệt (bấm → hộp "Chờ tôi duyệt"); referenceId = id đề xuất. */
    static final String TYPE_REQUEST = "DOCUMENT_PROMOTION_REQUEST";
    /** Thông báo kết quả cho người đề xuất (bấm → mở tài liệu); referenceId = id tài liệu. */
    static final String TYPE = "DOCUMENT_PROMOTION";

    private final DocumentService base;
    private final DocumentRepository documents;
    private final DocumentPromotionRequestRepository requests;
    private final DocumentStorage storage;
    private final DocumentManagers managers;
    private final UserRepository users;
    private final NotificationDispatcher notifications;
    private final RewardContext context;
    private final SecurityAuditService audit;
    private final TransactionTemplate tx;

    public DocumentPromotionService(DocumentService base, DocumentRepository documents,
                                    DocumentPromotionRequestRepository requests, DocumentStorage storage,
                                    DocumentManagers managers, UserRepository users, NotificationDispatcher notifications,
                                    RewardContext context, SecurityAuditService audit, PlatformTransactionManager txManager) {
        this.base = base;
        this.documents = documents;
        this.requests = requests;
        this.storage = storage;
        this.managers = managers;
        this.users = users;
        this.notifications = notifications;
        this.context = context;
        this.audit = audit;
        this.tx = new TransactionTemplate(txManager);
    }

    // ── Đề xuất ────────────────────────────────────────────────────────────────────────────────────

    public DocumentPromotionResponse create(UUID documentId, PromotionRequest req) {
        DocumentService.Viewer v = base.viewer();
        DocumentAccess a = v.access();
        Document d = DocumentService.editable(v, base.visible(v, documentId));
        DocumentScope target = req.targetScope();
        UUID unit = target == DocumentScope.UNIT ? req.targetUnitId() : null;
        if (target == DocumentScope.PERSONAL || (target == DocumentScope.UNIT && unit == null)) {
            throw new BusinessException(ErrorCode.DOCUMENT_PROMOTION_INVALID_TARGET);
        }
        if (target == DocumentScope.UNIT && !a.visibleUnitIds().contains(unit)) {
            throw new BusinessException(ErrorCode.DOCUMENT_PROMOTION_INVALID_TARGET);
        }
        // Đơn vị gốc không phải đích (xem DocumentAccessResolver.compute) — lên cả công ty thì đề xuất lên Công ty.
        DocumentService.rejectRootUnit(v, target, unit);
        if (d.getScope() == target && Objects.equals(d.getOrgUnitId(), unit)) {
            throw new BusinessException(ErrorCode.DOCUMENT_PROMOTION_INVALID_TARGET);
        }
        if (a.canCreate(target, unit)) throw new BusinessException(ErrorCode.DOCUMENT_PROMOTION_NOT_NEEDED);
        if (requests.existsByDocumentIdAndTargetScopeAndTargetUnitIdAndStatus(d.getId(), target, unit, Status.PENDING)) {
            throw new BusinessException(ErrorCode.DOCUMENT_PROMOTION_DUPLICATE);
        }
        String note = req.note() == null || req.note().isBlank() ? null : req.note().strip();
        DocumentPromotionRequest saved = requests.save(DocumentPromotionRequest.builder()
                .organizationId(v.orgId())
                .documentId(d.getId())
                .targetScope(target)
                .targetUnitId(unit)
                .note(note)
                .requestedBy(v.user().getId())
                .build());

        LocalizedText where = targetLabel(v, target, unit);
        LocalizedText title = LocalizedText.of("notif.document.promotion.requested.title", where);
        LocalizedText message = LocalizedText.of("notif.document.promotion.requested.message", v.user().getFullName(),
                d.getTitle(), where, note == null ? "" : LocalizedText.of("notif.document.promotion.noteSuffix", note));
        for (User m : managers.of(target, unit, null, v.units())) {
            if (!m.getId().equals(v.user().getId())) notify(v.orgId(), EVENT_REQUESTED, TYPE_REQUEST, m, title, message, saved.getId());
        }
        return toResponses(v, List.of(saved)).get(0);
    }

    /** Đề xuất đang chờ mà người xem quyết được. */
    public List<DocumentPromotionResponse> inbox() {
        DocumentService.Viewer v = base.viewer();
        if (v.orgId() == null || !v.access().member()) return List.of();
        List<DocumentPromotionRequest> pending = requests.findByOrganizationIdAndStatusOrderByCreatedAtAsc(v.orgId(), Status.PENDING)
                .stream().filter(r -> canDecide(v, r)).toList();
        return toResponses(v, pending);
    }

    /** Đề xuất mình đã gửi (mới nhất trước, tối đa 50). */
    public List<DocumentPromotionResponse> mine() {
        DocumentService.Viewer v = base.viewer();
        if (v.orgId() == null) return List.of();
        return toResponses(v, requests.findTop50ByOrganizationIdAndRequestedByOrderByCreatedAtDesc(v.orgId(), v.user().getId()));
    }

    /** Đề xuất đang chờ của một tài liệu — để drawer hiện "Đã đề xuất lên …". */
    public List<DocumentPromotionResponse> ofDocument(UUID documentId) {
        DocumentService.Viewer v = base.viewer();
        Document d = DocumentService.editable(v, base.visible(v, documentId));
        return toResponses(v, requests.findByDocumentIdAndStatus(d.getId(), Status.PENDING));
    }

    // ── Quyết định ─────────────────────────────────────────────────────────────────────────────────

    public DocumentResponse approve(UUID id, PromotionDecisionRequest req) {
        DocumentService.Viewer v = base.viewer();
        DocumentPromotionRequest r = decidable(v, id);
        Document src = documents.findByIdAndOrganizationId(r.getDocumentId(), v.orgId()).orElse(null);
        if (src == null) {
            // Tài liệu gốc đã bị xoá trong lúc chờ: đề xuất tự huỷ, báo rõ thay vì để treo mãi.
            tx.executeWithoutResult(s -> requests.decide(id, Status.CANCELLED, v.user().getId(), Instant.now(), null));
            throw new ResourceNotFoundException(ErrorCode.DOCUMENT_NOT_FOUND);
        }
        byte[] bytes;
        try {
            bytes = storage.read(src.getStorageKey());
        } catch (IOException e) {
            log.error("Không đọc được tệp gốc khi duyệt đề xuất {}: {}", id, e.getMessage());
            throw new BusinessException(ErrorCode.DOCUMENT_STORAGE_FAILED);
        }
        String note = clean(req == null ? null : req.note());
        Integer claimed = tx.execute(s -> requests.decide(id, Status.APPROVED, v.user().getId(), Instant.now(), note));
        if (claimed == null || claimed == 0) throw new BusinessException(ErrorCode.DOCUMENT_PROMOTION_NOT_PENDING);

        Document copy;
        try {
            String title = req == null || req.title() == null || req.title().isBlank() ? src.getTitle() : req.title().strip();
            DocumentPolicy.Checked checked = new DocumentPolicy.Checked(src.getFileName(),
                    DocumentPolicy.extensionOf(src.getFileName()), src.getContentType());
            copy = base.createFromBytes(v, bytes, checked, r.getTargetScope(), r.getTargetUnitId(), null, title,
                    src.getDescription(), src.getCategory(), true, null, r.getRequestedBy());
        } catch (RuntimeException e) {
            // Sao chép hỏng (vượt hạn mức, trùng nội dung…): trả đề xuất về chờ để người duyệt xử lý rồi duyệt lại.
            tx.executeWithoutResult(s -> requests.findById(id).ifPresent(back -> {
                back.setStatus(Status.PENDING);
                back.setDecidedBy(null);
                back.setDecidedAt(null);
                back.setDecisionNote(null);
                requests.save(back);
            }));
            throw e;
        }
        tx.executeWithoutResult(s -> requests.findById(id).ifPresent(done -> {
            done.setResultDocumentId(copy.getId());
            requests.save(done);
        }));
        audit.record(SecurityAuditEvent.DOCUMENT_PROMOTED, SecurityAuditService.OK, "DOCUMENT", copy.getId().toString(),
                r.getTargetScope().name() + " from " + src.getId());

        LocalizedText where = targetLabel(v, r.getTargetScope(), r.getTargetUnitId());
        users.findById(r.getRequestedBy()).ifPresent(u -> notify(v.orgId(), EVENT_DECIDED, TYPE, u,
                LocalizedText.of("notif.document.promotion.approved.title"),
                LocalizedText.of("notif.document.promotion.approved.message", v.user().getFullName(), src.getTitle(), where),
                copy.getId()));
        return base.toResponse(v, copy);
    }

    public DocumentPromotionResponse reject(UUID id, PromotionDecisionRequest req) {
        DocumentService.Viewer v = base.viewer();
        DocumentPromotionRequest r = decidable(v, id);
        String note = clean(req == null ? null : req.note());
        Integer n = tx.execute(s -> requests.decide(id, Status.REJECTED, v.user().getId(), Instant.now(), note));
        if (n == null || n == 0) throw new BusinessException(ErrorCode.DOCUMENT_PROMOTION_NOT_PENDING);

        String docTitle = documents.findById(r.getDocumentId()).map(Document::getTitle).orElse("");
        LocalizedText where = targetLabel(v, r.getTargetScope(), r.getTargetUnitId());
        users.findById(r.getRequestedBy()).ifPresent(u -> notify(v.orgId(), EVENT_DECIDED, TYPE, u,
                LocalizedText.of("notif.document.promotion.rejected.title"),
                LocalizedText.of("notif.document.promotion.rejected.message", v.user().getFullName(), docTitle, where,
                        note == null ? "" : LocalizedText.of("notif.document.promotion.reasonSuffix", note)),
                r.getDocumentId()));
        return toResponses(v, List.of(requests.findById(id).orElse(r))).get(0);
    }

    /** Người đề xuất rút lại khi còn chờ. */
    public void cancel(UUID id) {
        DocumentService.Viewer v = base.viewer();
        DocumentPromotionRequest r = requests.findByIdAndOrganizationId(id, v.orgId())
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.DOCUMENT_PROMOTION_NOT_FOUND));
        if (!r.getRequestedBy().equals(v.user().getId())) throw new ResourceNotFoundException(ErrorCode.DOCUMENT_PROMOTION_NOT_FOUND);
        Integer n = tx.execute(s -> requests.decide(id, Status.CANCELLED, v.user().getId(), Instant.now(), null));
        if (n == null || n == 0) throw new BusinessException(ErrorCode.DOCUMENT_PROMOTION_NOT_PENDING);
    }

    /** Tệp gốc để người duyệt xem trước khi quyết (và người đề xuất xem lại). */
    public DocumentService.FileContent file(UUID id) {
        DocumentService.Viewer v = base.viewer();
        DocumentPromotionRequest r = requests.findByIdAndOrganizationId(id, v.orgId())
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.DOCUMENT_PROMOTION_NOT_FOUND));
        boolean mine = r.getRequestedBy().equals(v.user().getId());
        if (!mine && !(r.getStatus() == Status.PENDING && canDecide(v, r))) {
            throw new ResourceNotFoundException(ErrorCode.DOCUMENT_PROMOTION_NOT_FOUND);
        }
        Document src = documents.findByIdAndOrganizationId(r.getDocumentId(), v.orgId())
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.DOCUMENT_NOT_FOUND));
        try {
            return new DocumentService.FileContent(storage.read(src.getStorageKey()), src.getFileName(), src.getContentType());
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.DOCUMENT_STORAGE_FAILED);
        }
    }

    // ── trợ giúp ───────────────────────────────────────────────────────────────────────────────────

    private static boolean canDecide(DocumentService.Viewer v, DocumentPromotionRequest r) {
        return v.access().canCreate(r.getTargetScope(), r.getTargetUnitId());
    }

    private DocumentPromotionRequest decidable(DocumentService.Viewer v, UUID id) {
        DocumentPromotionRequest r = requests.findByIdAndOrganizationId(id, v.orgId())
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.DOCUMENT_PROMOTION_NOT_FOUND));
        if (!canDecide(v, r)) throw new ForbiddenException(ErrorCode.DOCUMENT_FORBIDDEN);
        if (r.getStatus() != Status.PENDING) throw new BusinessException(ErrorCode.DOCUMENT_PROMOTION_NOT_PENDING);
        return r;
    }

    private static LocalizedText targetLabel(DocumentService.Viewer v, DocumentScope scope, UUID unitId) {
        if (scope == DocumentScope.COMPANY) return LocalizedText.of("notif.document.target.company");
        OrgUnit u = unitId == null ? null : v.units().get(unitId);
        return LocalizedText.of("notif.document.target.unit", u == null ? "—" : u.getName());
    }

    private void notify(UUID orgId, String event, String type, User to, LocalizedText title, LocalizedText message, UUID ref) {
        OrgUnit unit;
        try {
            unit = context.getPrimaryOrgUnit(to.getId());
        } catch (ResourceNotFoundException e) {
            return;
        }
        notifications.dispatch(orgId, event, to, unit, title, message, type, ref);
    }

    private static String clean(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }

    private List<DocumentPromotionResponse> toResponses(DocumentService.Viewer v, List<DocumentPromotionRequest> list) {
        if (list.isEmpty()) return List.of();
        Map<UUID, Document> docs = documents.findAllById(list.stream().map(DocumentPromotionRequest::getDocumentId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(Document::getId, Function.identity(), (a, b) -> a));
        List<UUID> people = new ArrayList<>();
        list.forEach(r -> { people.add(r.getRequestedBy()); people.add(r.getDecidedBy()); });
        Map<UUID, String> names = base.userNames(people);
        UUID me = v.user().getId();
        return list.stream().map(r -> {
            Document d = docs.get(r.getDocumentId());
            OrgUnit unit = r.getTargetUnitId() == null ? null : v.units().get(r.getTargetUnitId());
            return new DocumentPromotionResponse(r.getId(), r.getStatus(), r.getDocumentId(),
                    d == null ? null : d.getTitle(), d == null ? null : d.getFileName(),
                    d == null ? null : d.getContentType(), d == null ? null : d.getFileSize(),
                    d == null ? null : d.getCategory(), d == null ? null : d.getScope(),
                    r.getTargetScope(), r.getTargetUnitId(), unit == null ? null : unit.getName(), r.getNote(),
                    r.getRequestedBy(), names.get(r.getRequestedBy()), r.getCreatedAt(),
                    r.getDecidedBy() == null ? null : names.get(r.getDecidedBy()), r.getDecidedAt(), r.getDecisionNote(),
                    r.getResultDocumentId(),
                    r.getStatus() == Status.PENDING && canDecide(v, r),
                    r.getStatus() == Status.PENDING && r.getRequestedBy().equals(me));
        }).toList();
    }
}
