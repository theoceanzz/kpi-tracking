package com.kpitracking.service.document;

import com.kpitracking.dto.request.document.ConvertToOnlineRequest;
import com.kpitracking.dto.request.document.CreateOnlineDocumentRequest;
import com.kpitracking.dto.request.document.SaveDocumentContentRequest;
import com.kpitracking.dto.response.document.DocumentContentResponse;
import com.kpitracking.dto.response.document.DocumentResponse;
import com.kpitracking.entity.Document;
import com.kpitracking.enums.DocumentAiStatus;
import com.kpitracking.enums.DocumentCategory;
import com.kpitracking.enums.DocumentScope;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.repository.DocumentRepository;
import com.kpitracking.security.audit.SecurityAuditEvent;
import com.kpitracking.security.audit.SecurityAuditService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Soạn tài liệu trực tuyến kiểu Lark Docs (trình soạn khối BlockNote ở frontend). Tài liệu tạo mới lưu thành tệp
 * {@code .kgdoc} — mảng khối JSON của BlockNote, giữ đủ định dạng (màu, căn lề, khối gập…); K.AI đọc qua
 * {@code BlockNoteParser}. Tệp {@code .md} có sẵn cũng mở được bằng trình soạn đó (lưu lại dạng Markdown), {@code .txt}
 * soạn chữ thuần. Tệp vẫn là tệp thường của thư viện — cùng quyền, cùng hạn mức, cùng phiên bản, cùng đường nạp AI —
 * chỉ khác cách đưa nội dung vào.
 *
 * <p>Trình soạn tự lưu vài giây một lần. Hai điều giữ cho việc đó rẻ:
 * <ul>
 *   <li><b>Gộp phiên soạn</b>: lần lưu của cùng một người cách lần trước không quá {@link #EDIT_SESSION} ghi đè bản
 *   hiện hành thay vì mở phiên bản mới — nếu không, mười lần tự lưu đẩy hết các phiên bản cũ thật sự ra khỏi trần.</li>
 *   <li><b>Nạp AI hoãn lại</b>: lưu chỉ đặt {@code PENDING}, không phát event. {@link DocumentIndexer#recoverStuck} nhặt
 *   tài liệu PENDING đã yên quá 2 phút, nên đang soạn liên tục thì chưa nạp, ngừng soạn vài phút thì AI đọc bản mới.</li>
 * </ul>
 *
 * <p>Không có soạn chung thời gian thực: hai người cùng sửa thì người lưu sau nhận {@code DOCUMENT_EDIT_CONFLICT}
 * (so {@code baseHash} với băm bản hiện hành) và tự chọn tải lại hay ghi đè — không bao giờ mất chữ im lặng.
 */
@Service
@Slf4j
public class DocumentEditService {

    /** Các lần lưu của cùng một người cách nhau không quá chừng này được gộp vào một phiên bản. */
    static final Duration EDIT_SESSION = Duration.ofMinutes(10);

    private final DocumentService base;
    private final DocumentRepository documents;
    private final DocumentStorage storage;
    private final SecurityAuditService audit;
    private final TransactionTemplate tx;

    public DocumentEditService(DocumentService base, DocumentRepository documents, DocumentStorage storage,
                               SecurityAuditService audit, PlatformTransactionManager txManager) {
        this.base = base;
        this.documents = documents;
        this.storage = storage;
        this.audit = audit;
        this.tx = new TransactionTemplate(txManager);
    }

    /** {@code blocks} / {@code markdown} / {@code text} khi tài liệu soạn trực tiếp được, ngược lại {@code null}. */
    public static String formatOf(String fileName) {
        return switch (DocumentStorage.extensionOf(fileName)) {
            case ".kgdoc" -> "blocks";
            case ".kgsheet" -> "sheet";
            case ".md" -> "markdown";
            case ".txt" -> "text";
            default -> null;
        };
    }

    public DocumentContentResponse content(UUID id) {
        DocumentService.Viewer v = base.viewer();
        Document d = base.visible(v, id);
        String format = requireTextFormat(d);
        byte[] bytes;
        try {
            bytes = storage.read(d.getStorageKey());
        } catch (IOException e) {
            log.error("Không đọc được tệp của tài liệu {}: {}", id, e.getMessage());
            throw new BusinessException(ErrorCode.DOCUMENT_STORAGE_FAILED);
        }
        if (d.getScope() != DocumentScope.PERSONAL) {
            audit.record(SecurityAuditEvent.DOCUMENT_DOWNLOADED, SecurityAuditService.OK, "DOCUMENT", id.toString(), d.getScope().name());
        }
        return new DocumentContentResponse(decode(bytes), format, d.getContentSha256(), d.getVersion());
    }

    /** Tài liệu trực tuyến mới ({@code .kgdoc}). Bản đầu tiên tính là phiên soạn của người tạo, nên lần lưu sau gộp vào nó. */
    public DocumentResponse create(CreateOnlineDocumentRequest req) {
        DocumentService.Viewer v = base.viewer();
        DocumentService.CreateTarget target = base.createTarget(v, req.scope(), req.orgUnitId(), req.folderId());
        String title = req.title() == null || req.title().isBlank()
                ? ErrorMessages.text("document.online.untitled", "Untitled document")
                : req.title().strip();
        boolean sheet = "sheet".equalsIgnoreCase(req.kind());
        byte[] bytes = encode(req.content(), sheet ? "sheet" : "blocks");
        DocumentPolicy.Checked checked = sheet
                ? DocumentPolicy.check(fileNameFor(title, DocumentPolicy.ONLINE_SHEET_EXTENSION), DocumentPolicy.ONLINE_SHEET_CONTENT_TYPE, bytes)
                : DocumentPolicy.check(fileNameFor(title), DocumentPolicy.ONLINE_CONTENT_TYPE, bytes);
        Document created = base.createFromBytes(v, bytes, checked, target.scope(), target.unitId(), v.user().getId(),
                title, null, req.category() == null ? DocumentCategory.OTHER : req.category(),
                !Boolean.FALSE.equals(req.aiEnabled()), null, v.user().getId(), false);
        UUID me = v.user().getId();
        Instant now = Instant.now();
        tx.executeWithoutResult(s -> documents.findByIdForUpdate(created.getId()).ifPresent(d -> {
            d.setFolderId(req.folderId());
            d.setContentEditedBy(me);
            d.setContentEditedAt(now);
            documents.save(d);
        }));
        created.setFolderId(req.folderId());
        return base.toResponse(v, created);
    }

    public DocumentResponse save(UUID id, SaveDocumentContentRequest req) {
        DocumentService.Viewer v = base.viewer();
        Document current = contentEditable(v, base.visible(v, id));
        String format = requireTextFormat(current);
        if (!req.baseHash().equals(current.getContentSha256())) throw new BusinessException(ErrorCode.DOCUMENT_EDIT_CONFLICT);
        byte[] bytes = encode(req.content(), format);
        DocumentPolicy.Checked checked = DocumentPolicy.check(current.getFileName(), current.getContentType(), bytes);
        String sha = DocumentService.sha256(bytes);
        if (sha.equals(current.getContentSha256())) return base.toResponse(v, current);
        base.checkQuota(v, current.getScope(), current.getOwnerUserId(), current.getOrgUnitId(),
                bytes.length - current.getFileSize());

        String key = base.store(bytes, checked.fileName(), v.orgId());
        UUID me = v.user().getId();
        List<String> obsoleteKeys = new ArrayList<>();
        try {
            Document updated = tx.execute(s -> {
                Document d = documents.findByIdForUpdate(id)
                        .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.DOCUMENT_NOT_FOUND));
                contentEditable(v, d);
                // Kiểm lại dưới khoá: hai lượt lưu đến cùng lúc thì chỉ một lượt thắng.
                if (!req.baseHash().equals(d.getContentSha256())) throw new BusinessException(ErrorCode.DOCUMENT_EDIT_CONFLICT);
                Instant now = Instant.now();
                boolean sameSession = me.equals(d.getContentEditedBy()) && d.getContentEditedAt() != null
                        && d.getContentEditedAt().isAfter(now.minus(EDIT_SESSION));
                if (sameSession) {
                    // Bản hiện hành là bản nháp của chính phiên này — thay hẳn, không giữ thành phiên bản.
                    obsoleteKeys.add(d.getStorageKey());
                } else {
                    obsoleteKeys.addAll(base.archiveCurrentVersion(d, me));
                    d.setVersion(d.getVersion() + 1);
                }
                d.setFileSize((long) bytes.length);
                d.setContentSha256(sha);
                d.setStorageKey(key);
                d.setStorageProvider(storage.provider());
                d.setContentEditedBy(me);
                d.setContentEditedAt(now);
                if (Boolean.TRUE.equals(d.getAiEnabled())) deferReindex(d);
                return documents.save(d);
            });
            obsoleteKeys.forEach(base::deleteFileQuietly);
            return base.toResponse(v, updated);
        } catch (RuntimeException e) {
            base.deleteFileQuietly(key);
            throw e;
        }
    }

    /**
     * Chuyển TẠI CHỖ một tệp .docx / .md thành tài liệu soạn trực tuyến ({@code .kgdoc}): vẫn là tài liệu đó (giữ chia sẻ,
     * ghim, yêu thích, thư mục), chỉ tệp hiện hành đổi. Tệp cũ thành một phiên bản như một lần "Thay tệp", khôi phục được
     * từ tab Phiên bản — chuyển định dạng mất ảnh, kiểu trang… nên bản gốc phải còn. Nội dung chuyển ở trình duyệt.
     *
     * <p>Bản vừa chuyển tính là phiên soạn của người chuyển: lần soạn tiếp theo gộp vào nó chứ không đẩy tệp gốc đi
     * thêm một nấc. AI nạp lại ngay (chỉ một lần, không như tự lưu).
     */
    public DocumentResponse convertInPlace(UUID id, ConvertToOnlineRequest req) {
        DocumentService.Viewer v = base.viewer();
        Document current = DocumentService.editable(v, base.visible(v, id));
        String ext = DocumentStorage.extensionOf(current.getFileName());
        // Văn bản → tài liệu khối; bảng (Excel, CSV) → bảng tính.
        boolean sheet = ".xlsx".equals(ext) || ".csv".equals(ext);
        if (!sheet && !".docx".equals(ext) && !".md".equals(ext)) throw new BusinessException(ErrorCode.DOCUMENT_NOT_CONVERTIBLE);
        if (!req.baseHash().equals(current.getContentSha256())) throw new BusinessException(ErrorCode.DOCUMENT_EDIT_CONFLICT);
        byte[] bytes = encode(req.content(), sheet ? "sheet" : "blocks");
        String baseName = DocumentPolicy.defaultTitle(current.getFileName());
        DocumentPolicy.Checked checked = sheet
                ? DocumentPolicy.check(fileNameFor(baseName, DocumentPolicy.ONLINE_SHEET_EXTENSION), DocumentPolicy.ONLINE_SHEET_CONTENT_TYPE, bytes)
                : DocumentPolicy.check(fileNameFor(baseName), DocumentPolicy.ONLINE_CONTENT_TYPE, bytes);
        base.checkQuota(v, current.getScope(), current.getOwnerUserId(), current.getOrgUnitId(),
                bytes.length - current.getFileSize());

        String key = base.store(bytes, checked.fileName(), v.orgId());
        UUID me = v.user().getId();
        List<String> expiredKeys = new ArrayList<>();
        try {
            Document updated = tx.execute(s -> {
                Document d = documents.findByIdForUpdate(id)
                        .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.DOCUMENT_NOT_FOUND));
                DocumentService.editable(v, d);
                if (!req.baseHash().equals(d.getContentSha256())) throw new BusinessException(ErrorCode.DOCUMENT_EDIT_CONFLICT);
                expiredKeys.addAll(base.archiveCurrentVersion(d, me));
                d.setFileName(checked.fileName());
                d.setContentType(checked.contentType());
                d.setFileSize((long) bytes.length);
                d.setContentSha256(DocumentService.sha256(bytes));
                d.setStorageKey(key);
                d.setStorageProvider(storage.provider());
                d.setVersion(d.getVersion() + 1);
                d.setContentEditedBy(me);
                d.setContentEditedAt(Instant.now());
                if (Boolean.TRUE.equals(d.getAiEnabled())) base.requestReindex(d);
                return documents.save(d);
            });
            expiredKeys.forEach(base::deleteFileQuietly);
            audit.record(SecurityAuditEvent.DOCUMENT_UPLOADED, SecurityAuditService.OK, "DOCUMENT", id.toString(),
                    "convert " + ext + " -> " + DocumentStorage.extensionOf(checked.fileName()));
            return base.toResponse(v, updated);
        } catch (RuntimeException e) {
            base.deleteFileQuietly(key);
            throw e;
        }
    }

    /**
     * Cần nạp lại nhưng KHÔNG phát event — xem javadoc của lớp. Đang INDEXING thì để nguyên: bước chốt của
     * {@link DocumentIndexer} thấy tệp đã đổi và tự nạp lại.
     */
    private static void deferReindex(Document d) {
        if (d.getAiStatus() == DocumentAiStatus.INDEXING) return;
        d.setAiStatus(DocumentAiStatus.PENDING);
        d.setAiErrorI18n(null);
    }

    /** Người quản lý, hoặc người được chia sẻ quyền chỉnh sửa (chỉ nội dung). */
    private static Document contentEditable(DocumentService.Viewer v, Document d) {
        if (!v.access().canEditContent(d)) throw new ForbiddenException(ErrorCode.DOCUMENT_FORBIDDEN);
        return d;
    }

    private static String requireTextFormat(Document d) {
        String format = formatOf(d.getFileName());
        if (format == null) throw new BusinessException(ErrorCode.DOCUMENT_NOT_TEXT_EDITABLE);
        return format;
    }

    /** Tệp không được rỗng ({@link DocumentPolicy}): tài liệu khối trống lưu {@code []}, chữ trống lưu một dòng trống. */
    private static byte[] encode(String content, String format) {
        String empty = "blocks".equals(format) ? "[]" : "sheet".equals(format) ? "{}" : "\n";
        String text = content == null || content.isBlank() ? empty : content;
        return text.getBytes(StandardCharsets.UTF_8);
    }

    private static String decode(byte[] bytes) {
        String s = new String(bytes, StandardCharsets.UTF_8);
        return !s.isEmpty() && s.charAt(0) == 0xFEFF ? s.substring(1) : s;
    }

    /** Tên tệp từ tiêu đề: bỏ ký tự cấm trong tên tệp (nhất là "/" — {@code safeFileName} coi là đường dẫn và cắt mất). */
    static String fileNameFor(String title) {
        return fileNameFor(title, DocumentPolicy.ONLINE_EXTENSION);
    }

    static String fileNameFor(String title, String extension) {
        String base = title.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "-").strip();
        return DocumentPolicy.safeFileName((base.isEmpty() ? "tai-lieu" : base) + "." + extension);
    }
}
