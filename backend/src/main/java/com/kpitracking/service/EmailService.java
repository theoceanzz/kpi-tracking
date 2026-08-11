package com.kpitracking.service;

import com.kpitracking.service.email.EmailTemplateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Gửi email hệ thống. Nội dung lấy từ {@link EmailTemplateService} — mỗi tổ chức
 * có thể tự chỉnh, không chỉnh thì dùng mặc định trong EmailTemplateCatalog.
 *
 * <p>Các phương thức nhận {@code orgId} có bản nạp chồng không cần tham số đó cho
 * những luồng chưa xác định được tổ chức (VD quên mật khẩu) — khi đó dùng mặc định.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;
    private final EmailTemplateService templateService;

    @Value("${app.mail.from}")
    private String fromEmail;

    @Async
    public void sendEmail(String to, String subject, String htmlBody) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail, "KeyGo System");
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true); // true indicates HTML
            mailSender.send(message);
            log.info("HTML Email sent successfully to: {}", to);
        } catch (Exception e) {
            log.error("Failed to send HTML email to {}: {}", to, e.getMessage());
        }
    }

    /**
     * Sinh nội dung từ template rồi gửi. Trả về false nếu tổ chức đã tắt loại mail này.
     * Chạy đồng bộ để nơi gọi biết kết quả — nơi gọi tự quyết định có bọc @Async không.
     */
    public boolean sendTemplated(UUID orgId, String templateCode, String to, Map<String, String> variables) {
        try {
            EmailTemplateService.RenderedEmail mail = templateService.render(orgId, templateCode, variables);
            if (!mail.enabled()) {
                log.debug("Template {} đang tắt ở tổ chức {}, bỏ qua gửi tới {}", templateCode, orgId, to);
                return false;
            }
            sendEmailSync(to, mail.subject(), mail.html());
            return true;
        } catch (Exception e) {
            log.error("Không sinh/gửi được email {} tới {}: {}", templateCode, to, e.getMessage());
            return false;
        }
    }

    /**
     * Gửi thư do một người dùng trong hệ thống tự soạn (VD: quản lý nhắc tiến độ KPI).
     * Chạy đồng bộ và ném lỗi ra ngoài để nơi gọi biết mà báo lại cho người vừa bấm "Gửi",
     * khác với {@link #sendEmail} vốn chạy nền và chỉ ghi log khi hỏng.
     *
     * <p>{@code replyTo} là hộp thư của người gửi thật — thư đi từ địa chỉ hệ thống nhưng
     * người nhận bấm "Trả lời" thì về đúng người đã soạn.
     */
    public void sendDirect(String to, String subject, String htmlBody, String replyTo, String replyToName) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail, "KeyGo System");
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            if (replyTo != null && !replyTo.isBlank()) {
                helper.setReplyTo(replyTo, replyToName == null || replyToName.isBlank() ? replyTo : replyToName);
            }
            mailSender.send(message);
            log.info("Đã gửi thư người dùng soạn tới: {}", to);
        } catch (Exception e) {
            log.error("Không gửi được thư tới {}: {}", to, e.getMessage());
            throw new com.kpitracking.exception.BusinessException("Không gửi được email: " + e.getMessage());
        }
    }

    private void sendEmailSync(String to, String subject, String htmlBody) throws Exception {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setFrom(fromEmail, "KeyGo System");
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(htmlBody, true);
        mailSender.send(message);
        log.info("HTML Email sent successfully to: {}", to);
    }

    private static Map<String, String> vars(String... pairs) {
        Map<String, String> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < pairs.length; i += 2) m.put(pairs[i], pairs[i + 1]);
        return m;
    }

    // ─────────────────────────── Mail tài khoản & bảo mật ───────────────────────────

    @Async
    public void sendResetPasswordEmail(String to, String resetPasswordToken) {
        sendResetPasswordEmail(null, to, resetPasswordToken);
    }

    @Async
    public void sendResetPasswordEmail(UUID orgId, String to, String resetPasswordToken) {
        sendTemplated(orgId, "auth_reset_password", to, vars("ma_otp", resetPasswordToken, "email", to));
    }

    @Async
    public void sendVerifyEmail(String to, String verifyEmailToken) {
        sendVerifyEmail(null, to, verifyEmailToken);
    }

    @Async
    public void sendVerifyEmail(UUID orgId, String to, String verifyEmailToken) {
        sendTemplated(orgId, "auth_verify_email", to, vars("ma_otp", verifyEmailToken, "email", to));
    }

    @Async
    public void sendWelcomeAndVerifyEmail(String to, String fullName, String verifyEmailToken) {
        sendTemplated(null, "auth_welcome_verify", to,
                vars("ten_nguoi_nhan", fullName, "ma_otp", verifyEmailToken, "email", to));
    }

    @Async
    public void sendWelcomeEmail(String to, String fullName) {
        sendTemplated(null, "auth_welcome", to, vars("ten_nguoi_nhan", fullName, "email", to));
    }

    @Async
    public void sendAccountDetailsEmail(String to, String fullName, String password) {
        sendAccountDetailsEmail(null, to, fullName, password);
    }

    @Async
    public void sendAccountDetailsEmail(UUID orgId, String to, String fullName, String password) {
        sendTemplated(orgId, "auth_account_details", to,
                vars("ten_nguoi_nhan", fullName, "email", to, "mat_khau", password));
    }

    // ─────────────────────────── Mail thông báo sự kiện ───────────────────────────

    /**
     * Mail thông báo chung. Giữ lại cho các nơi gọi cũ chưa có mã sự kiện cụ thể —
     * dùng template của {@code submission_submitted} sẽ sai ngữ cảnh, nên bản này
     * bọc thẳng vào khung mặc định.
     */
    @Async
    public void sendNotificationEmail(String to, String title, String message) {
        sendEmail(to, title, com.kpitracking.service.email.EmailLayout.wrap(
                "Thông báo Hệ thống", "<p>Xin chào,</p><p>" + message + "</p>"));
    }

    /** Mail thông báo theo đúng mã sự kiện ⇒ dùng template mà tổ chức đã cấu hình. */
    @Async
    public void sendEventNotificationEmail(UUID orgId, String eventCode, String to,
                                           String recipientName, String title, String message) {
        sendTemplated(orgId, eventCode, to,
                vars("tieu_de", title, "noi_dung", message, "ten_nguoi_nhan", recipientName, "email", to));
    }
}
