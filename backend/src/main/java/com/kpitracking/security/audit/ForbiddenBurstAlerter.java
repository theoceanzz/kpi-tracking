package com.kpitracking.security.audit;

import com.kpitracking.entity.User;
import com.kpitracking.enums.UserStatus;
import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.service.EmailService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Gửi EMAIL khi {@link ForbiddenBurstDetector} phát hiện một người dính 403 dồn dập. Prod chạy trên Coolify, không
 * có chỗ gom log để gắn cảnh báo theo dòng {@code ALERT FORBIDDEN_BURST}, nên báo thẳng qua thư.
 *
 * <p>Người nhận: {@code app.security.forbidden-burst.alert-emails} (env {@code FORBIDDEN_BURST_ALERT_EMAILS}, nhiều
 * địa chỉ cách nhau dấu phẩy); để trống thì gửi mọi quản trị nền tảng đang hoạt động. Ngôn ngữ theo người nhận.
 * Gửi bất đồng bộ ({@link EmailService#sendEmail} là {@code @Async}) — không làm chậm request đang bị 403.
 * Detector đã giới hạn mỗi người một cảnh báo / thời gian chờ nên thư không thành spam.
 */
@Slf4j
@Component
public class ForbiddenBurstAlerter {

    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    private final EmailService emailService;
    private final UserRepository userRepository;
    private final List<String> configuredRecipients;

    public ForbiddenBurstAlerter(EmailService emailService, UserRepository userRepository,
                                 @Value("${app.security.forbidden-burst.alert-emails:}") String alertEmails) {
        this.emailService = emailService;
        this.userRepository = userRepository;
        this.configuredRecipients = Arrays.stream(alertEmails.split("[,;\\s]+"))
                .map(String::trim).filter(s -> s.contains("@")).toList();
    }

    /** Ai nhận thư: cấu hình nếu có, không thì quản trị nền tảng đang hoạt động. */
    List<String> recipients() {
        if (!configuredRecipients.isEmpty()) return configuredRecipients;
        Set<String> admins = new LinkedHashSet<>();
        for (User u : userRepository.findByIsPlatformAdminTrueAndStatus(UserStatus.ACTIVE)) {
            if (u.getEmail() != null) admins.add(u.getEmail());
        }
        return List.copyOf(admins);
    }

    public void send(ForbiddenBurstDetector.Burst burst, String organizationId, String ip) {
        List<String> to;
        try {
            to = recipients();
        } catch (Exception e) {
            log.error("Không tìm được người nhận cảnh báo FORBIDDEN_BURST: {}", e.getMessage());
            return;
        }
        if (to.isEmpty()) {
            log.warn("Cảnh báo FORBIDDEN_BURST không có người nhận — đặt FORBIDDEN_BURST_ALERT_EMAILS");
            return;
        }
        String when = ZonedDateTime.now(VN).format(TIME);
        for (String recipient : to) {
            Locale locale = emailService.recipientLocale(recipient);
            String subject = ErrorMessages.text(locale, "alert.forbiddenBurst.subject",
                    "[KeyGo] 403 burst: {0}", burst.user());
            emailService.sendEmail(recipient, subject, body(locale, burst, organizationId, ip, when));
        }
    }

    String body(Locale locale, ForbiddenBurstDetector.Burst burst, String organizationId, String ip, String when) {
        StringBuilder endpoints = new StringBuilder();
        for (String e : burst.endpoints().split(", ")) {
            endpoints.append("<li><code>").append(HtmlUtils.htmlEscape(e)).append("</code></li>");
        }
        String intro = ErrorMessages.text(locale, "alert.forbiddenBurst.intro",
                "{0} got {1} x 403 within {2} seconds.",
                HtmlUtils.htmlEscape(burst.user()), burst.count(), burst.windowSeconds());
        String hint = ErrorMessages.text(locale, "alert.forbiddenBurst.hint", "");
        return "<div style=\"font-family:Arial,sans-serif;font-size:14px;color:#0f172a\">"
                + "<p><b>" + intro + "</b></p>"
                + "<p>" + ErrorMessages.text(locale, "alert.forbiddenBurst.endpoints", "Endpoints:") + "</p>"
                + "<ul>" + endpoints + "</ul>"
                + "<p style=\"color:#475569\">"
                + ErrorMessages.text(locale, "alert.forbiddenBurst.meta", "Time: {0} · Organization: {1} · IP: {2}",
                        when, HtmlUtils.htmlEscape(String.valueOf(organizationId)), HtmlUtils.htmlEscape(String.valueOf(ip)))
                + "</p>"
                + "<p>" + hint + "</p>"
                + "</div>";
    }
}
