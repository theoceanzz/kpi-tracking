package com.kpitracking.service.document;

import com.kpitracking.dto.request.document.SendDocumentEmailRequest;
import com.kpitracking.entity.document.Document;
import com.kpitracking.entity.document.DocumentPublicLink;
import com.kpitracking.entity.user.User;
import com.kpitracking.enums.document.DocumentScope;
import com.kpitracking.enums.StorageProvider;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.CodedException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.repository.document.DocumentPublicLinkRepository;
import com.kpitracking.repository.document.DocumentRepository;
import com.kpitracking.repository.organization.OrganizationRepository;
import com.kpitracking.security.audit.SecurityAuditService;
import com.kpitracking.service.email.EmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DocumentEmailServiceTest {

    private static final UUID ORG = UUID.randomUUID();
    private static final UUID ME = UUID.randomUUID();

    private final DocumentService base = mock(DocumentService.class);
    private final DocumentRepository documents = mock(DocumentRepository.class);
    private final DocumentPublicLinkRepository links = mock(DocumentPublicLinkRepository.class);
    private final OrganizationRepository organizations = mock(OrganizationRepository.class);
    private final DocumentStorage storage = mock(DocumentStorage.class);
    private final EmailService email = mock(EmailService.class);
    private final DocumentEmailService service = new DocumentEmailService(base, documents, links, organizations, storage,
            email, mock(SecurityAuditService.class), mock(PlatformTransactionManager.class), "https://app.keygo.vn/,http://x");

    private Document doc;

    @BeforeEach
    void setUp() {
        doc = Document.builder().id(UUID.randomUUID()).organizationId(ORG).scope(DocumentScope.PERSONAL).ownerUserId(ME)
                .title("Báo giá").fileName("Báo giá.kgdoc").contentType("application/vnd.keygo.document+json")
                .fileSize(1200L).contentSha256("x").storageProvider(StorageProvider.LOCAL).storageKey("k").createdBy(ME).build();
        User me = User.builder().id(ME).email("hai@keygo.vn").fullName("Nguyễn Văn Hải").build();
        // Chủ kho cá nhân, có quyền tải lên cá nhân ⇒ canEdit.
        DocumentAccess access = new DocumentAccess(ORG, ME, true, Set.of(), Set.of(), Set.of(), false, true);
        DocumentService.Viewer viewer = new DocumentService.Viewer(me, ORG, access, Map.of());
        when(base.viewer()).thenReturn(viewer);
        when(base.visible(viewer, doc.getId())).thenReturn(doc);
        when(links.save(any())).thenAnswer(i -> {
            DocumentPublicLink l = i.getArgument(0);
            if (l.getId() == null) l.setId(UUID.randomUUID());
            return l;
        });
        when(email.recipientLocale(anyString())).thenReturn(Locale.forLanguageTag("vi"));
        when(organizations.findById(ORG)).thenReturn(Optional.empty());
    }

    private static SendDocumentEmailRequest req(List<String> to, List<String> cc) {
        return new SendDocumentEmailRequest(to, cc, null, "Chào anh,\n\nGửi anh báo giá.", null, 7);
    }

    @Test
    @DisplayName("Gửi: chuẩn hoá địa chỉ, Cc bỏ người đã ở To, chỉ lưu băm token, link trong thư là token thật")
    @SuppressWarnings("unchecked")
    void sendStoresHashAndMailsToken() {
        service.send(doc.getId(), req(List.of(" Partner@Example.com", "partner@example.com"), List.of("PARTNER@example.com", "boss@corp.vn")));

        ArgumentCaptor<DocumentPublicLink> saved = ArgumentCaptor.forClass(DocumentPublicLink.class);
        verify(links).save(saved.capture());
        DocumentPublicLink link = saved.getValue();
        assertThat(link.getRecipients()).isEqualTo("partner@example.com,boss@corp.vn");
        assertThat(link.getSubject()).isEqualTo("Báo giá"); // tiêu đề trống ⇒ tên tài liệu
        assertThat(link.getSenderName()).isEqualTo("Nguyễn Văn Hải");
        assertThat(Duration.between(link.getCreatedAt(), link.getExpiresAt())).isEqualTo(Duration.ofDays(7));

        ArgumentCaptor<List<String>> to = ArgumentCaptor.forClass(List.class);
        ArgumentCaptor<List<String>> cc = ArgumentCaptor.forClass(List.class);
        ArgumentCaptor<String> html = ArgumentCaptor.forClass(String.class);
        verify(email).sendComposed(to.capture(), cc.capture(), eq("Báo giá"), html.capture(), eq("hai@keygo.vn"), eq("Nguyễn Văn Hải"));
        assertThat(to.getValue()).containsExactly("partner@example.com");
        assertThat(cc.getValue()).containsExactly("boss@corp.vn");

        String token = html.getValue().replaceAll("(?s).*https://app\\.keygo\\.vn/s/d/([A-Za-z0-9_-]+).*", "$1");
        assertThat(token).hasSize(43);
        assertThat(link.getTokenHash()).isEqualTo(DocumentEmailService.hash(token)).isNotEqualTo(token);
        assertThat(html.getValue()).contains("Gửi anh báo giá.").doesNotContain("<script");
    }

    @Test
    @DisplayName("Lời nhắn được escape — không chèn được HTML vào thư")
    void messageEscaped() {
        assertThat(DocumentEmailService.paragraphs("<b>x</b>\n\ny")).isEqualTo(
                "<p style='color:#1e293b;'>&lt;b&gt;x&lt;/b&gt;</p><p style='color:#1e293b;'>y</p>");
    }

    @Test
    @DisplayName("Lời nhắn có định dạng đi qua bộ dựng HTML; JSON hỏng ⇒ báo lỗi; chữ trống ⇒ không có đoạn lời nhắn")
    void richMessage() {
        String doc = "[{\"type\":\"paragraph\",\"props\":{},\"content\":[{\"type\":\"text\",\"text\":\"Chào\",\"styles\":{\"bold\":true}}],\"children\":[]}]";
        assertThat(DocumentEmailService.messageHtml("Chào", doc)).contains("<strong>Chào</strong>");
        assertThat(DocumentEmailService.messageHtml("", doc)).isEmpty();
        assertCode(() -> DocumentEmailService.messageHtml("x", "<b>html</b>"), ErrorCode.DOCUMENT_EMAIL_INVALID);
    }

    @Test
    @DisplayName("Người chỉ được chia sẻ xem không gửi tài liệu ra ngoài được")
    void viewerOnlyCannotSend() {
        DocumentAccess shared = new DocumentAccess(ORG, ME, true, Set.of(), Set.of(), Set.of(), false, true)
                .withShared(Set.of(doc.getId()));
        doc.setOwnerUserId(UUID.randomUUID());
        DocumentService.Viewer viewer = new DocumentService.Viewer(base.viewer().user(), ORG, shared, Map.of());
        when(base.viewer()).thenReturn(viewer);
        when(base.visible(viewer, doc.getId())).thenReturn(doc);

        assertThatThrownBy(() -> service.send(doc.getId(), req(List.of("a@b.vn"), List.of())))
                .satisfies(e -> assertThat(((CodedException) e).getErrorCode()).isEqualTo(ErrorCode.DOCUMENT_FORBIDDEN));
        verifyNoInteractions(email);
    }

    @Test
    @DisplayName("Địa chỉ sai, không có người nhận, hạn link ngoài 1–90 ngày ⇒ báo lỗi, không gửi gì")
    void validation() {
        assertCode(() -> service.send(doc.getId(), req(List.of("khong-phai-email"), List.of())), ErrorCode.DOCUMENT_EMAIL_INVALID);
        assertCode(() -> service.send(doc.getId(), req(List.of(" "), List.of("a@b.vn"))), ErrorCode.DOCUMENT_EMAIL_INVALID);
        assertCode(() -> service.send(doc.getId(), new SendDocumentEmailRequest(List.of("a@b.vn"), null, null, null, null, 91)),
                ErrorCode.DOCUMENT_EMAIL_INVALID);
        verify(links, never()).save(any());
        verifyNoInteractions(email);
    }

    @Test
    @DisplayName("Gửi quá số lần cho phép trong một giờ ⇒ chặn")
    void rateLimited() {
        when(links.countByCreatedByAndCreatedAtAfter(eq(ME), any())).thenReturn((long) DocumentEmailService.MAX_SENDS_PER_HOUR);
        assertCode(() -> service.send(doc.getId(), req(List.of("a@b.vn"), List.of())), ErrorCode.DOCUMENT_EMAIL_RATE_LIMITED);
        verifyNoInteractions(email);
    }

    @Test
    @DisplayName("Máy chủ thư lỗi ⇒ xoá link vừa tạo, lỗi đi ra cho người bấm Gửi")
    void mailFailureDeletesLink() {
        doThrow(new BusinessException(ErrorCode.COULD_NOT_SEND_EMAIL, "smtp down"))
                .when(email).sendComposed(any(), any(), any(), any(), any(), any());
        assertCode(() -> service.send(doc.getId(), req(List.of("a@b.vn"), List.of())), ErrorCode.COULD_NOT_SEND_EMAIL);
        verify(links).deleteById(any());
    }

    @Test
    @DisplayName("Mở link: token lạ / hết hạn / thu hồi / tài liệu đã xoá ⇒ cùng một lỗi; còn hạn ⇒ đếm lượt mở")
    void openLink() {
        String token = DocumentEmailService.newToken();
        DocumentPublicLink link = DocumentPublicLink.builder().id(UUID.randomUUID()).documentId(doc.getId()).organizationId(ORG)
                .tokenHash(DocumentEmailService.hash(token)).recipients("a@b.vn").subject("s").createdBy(ME).senderName("Hải")
                .expiresAt(Instant.now().plus(Duration.ofDays(1))).build();
        when(links.findByTokenHash(DocumentEmailService.hash(token))).thenReturn(Optional.of(link));

        assertCode(() -> service.open("x".repeat(43)), ErrorCode.DOCUMENT_LINK_UNAVAILABLE); // không có trong bảng
        assertCode(() -> service.open("ngắn"), ErrorCode.DOCUMENT_LINK_UNAVAILABLE);
        assertCode(() -> service.open(token), ErrorCode.DOCUMENT_LINK_UNAVAILABLE);           // tài liệu đã vào thùng rác

        when(documents.findByIdAndOrganizationId(doc.getId(), ORG)).thenReturn(Optional.of(doc));
        assertThat(service.open(token).format()).isEqualTo("blocks");
        verify(links).markViewed(eq(link.getId()), any());

        link.setRevokedAt(Instant.now());
        assertCode(() -> service.open(token), ErrorCode.DOCUMENT_LINK_UNAVAILABLE);
        link.setRevokedAt(null);
        link.setExpiresAt(Instant.now().minusSeconds(1));
        assertCode(() -> service.open(token), ErrorCode.DOCUMENT_LINK_UNAVAILABLE);
    }

    @Test
    @DisplayName("Thu hồi đặt mốc thu hồi; thu hồi lại không đổi mốc cũ")
    void revoke() {
        DocumentPublicLink link = DocumentPublicLink.builder().id(UUID.randomUUID()).documentId(doc.getId()).organizationId(ORG)
                .tokenHash("h").recipients("a@b.vn").subject("s").createdBy(ME).senderName("Hải")
                .expiresAt(Instant.now().plus(Duration.ofDays(1))).build();
        when(links.findByIdAndDocumentId(link.getId(), doc.getId())).thenReturn(Optional.of(link));

        assertThat(service.revoke(doc.getId(), link.getId()).active()).isFalse();
        Instant first = link.getRevokedAt();
        assertThat(first).isNotNull();
        assertThat(link.getRevokedBy()).isEqualTo(ME);
        service.revoke(doc.getId(), link.getId());
        assertThat(link.getRevokedAt()).isEqualTo(first);
        verify(links, times(1)).save(link);
    }

    private static void assertCode(Runnable r, ErrorCode code) {
        assertThatThrownBy(r::run).satisfies(e -> assertThat(((CodedException) e).getErrorCode()).isEqualTo(code));
    }
}
