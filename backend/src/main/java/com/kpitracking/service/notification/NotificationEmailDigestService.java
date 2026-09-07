package com.kpitracking.service.notification;

import com.kpitracking.entity.NotificationEmailDigestItem;
import com.kpitracking.entity.User;
import com.kpitracking.repository.NotificationEmailDigestItemRepository;
import com.kpitracking.service.EmailService;
import com.kpitracking.service.email.EmailTemplateCatalog;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Hàng đợi gom email thông báo theo người nhận.
 *
 * <p>Sự kiện không gửi thư ngay mà xếp hàng ở đây. {@link NotificationDigestScheduler} chờ
 * luồng sự kiện của từng người lắng xuống ({@code quiet-period}) rồi gộp toàn bộ mục chưa
 * gửi của họ thành MỘT lá thư. Sự kiện dồn về liên tục không ngớt thì vẫn phải chốt gửi
 * khi mục cũ nhất chạm {@code max-delay} — nếu không thư sẽ bị hoãn vô hạn.
 *
 * <p>Chỉ kênh email bị gom. Thông báo trong hệ thống (chuông + WebSocket) vẫn đi tức thời
 * vì nó vốn không gây phiền: người dùng chủ động mở ra xem chứ không bị đẩy vào hộp thư.
 *
 * <p>Người nhận chỉ có ĐÚNG MỘT mục thì gửi bằng template của chính sự kiện đó, không bọc
 * vào thư gộp — gộp một mục là mất nội dung mà tổ chức đã tự soạn cho sự kiện ấy để đổi
 * lấy đúng con số "1 thông báo".
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationEmailDigestService {

    /** Mã template của thư gộp, khai trong {@link EmailTemplateCatalog}. */
    public static final String DIGEST_TEMPLATE_CODE = "notification_digest";

    private static final DateTimeFormatter TIME_FORMAT =
            DateTimeFormatter.ofPattern("HH:mm dd/MM").withZone(ZoneId.of("Asia/Ho_Chi_Minh"));

    private final NotificationEmailDigestItemRepository repository;
    private final EmailService emailService;

    @Value("${app.notification.digest.enabled:true}")
    private boolean enabled;

    /** Sau ngần này không có sự kiện mới cho người đó ⇒ coi như đợt đã xong, gửi được rồi. */
    @Value("${app.notification.digest.quiet-period:PT3M}")
    private Duration quietPeriod;

    /** Trần thời gian chờ, tính từ mục CŨ NHẤT — chống việc sự kiện về liên tục làm hoãn mãi. */
    @Value("${app.notification.digest.max-delay:PT20M}")
    private Duration maxDelay;

    /** Xoá lịch sử đã gửi cũ hơn ngần này. */
    @Value("${app.notification.digest.retention:P7D}")
    private Duration retention;

    /**
     * Xếp một thông báo vào hàng chờ gửi email.
     *
     * <p>{@code REQUIRES_NEW} vì bên gọi là listener chạy SAU commit trong transaction riêng;
     * một mục xếp hàng hỏng không được kéo theo các mục còn lại của cùng sự kiện.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void enqueue(UUID orgId, String eventCode, User recipient,
                        String title, String message, UUID referenceId) {
        if (recipient == null || recipient.getEmail() == null || recipient.getEmail().isBlank()) {
            return;
        }
        if (!enabled) {
            emailService.sendEventNotificationEmail(orgId, eventCode, recipient.getEmail(),
                    recipient.getFullName(), title, message);
            return;
        }

        repository.save(NotificationEmailDigestItem.builder()
                .organizationId(orgId)
                .userId(recipient.getId())
                .recipientEmail(recipient.getEmail())
                .recipientName(recipient.getFullName())
                .eventCode(eventCode)
                .title(title)
                .message(message)
                .referenceId(referenceId)
                .build());
    }

    /** Người nhận đã đủ điều kiện chốt gửi tại thời điểm {@code now}. */
    @Transactional(readOnly = true)
    public List<UUID> findRecipientsReadyToSend(Instant now) {
        return repository.findRecipientsReadyToSend(now.minus(quietPeriod), now.minus(maxDelay));
    }

    /**
     * Gửi thư gộp cho một người nhận.
     *
     * <p>Đánh dấu đã gửi TRƯỚC khi gọi SMTP: SMTP treo giữa chừng rồi lượt quét sau lại lấy
     * đúng những mục ấy ra thì người nhận lãnh hai lá thư trùng nhau — đúng cái phiền mà
     * toàn bộ cơ chế này sinh ra để dẹp. Thư hỏng thì mất một thông báo email, nhưng thông
     * báo trong hệ thống vẫn còn nguyên nên không mất dấu vết.
     */
    @Transactional
    public void flushRecipient(UUID userId) {
        List<NotificationEmailDigestItem> pending = repository.findPendingByUser(userId);
        if (pending.isEmpty()) return;

        repository.markSent(pending.stream().map(NotificationEmailDigestItem::getId).toList(), Instant.now());

        NotificationEmailDigestItem first = pending.get(0);
        if (pending.size() == 1) {
            emailService.sendEventNotificationEmail(first.getOrganizationId(), first.getEventCode(),
                    first.getRecipientEmail(), first.getRecipientName(), first.getTitle(), first.getMessage());
            return;
        }

        emailService.sendTemplated(first.getOrganizationId(), DIGEST_TEMPLATE_CODE,
                first.getRecipientEmail(), digestVariables(first, pending));
        log.info("Đã gộp {} thông báo thành một email gửi tới {}", pending.size(), first.getRecipientEmail());
    }

    @Transactional
    public int purgeOldSentItems() {
        return repository.deleteSentBefore(Instant.now().minus(retention));
    }

    private Map<String, String> digestVariables(NotificationEmailDigestItem first,
                                                List<NotificationEmailDigestItem> pending) {
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("ten_nguoi_nhan", first.getRecipientName() == null ? "" : first.getRecipientName());
        vars.put("email", first.getRecipientEmail());
        vars.put("so_thong_bao", String.valueOf(pending.size()));
        vars.put("khoang_thoi_gian", TIME_FORMAT.format(pending.get(0).getCreatedAt())
                + " - " + TIME_FORMAT.format(pending.get(pending.size() - 1).getCreatedAt()));
        vars.put("danh_sach_thong_bao", renderGroupedList(pending));
        return vars;
    }

    /**
     * Dựng danh sách thông báo, nhóm theo loại sự kiện và giữ nguyên thứ tự phát sinh trong
     * từng nhóm. Nhóm lại để người đọc thấy ngay "12 báo cáo chờ duyệt" là MỘT việc cần làm,
     * thay vì 12 dòng rời rạc trộn lẫn với các loại thông báo khác.
     */
    private String renderGroupedList(List<NotificationEmailDigestItem> pending) {
        Map<String, List<NotificationEmailDigestItem>> byEvent = new LinkedHashMap<>();
        for (NotificationEmailDigestItem item : pending) {
            byEvent.computeIfAbsent(item.getEventCode(), k -> new ArrayList<>()).add(item);
        }

        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, List<NotificationEmailDigestItem>> group : byEvent.entrySet()) {
            List<NotificationEmailDigestItem> items = group.getValue();
            sb.append("<p style=\"margin:24px 0 8px;font-size:13px;font-weight:700;color:#1e293b;")
              .append("text-transform:uppercase;letter-spacing:0.04em;\">")
              .append(escape(groupLabel(group.getKey())))
              .append(" (").append(items.size()).append(")</p>");

            for (NotificationEmailDigestItem item : items) {
                sb.append("<div style=\"border-left:3px solid #2563eb;background-color:#f8fafc;")
                  .append("border-radius:8px;padding:12px 16px;margin-bottom:10px;\">")
                  .append("<p style=\"margin:0 0 4px;font-size:15px;font-weight:600;color:#1e293b;\">")
                  .append(escape(item.getTitle())).append("</p>")
                  .append("<p style=\"margin:0;font-size:14px;color:#475569;\">")
                  .append(escape(item.getMessage())).append("</p>")
                  .append("<p style=\"margin:6px 0 0;font-size:12px;color:#94a3b8;\">")
                  .append(TIME_FORMAT.format(item.getCreatedAt())).append("</p>")
                  .append("</div>");
            }
        }
        return sb.toString();
    }

    private String groupLabel(String eventCode) {
        EmailTemplateCatalog.TemplateDef def = EmailTemplateCatalog.get(eventCode);
        return def != null ? def.getLabel() : eventCode;
    }

    /**
     * Nội dung thông báo có tên người, tên chỉ tiêu và ghi chú do người dùng tự nhập, mà thư
     * gộp lắp thẳng vào HTML — không thoát thì một ghi chú duyệt chứa dấu &lt; đủ làm vỡ cả
     * lá thư.
     */
    private String escape(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
