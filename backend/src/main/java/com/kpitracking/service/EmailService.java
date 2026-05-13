package com.kpitracking.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.from}")
    private String fromEmail;

    @Value("${app.frontend-url:${app.cors.allowed-origins:http://localhost:3000}}")
    private String frontendUrl;

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

    private String buildHtmlTemplate(String title, String content) {
        return "<!DOCTYPE html>" +
               "<html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'>" +
               "<style>" +
               "  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }" +
               "  .wrapper { width: 100%; table-layout: fixed; background-color: #f8fafc; padding: 40px 0; }" +
               "  .main { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }" +
               "  .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center; }" +
               "  .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.025em; text-transform: uppercase; }" +
               "  .body { padding: 40px; color: #1e293b; line-height: 1.6; }" +
               "  .body p { margin-top: 0; margin-bottom: 16px; font-size: 16px; color: #475569; }" +
               "  .token-container { background-color: #f1f5f9; border-radius: 12px; padding: 30px; text-align: center; margin: 32px 0; border: 1px solid #e2e8f0; }" +
               "  .token-label { font-size: 14px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; display: block; }" +
               "  .token-value { font-family: 'Courier New', monospace; font-size: 36px; font-weight: 800; color: #2563eb; letter-spacing: 8px; margin: 0; }" +
               "  .footer { padding: 30px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; }" +
               "  .footer p { margin: 0; font-size: 13px; color: #94a3b8; }" +
               "  .btn { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; transition: background-color 0.2s; }" +
               "  @media (max-width: 600px) { .main { border-radius: 0; } .body { padding: 30px 20px; } }" +
               "</style></head><body>" +
               "<div class='wrapper'>" +
               "  <div class='main'>" +
               "    <div class='header'><h1>" + title + "</h1></div>" +
               "    <div class='body'>" + content + "</div>" +
               "    <div class='footer'>" +
               "      <p>© 2026 KeyGo Performance Tracking. Mọi quyền được bảo lưu.</p>" +
               "      <p style='margin-top: 8px;'>Email này được gửi tự động, vui lòng không phản hồi.</p>" +
               "    </div>" +
               "  </div>" +
               "</div>" +
               "</body></html>";
    }

    @Async
    public void sendResetPasswordEmail(String to, String resetPasswordToken) {
        String subject = "Khôi phục Mật khẩu Bảo mật";
        String content = "<p>Xin chào,</p>" +
                         "<p>Gần đây chúng tôi nhận được yêu cầu <b>khôi phục mật khẩu</b> cho tài khoản gắn liền với địa chỉ email này.</p>" +
                         "<p>Mã bảo mật để thiết lập lại mật khẩu của bạn là:</p>" +
                         "<div class='token-container'>" +
                         "  <span class='token-label'>Mã xác thực bảo mật</span>" +
                         "  <div class='token-value'>" + resetPasswordToken + "</div>" +
                         "</div>" +
                         "<p style='color: #ef4444; font-weight: 600;'>⚠️ Mã này chỉ có hiệu lực trong vòng 60 phút.</p>" +
                         "<p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này để đảm bảo an toàn.</p>";
        sendEmail(to, subject, buildHtmlTemplate("Bảo mật Tài khoản", content));
    }

    @Async
    public void sendVerifyEmail(String to, String verifyEmailToken) {
        String subject = "Xác nhận Tham gia Mạng lưới KeyGo";
        String content = "<p>Chào mừng bạn đã gia nhập,</p>" +
                         "<p>Để hoàn tất thủ tục đăng ký và kích hoạt tài khoản trên hệ thống KeyGo, vui lòng sử dụng mã OTP dưới đây:</p>" +
                         "<div class='token-container'>" +
                         "  <span class='token-label'>Mã OTP kích hoạt</span>" +
                         "  <div class='token-value'>" + verifyEmailToken + "</div>" +
                         "</div>" +
                         "<p>Mã này sẽ hết hạn sau 24 giờ kể từ khi được gửi.</p>";
        sendEmail(to, subject, buildHtmlTemplate("Xác nhận Email", content));
    }

    @Async
    public void sendWelcomeAndVerifyEmail(String to, String fullName, String verifyEmailToken) {
        String subject = "Chào mừng tới KeyGo - Xác thực Tài khoản";
        String content = "<p>Xin chào <b>" + fullName + "</b>,</p>" +
                         "<p>Chúc mừng! Hồ sơ và dữ liệu hệ thống của công ty đã được khởi tạo thành công trên nền tảng KeyGo.</p>" +
                         "<p>Để bắt đầu trải nghiệm, vui lòng xác thực tài khoản của bạn bằng mã OTP bên dưới:</p>" +
                         "<div class='token-container'>" +
                         "  <span class='token-label'>Mã OTP xác thực</span>" +
                         "  <div class='token-value'>" + verifyEmailToken + "</div>" +
                         "</div>" +
                         "<p>Sau khi xác thực, bạn có thể đăng nhập để quản lý KPI và trao quyền cho đội ngũ của mình.</p>";
        sendEmail(to, subject, buildHtmlTemplate("Chào mừng & Xác thực", content));
    }

    @Async
    public void sendWelcomeEmail(String to, String fullName) {
        String subject = "Chào mừng tới Hệ sinh thái KeyGo";
        String content = "<p>Xin chào <b>" + fullName + "</b>,</p>" +
                         "<p>Chúc mừng bạn! Hồ sơ và dữ liệu hệ thống của công ty đã được khởi tạo thành công trên nền tảng KeyGo.</p>" +
                         "<p>Giờ đây, bạn có toàn quyền truy cập để <b>quản lý luồng công việc</b>, <b>trao quyền đội ngũ</b> và <b>đo lường kết quả dữ liệu</b> tức thì.</p>" +
                         "<p>Đội ngũ phân tích của chúng tôi luôn túc trực để hỗ trợ quá trình trải nghiệm.</p>" +
                         "<p>Trân trọng,<br><b>Ban Giám đốc KeyGo</b></p>";
        sendEmail(to, subject, buildHtmlTemplate("Phát triển Thành công", content));
    }

    @Async
    public void sendAccountDetailsEmail(String to, String fullName, String password) {
        String subject = "Thông tin Truy cập Hệ thống KeyGo";
        String content = "<p>Xin chào <b>" + fullName + "</b>,</p>" +
                         "<p>Tài khoản của bạn đã được khởi tạo thành công trên hệ thống quản trị KeyGo. Dưới đây là thông tin đăng nhập cá nhân của bạn:</p>" +
                         "<div style='background-color: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #e2e8f0;'>" +
                         "  <p style='margin-bottom: 8px;'><strong>Email:</strong> " + to + "</p>" +
                         "  <p style='margin: 0;'><strong>Mật khẩu:</strong> <code style='background: #e2e8f0; padding: 2px 6px; border-radius: 4px;'>" + password + "</code></p>" +
                         "</div>" +
                         "<p style='text-align: center; margin: 32px 0;'>" +
                         "  <a href='" + frontendUrl + "/login' class='btn'>Đăng nhập ngay</a>" +
                         "</p>" +
                         "<p>Vì lý do an toàn, chúng tôi khuyên bạn nên thay đổi mật khẩu ngay sau khi đăng nhập lần đầu.</p>";
        sendEmail(to, subject, buildHtmlTemplate("Thông tin Tài khoản", content));
    }

    @Async
    public void sendNotificationEmail(String to, String title, String message) {
        String content = "<p>Xin chào,</p><p>" + message + "</p>";
        sendEmail(to, title, buildHtmlTemplate("Thông báo Hệ thống", content));
    }
}
