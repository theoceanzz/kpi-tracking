package com.kpitracking.service.document;

import com.kpitracking.dto.request.document.SendDocumentEmailRequest;
import com.kpitracking.dto.response.document.DocumentContentResponse;
import com.kpitracking.dto.response.document.DocumentPublicLinkResponse;
import com.kpitracking.dto.response.document.PublicDocumentResponse;
import com.kpitracking.entity.Document;
import com.kpitracking.entity.DocumentPublicLink;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.repository.DocumentPublicLinkRepository;
import com.kpitracking.repository.DocumentRepository;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.security.audit.SecurityAuditEvent;
import com.kpitracking.security.audit.SecurityAuditService;
import com.kpitracking.service.EmailService;
import com.kpitracking.service.email.EmailLayout;
import com.kpitracking.service.email.MailDocRenderer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.util.HtmlUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Gửi tài liệu qua email cho bất kỳ ai, kể cả người không dùng hệ thống. Thư là thứ chính (người gửi tự soạn tiêu đề,
 * lời nhắn); tài liệu đi kèm như một tệp đính kèm, dưới dạng LINK CÔNG KHAI có hạn dùng — người nhận bấm là mở, không
 * cần tài khoản.
 *
 * <p>Ai được gửi: chỉ người QUẢN LÝ tài liệu ({@link DocumentAccess#canEdit}) — cùng luật với chia sẻ. Gửi ra ngoài
 * mạnh hơn chia sẻ trong tổ chức, nên người chỉ được chia sẻ xem không được đưa tiếp tài liệu ra ngoài.
 *
 * <p>Link: token ngẫu nhiên 256 bit, chỉ lưu SHA-256. Mỗi lần gửi một link riêng để thu hồi đúng lần gửi đó. Link luôn
 * mở bản HIỆN HÀNH; tài liệu vào thùng rác / link hết hạn / bị thu hồi thì trang công khai báo "không còn mở được".
 */
@Service
@Slf4j
public class DocumentEmailService {

    public static final int DEFAULT_EXPIRES_DAYS = 30;
    public static final int MAX_EXPIRES_DAYS = 90;
    static final int MAX_RECIPIENTS = 20;
    static final int MAX_SUBJECT = 200;
    static final int MAX_MESSAGE = 5000;
    /** JSON của trình soạn dài hơn chữ nhiều (cấu trúc, định dạng) — trần riêng, đủ rộng cho 5000 ký tự có định dạng. */
    static final int MAX_MESSAGE_DOC = 200_000;
    /** Số lần gửi tối đa của một người trong một giờ — chặn dùng máy chủ thư của hệ thống để rải thư. */
    static final int MAX_SENDS_PER_HOUR = 30;

    /** Đủ chặt để loại địa chỉ gõ nhầm, không cố kiểm hết RFC 5322 (máy chủ thư mới là nơi quyết). */
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@,;<>\"]+@[^\\s@,;<>\"]+\\.[^\\s@,;<>\"]{2,}$");
    private static final SecureRandom RANDOM = new SecureRandom();

    private final DocumentService base;
    private final DocumentRepository documents;
    private final DocumentPublicLinkRepository links;
    private final OrganizationRepository organizations;
    private final DocumentStorage storage;
    private final EmailService email;
    private final SecurityAuditService audit;
    private final TransactionTemplate tx;
    private final String frontendUrl;

    public DocumentEmailService(DocumentService base, DocumentRepository documents, DocumentPublicLinkRepository links,
                                OrganizationRepository organizations, DocumentStorage storage, EmailService email,
                                SecurityAuditService audit, PlatformTransactionManager txManager,
                                @Value("${app.frontend-url:${app.cors.allowed-origins:http://localhost:3000}}") String frontendUrl) {
        this.base = base;
        this.documents = documents;
        this.links = links;
        this.organizations = organizations;
        this.storage = storage;
        this.email = email;
        this.audit = audit;
        this.tx = new TransactionTemplate(txManager);
        this.frontendUrl = frontendUrl.split(",")[0].trim().replaceAll("/+$", "");
    }

    // ── Người gửi (đã đăng nhập) ───────────────────────────────────────────────────────────────────

    /**
     * Soạn và gửi thư kèm link tài liệu. Chạy đồng bộ để người bấm "Gửi" biết ngay thư đã đi chưa. Link được lưu TRƯỚC
     * khi gửi (người nhận có thể bấm ngay), gửi hỏng thì xoá link vừa tạo.
     */
    public DocumentPublicLinkResponse send(UUID documentId, SendDocumentEmailRequest req) {
        DocumentService.Viewer v = base.viewer();
        Document d = DocumentService.editable(v, base.visible(v, documentId));

        List<String> to = normalize(req.to());
        List<String> cc = normalize(req.cc());
        cc.removeAll(to);
        if (to.isEmpty()) throw invalid("email.documentShare.error.noRecipient");
        if (to.size() + cc.size() > MAX_RECIPIENTS) throw invalid("email.documentShare.error.tooMany", MAX_RECIPIENTS);
        String subject = req.subject() == null || req.subject().isBlank() ? d.getTitle() : req.subject().strip();
        if (subject.length() > MAX_SUBJECT) throw invalid("email.documentShare.error.subjectTooLong", MAX_SUBJECT);
        String message = req.message() == null ? "" : req.message().strip();
        if (message.length() > MAX_MESSAGE) throw invalid("email.documentShare.error.messageTooLong", MAX_MESSAGE);
        String messageHtml = messageHtml(message, req.messageDoc());
        int days = req.expiresInDays() == null ? DEFAULT_EXPIRES_DAYS : req.expiresInDays();
        if (days < 1 || days > MAX_EXPIRES_DAYS) throw invalid("email.documentShare.error.expiry", MAX_EXPIRES_DAYS);

        UUID me = v.user().getId();
        Instant now = Instant.now();
        if (links.countByCreatedByAndCreatedAtAfter(me, now.minus(Duration.ofHours(1))) >= MAX_SENDS_PER_HOUR) {
            throw new BusinessException(ErrorCode.DOCUMENT_EMAIL_RATE_LIMITED, MAX_SENDS_PER_HOUR);
        }

        String token = newToken();
        List<String> all = new ArrayList<>(to);
        all.addAll(cc);
        DocumentPublicLink link = links.save(DocumentPublicLink.builder()
                .documentId(d.getId())
                .organizationId(v.orgId())
                .tokenHash(hash(token))
                .recipients(String.join(",", all))
                .subject(subject)
                .createdBy(me)
                .senderName(v.user().getFullName() == null ? v.user().getEmail() : v.user().getFullName())
                .createdAt(now)
                .expiresAt(now.plus(Duration.ofDays(days)))
                .build());

        // Một lá thư như thư bình thường (To + Cc thấy nhau), ngôn ngữ theo người nhận đầu tiên — người trong hệ thống
        // theo cài đặt của họ, người ngoài tiếng Việt.
        Locale locale = email.recipientLocale(to.get(0));
        String orgName = organizations.findById(v.orgId()).map(o -> o.getName()).orElse("");
        String html = EmailLayout.wrap(
                esc(ErrorMessages.text(locale, "email.documentShare.header", "")),
                body(locale, messageHtml, d, publicUrl(token), link.getExpiresAt(), link.getSenderName(), v.user().getEmail(), orgName),
                locale, true);
        try {
            email.sendComposed(to, cc, subject, html, v.user().getEmail(), link.getSenderName());
        } catch (RuntimeException e) {
            links.deleteById(link.getId());
            throw e;
        }
        audit.record(SecurityAuditEvent.DOCUMENT_EMAILED, SecurityAuditService.OK, "DOCUMENT", d.getId().toString(),
                d.getScope().name() + " recipients=" + all.size() + " days=" + days);
        return toResponse(link, now);
    }

    public List<DocumentPublicLinkResponse> list(UUID documentId) {
        DocumentService.Viewer v = base.viewer();
        Document d = DocumentService.editable(v, base.visible(v, documentId));
        Instant now = Instant.now();
        return links.findByDocumentIdOrderByCreatedAtDesc(d.getId()).stream().map(l -> toResponse(l, now)).toList();
    }

    /** Thu hồi: link chết ngay, kể cả với người đã nhận thư. Thu hồi lại link đã thu hồi thì không đổi gì. */
    public DocumentPublicLinkResponse revoke(UUID documentId, UUID linkId) {
        DocumentService.Viewer v = base.viewer();
        Document d = DocumentService.editable(v, base.visible(v, documentId));
        DocumentPublicLink link = links.findByIdAndDocumentId(linkId, d.getId())
                .orElseThrow(() -> new ResourceNotFoundException(ErrorCode.DOCUMENT_NOT_FOUND));
        if (link.getRevokedAt() == null) {
            link.setRevokedAt(Instant.now());
            link.setRevokedBy(v.user().getId());
            links.save(link);
            audit.record(SecurityAuditEvent.DOCUMENT_LINK_REVOKED, SecurityAuditService.OK, "DOCUMENT", d.getId().toString(),
                    "link=" + link.getId());
        }
        return toResponse(link, Instant.now());
    }

    // ── Người nhận (không đăng nhập) ───────────────────────────────────────────────────────────────

    /** Thông tin để trang công khai hiển thị; mỗi lần mở trang đếm một lượt. */
    public PublicDocumentResponse open(String token) {
        Opened o = resolve(token);
        tx.executeWithoutResult(s -> links.markViewed(o.link().getId(), Instant.now()));
        Document d = o.document();
        String orgName = organizations.findById(d.getOrganizationId()).map(org -> org.getName()).orElse("");
        return new PublicDocumentResponse(d.getTitle(), d.getFileName(), d.getContentType(), d.getFileSize(),
                DocumentEditService.formatOf(d.getFileName()), o.link().getSenderName(), orgName, d.getUpdatedAt(),
                o.link().getExpiresAt());
    }

    /** Nội dung tài liệu trực tuyến / Markdown / chữ thuần, để trang công khai hiển thị ở chế độ đọc. */
    public DocumentContentResponse content(String token) {
        Document d = resolve(token).document();
        String format = DocumentEditService.formatOf(d.getFileName());
        if (format == null) throw new BusinessException(ErrorCode.DOCUMENT_NOT_TEXT_EDITABLE);
        String s = new String(read(d), StandardCharsets.UTF_8);
        if (!s.isEmpty() && s.charAt(0) == 0xFEFF) s = s.substring(1);
        return new DocumentContentResponse(s, format, null, null);
    }

    public DocumentService.FileContent file(String token) {
        Opened o = resolve(token);
        Document d = o.document();
        audit.recordAnonymous(SecurityAuditEvent.DOCUMENT_DOWNLOADED, SecurityAuditService.OK, "DOCUMENT", d.getId().toString(),
                "public link=" + o.link().getId());
        return new DocumentService.FileContent(read(d), d.getFileName(), d.getContentType());
    }

    private record Opened(DocumentPublicLink link, Document document) {}

    /** Token sai / hết hạn / thu hồi / tài liệu đã xoá: cùng MỘT lỗi — không cho dò link nào từng tồn tại. */
    private Opened resolve(String token) {
        if (token == null || token.length() < 20 || token.length() > 100) throw unavailable();
        DocumentPublicLink link = links.findByTokenHash(hash(token)).orElseThrow(DocumentEmailService::unavailable);
        if (!link.isActive(Instant.now())) throw unavailable();
        Document d = documents.findByIdAndOrganizationId(link.getDocumentId(), link.getOrganizationId())
                .orElseThrow(DocumentEmailService::unavailable);
        return new Opened(link, d);
    }

    private byte[] read(Document d) {
        try {
            return storage.read(d.getStorageKey());
        } catch (IOException e) {
            log.error("Không đọc được tệp của tài liệu {} (link công khai): {}", d.getId(), e.getMessage());
            throw new BusinessException(ErrorCode.DOCUMENT_STORAGE_FAILED);
        }
    }

    // ── Thư ────────────────────────────────────────────────────────────────────────────────────────

    /** Lời nhắn → HTML: bản có định dạng dựng từ JSON theo danh sách trắng; không có thì chữ thuần thành đoạn. */
    static String messageHtml(String plain, String doc) {
        if (doc == null || doc.isBlank()) return plain.isEmpty() ? "" : paragraphs(plain);
        if (doc.length() > MAX_MESSAGE_DOC) throw invalid("email.documentShare.error.messageTooLong", MAX_MESSAGE);
        // Thư trống (chỉ có đoạn rỗng) thì như không có lời nhắn.
        if (plain.isEmpty()) return "";
        try {
            return MailDocRenderer.render(doc);
        } catch (MailDocRenderer.InvalidDocException e) {
            throw invalid("email.documentShare.error.badMessage");
        }
    }

    private String body(Locale locale, String messageHtml, Document d, String url, Instant expiresAt,
                        String senderName, String senderEmail, String orgName) {
        String online = DocumentEditService.formatOf(d.getFileName());
        String kind = "blocks".equals(online) ? t(locale, "email.documentShare.kind.doc")
                : "sheet".equals(online) ? t(locale, "email.documentShare.kind.sheet")
                : esc(d.getFileName()) + " · " + humanSize(d.getFileSize());
        DateTimeFormatter date = DateTimeFormatter.ofPattern("en".equals(locale.getLanguage()) ? "d MMM yyyy" : "dd/MM/yyyy", locale)
                .withZone(DocumentDates.ZONE);
        StringBuilder sb = new StringBuilder();
        sb.append(messageHtml);
        sb.append("<div style='border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:24px 0;background:#f8fafc;'>")
          .append("<div style='font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;'>&#128206; ")
          .append(t(locale, "email.documentShare.attachment")).append("</div>")
          .append("<div style='font-size:17px;font-weight:700;color:#1e293b;margin-bottom:2px;'>").append(esc(d.getTitle())).append("</div>")
          .append("<div style='font-size:13px;color:#64748b;margin-bottom:16px;'>").append(kind).append("</div>")
          .append("<a class='btn' href='").append(esc(url)).append("'>").append(t(locale, "email.documentShare.open")).append("</a>")
          .append("<div style='font-size:12px;color:#94a3b8;margin-top:12px;'>")
          .append(esc(ErrorMessages.text(locale, "email.documentShare.expires", "", date.format(expiresAt))))
          .append("</div></div>");
        String from = orgName == null || orgName.isBlank()
                ? ErrorMessages.text(locale, "email.documentShare.sentBy", "", senderName, senderEmail)
                : ErrorMessages.text(locale, "email.documentShare.sentByOrg", "", senderName, senderEmail, orgName);
        sb.append("<p style='font-size:13px;color:#94a3b8;'>").append(esc(from)).append("</p>");
        return sb.toString();
    }

    /** Chỉ escape ký tự đặc biệt của HTML — bản một tham số của Spring đổi cả chữ có dấu thành thực thể (&aacute;…). */
    private static String esc(String s) {
        return HtmlUtils.htmlEscape(s == null ? "" : s, "UTF-8");
    }

    private static String t(Locale locale, String key) {
        return esc(ErrorMessages.text(locale, key, ""));
    }

    /** Lời nhắn chữ thuần → đoạn HTML (đã escape): dòng trống tách đoạn, xuống dòng giữ nguyên. */
    static String paragraphs(String text) {
        String escaped = esc(text.strip());
        return Arrays.stream(escaped.split("\\R\\s*\\R"))
                .filter(b -> !b.isBlank())
                .map(b -> "<p style='color:#1e293b;'>" + b.replaceAll("\\R", "<br/>") + "</p>")
                .collect(Collectors.joining());
    }

    static String humanSize(Long bytes) {
        if (bytes == null) return "";
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return Math.round(bytes / 1024.0) + " KB";
        return String.format(Locale.ROOT, "%.1f MB", bytes / (1024.0 * 1024));
    }

    // ── Tiện ích ───────────────────────────────────────────────────────────────────────────────────

    /** Bỏ trống, cắt khoảng trắng, chữ thường, bỏ trùng; địa chỉ sai dạng thì báo đúng địa chỉ đó. */
    private static List<String> normalize(List<String> raw) {
        LinkedHashSet<String> out = new LinkedHashSet<>();
        if (raw != null) {
            for (String s : raw) {
                if (s == null || s.isBlank()) continue;
                String e = s.strip().toLowerCase(Locale.ROOT);
                if (e.length() > 254 || !EMAIL.matcher(e).matches()) throw invalid("email.documentShare.error.badAddress", e);
                out.add(e);
            }
        }
        return new ArrayList<>(out);
    }

    private static BusinessException invalid(String key, Object... args) {
        return new BusinessException(ErrorCode.DOCUMENT_EMAIL_INVALID, ErrorMessages.text(key, key, args));
    }

    private static ResourceNotFoundException unavailable() {
        return new ResourceNotFoundException(ErrorCode.DOCUMENT_LINK_UNAVAILABLE);
    }

    private String publicUrl(String token) {
        return frontendUrl + "/s/d/" + token;
    }

    static String newToken() {
        byte[] b = new byte[32];
        RANDOM.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static DocumentPublicLinkResponse toResponse(DocumentPublicLink l, Instant now) {
        List<String> recipients = l.getRecipients() == null || l.getRecipients().isBlank()
                ? List.of() : List.of(l.getRecipients().split(","));
        return new DocumentPublicLinkResponse(l.getId(), recipients, l.getSubject(), l.getSenderName(), l.getCreatedAt(),
                l.getExpiresAt(), l.getRevokedAt(), l.getViewCount() == null ? 0 : l.getViewCount(), l.getLastViewedAt(),
                l.isActive(now));
    }
}
