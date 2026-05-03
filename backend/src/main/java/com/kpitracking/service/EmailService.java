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

    @Value("${app.cors.allowed-origins}")
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
               "<html><head><style>" +
               "body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; margin: 0; padding: 40px 0; }" +
               ".container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }" +
               ".header { background: linear-gradient(135deg, #0ea5e9, #2563eb); color: white; padding: 35px 30px; text-align: center; border-bottom: 4px solid #38bdf8; }" +
               ".content { padding: 40px 40px; color: #334155; line-height: 1.7; font-size: 16px; }" +
               ".token-box { background: #f8fafc; border: 2px dashed #94a3b8; border-radius: 12px; padding: 25px; text-align: center; font-size: 26px; font-weight: 800; color: #0284c7; margin: 35px 0; letter-spacing: 2px; word-break: break-all; }" +
               ".footer { background-color: #f8fafc; padding: 25px; text-align: center; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0; }" +
               "h1 { margin: 0; font-size: 26px; letter-spacing: 1px; }" +
               "p { margin-top: 0; margin-bottom: 20px; }" +
               "</style></head><body>" +
               "<div class='container'>" +
               "<div class='header'><h1>" + title + "</h1></div>" +
               "<div class='content'>" + content + "</div>" +
               "<div class='footer'><p>Được gửi tự động từ <b>Hệ thống Quản trị KeyGo</b>.<br>Vui lòng không cung cấp mã này cho bất kỳ ai.</p></div>" +
               "</div></body></html>";
    }

    @Async
    public void sendResetPasswordEmail(String to, String resetPasswordToken) {
        String subject = "Khôi phục Mật khẩu Bảo mật";
        String content = "<p>Xin chào,</p>" +
                         "<p>Gần đây chúng tôi nhận được yêu cầu <b>khôi phục mật khẩu</b> cho tài khoản gắn liền với địa chỉ email này.</p>" +
                         "<p>Mã bảo mật để thiết lập lại mật khẩu của bạn là:</p>" +
                         "<div class='token-box'>" + resetPasswordToken + "</div>" +
                         "<p>⚠️ Mã này chỉ có hiệu lực duy nhất trong vòng <b>1 giờ (60 phút)</b> nhằm đảm bảo an toàn.</p>" +
                         "<p>Nếu bạn không thực hiện yêu cầu này, hãy bảo mật tài khoản của mình và xóa email này ngay.</p>" +
                         "<p>Trân trọng,<br><b>Ban Quản trị An ninh KeyGo</b></p>";
        sendEmail(to, subject, buildHtmlTemplate("Bảo mật Tài khoản", content));
    }

    @Async
    public void sendVerifyEmail(String to, String verifyEmailToken) {
        String subject = "Xác nhận Tham gia Mạng lưới KeyGo";
        String content = "<p>Chào mừng bạn đã gia nhập,</p>" +
                         "<p>Hệ thống giám sát KPI Cấp Doanh nghiệp rất hân hạnh được đồng hành cùng sự phát triển dự án của bạn.</p>" +
                         "<p>Để hoàn tất thủ tục đăng ký, vui lòng sử dụng <b>Mã OTP xác thực</b> dưới đây để kích hoạt:</p>" +
                         "<div class='token-box'>" + verifyEmailToken + "</div>" +
                         "<p>Mã này tự động hết hạn trong <b>24 giờ</b> tiếp theo. Quá thời gian này, bạn sẽ cần đăng ký cấp lại.</p>" +
                         "<p>Trân trọng,<br><b>Hệ thống Quản lý Tự động</b></p>";
        sendEmail(to, subject, buildHtmlTemplate("Xác nhận Email", content));
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
                         "<p>Tài khoản của bạn đã được thiết lập thành công trên hệ thống KeyGo. Dưới đây là thông tin đăng nhập của bạn:</p>" +
                         "<div style='background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 25px 0;'>" +
                         "<p style='margin: 0 0 10px 0;'><b>Email:</b> " + to + "</p>" +
                         "<p style='margin: 0;'><b>Mật khẩu:</b> <code style='background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: bold;'>" + password + "</code></p>" +
                         "</div>" +
                         "<p style='text-align: center; margin: 30px 0;'>" +
                         "<a href='" + frontendUrl + "/login' style='background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);'>Đăng nhập Hệ thống</a>" +
                         "</p>" +
                         "<p>Vui lòng đăng nhập và thay đổi mật khẩu ngay trong lần sử dụng đầu tiên để đảm bảo tính bảo mật.</p>" +
                         "<p>Trân trọng,<br><b>Đội ngũ Quản trị Hệ thống</b></p>";
        sendEmail(to, subject, buildHtmlTemplate("Thông tin Tài khoản", content));
    }

    @Async
    public void sendNotificationEmail(String to, String title, String message) {
        String content = "<p>Xin chào,</p><p>" + message + "</p>";
        sendEmail(to, title, buildHtmlTemplate("Thông báo Hệ thống", content));
    }
}
