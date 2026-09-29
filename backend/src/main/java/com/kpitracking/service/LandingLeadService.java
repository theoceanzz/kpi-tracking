package com.kpitracking.service;

import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.dto.request.landing.LandingLeadRequest;
import com.kpitracking.entity.LandingLead;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.repository.LandingLeadRepository;
import com.kpitracking.security.SlidingWindowCounter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;

/**
 * Nhận đăng ký tư vấn từ trang giới thiệu (endpoint public, không đăng nhập).
 *
 * <p>Ba lớp chống rác vì endpoint mở cho cả internet: honeypot ở DTO, giới hạn theo IP
 * (5 lượt / 10 phút, bộ đếm trong bộ nhớ như {@code AuthRateLimitFilter}) và gộp trùng theo
 * số điện thoại trong 24 giờ. Lưu xong mới gửi mail báo sale và mail tài khoản demo cho người đăng ký —
 * mail hỏng không làm mất lead.
 *
 * <p>Tài khoản demo không còn hiện công khai ở trang đăng nhập: chỉ ai để lại thông tin mới nhận được,
 * qua email riêng. Danh sách lấy từ {@code app.landing.demo-accounts}, dạng
 * {@code "Nhãn|email|mật khẩu;Nhãn|email|mật khẩu"}; để trống thì không gửi.
 */
@Service
@Slf4j
public class LandingLeadService {

    private static final int MAX_PER_WINDOW = 5;
    private static final Duration WINDOW = Duration.ofMinutes(10);
    private static final Duration DEDUPE = Duration.ofHours(24);
    private static final DateTimeFormatter TIME_FMT =
            DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy").withZone(ZoneId.of("Asia/Ho_Chi_Minh"));

    private final LandingLeadRepository repository;
    private final EmailService emailService;
    private final String notifyEmail;
    private final List<DemoAccount> demoAccounts;
    private final String loginUrl;
    private final SlidingWindowCounter counter = new SlidingWindowCounter(WINDOW);

    record DemoAccount(String label, String email, String password) {}

    public LandingLeadService(LandingLeadRepository repository, EmailService emailService,
                              @Value("${app.landing.notify-email:}") String notifyEmail,
                              @Value("${app.landing.demo-accounts:}") String demoAccounts,
                              @Value("${app.frontend-url:${app.cors.allowed-origins:http://localhost:3000}}") String frontendUrl) {
        this.repository = repository;
        this.emailService = emailService;
        this.notifyEmail = notifyEmail == null ? "" : notifyEmail.trim();
        this.demoAccounts = parseDemoAccounts(demoAccounts);
        // allowed-origins có thể là danh sách phân tách bằng dấu phẩy — lấy origin đầu
        this.loginUrl = frontendUrl.split(",")[0].trim().replaceAll("/+$", "") + "/login";
    }

    @Transactional
    public void submit(LandingLeadRequest req, String clientIp) {
        // Bot điền vào ô ẩn → im lặng bỏ qua (controller vẫn trả 200 để bot không dò ra)
        if (req.getWebsite() != null && !req.getWebsite().isBlank()) {
            log.info("Bỏ qua lead từ bot (honeypot) ip={}", clientIp);
            return;
        }
        if (counter.increment("lead|" + clientIp) > MAX_PER_WINDOW) {
            throw new BusinessException(ErrorCode.SENT_TOO_MANY_TIMES);
        }

        String phone = normalizePhone(req.getPhone());
        if (repository.existsByPhoneAndCreatedAtAfter(phone, Instant.now().minus(DEDUPE))) {
            // Đã nhận trong 24h: không tạo thêm bản ghi, người dùng vẫn thấy "đã nhận"
            log.info("Lead trùng số {} trong 24h, không tạo mới", phone);
            return;
        }

        LandingLead lead = repository.save(LandingLead.builder()
                .fullName(req.getFullName().trim())
                .phone(phone)
                .email(blankToNull(req.getEmail()))
                .company(blankToNull(req.getCompany()))
                .headcount(blankToNull(req.getHeadcount()))
                .note(blankToNull(req.getNote()))
                .source(blankToNull(req.getSource()) == null ? "landing" : req.getSource().trim())
                .clientIp(clientIp)
                .build());
        log.info("Lead mới id={} phone={} company={}", lead.getId(), lead.getPhone(), lead.getCompany());
        notifySales(lead);
        sendDemoAccounts(lead);
    }

    /** Gửi tài khoản demo tới email người đăng ký. Lead trùng trong 24h đã return ở trên nên không gửi lặp. */
    private void sendDemoAccounts(LandingLead lead) {
        if (lead.getEmail() == null || demoAccounts.isEmpty()) return;
        StringBuilder rows = new StringBuilder();
        for (DemoAccount a : demoAccounts) {
            rows.append("""
                    <tr>
                      <td style="padding:10px 12px;border-top:1px solid #e2e8f0"><b>%s</b></td>
                      <td style="padding:10px 12px;border-top:1px solid #e2e8f0">%s</td>
                      <td style="padding:10px 12px;border-top:1px solid #e2e8f0;font-family:Consolas,monospace">%s</td>
                    </tr>
                    """.formatted(esc(a.label()), esc(a.email()), esc(a.password())));
        }
        // Người đăng ký chưa có tài khoản: thư đi theo ngôn ngữ trang giới thiệu họ đang xem.
        java.util.Locale locale = ErrorMessages.currentLocale();
        java.util.function.Function<String, String> t = key -> ErrorMessages.text(locale, "email.demo." + key, key);
        String html = """
                <div style="font-family:Inter,Arial,sans-serif;font-size:14px;color:#0f172a;max-width:620px">
                  <p>%s</p>
                  <p>%s</p>
                  <table cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;width:100%%">
                    <tr style="background:#f1f5f9;color:#475569">
                      <th align="left" style="padding:10px 12px">%s</th>
                      <th align="left" style="padding:10px 12px">%s</th>
                      <th align="left" style="padding:10px 12px">%s</th>
                    </tr>
                    %s
                  </table>
                  <p style="margin:20px 0">
                    <a href="%s" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">%s</a>
                  </p>
                  <p style="color:#64748b;font-size:13px">%s</p>
                </div>
                """.formatted(ErrorMessages.text(locale, "email.demo.greeting", "", esc(lead.getFullName())),
                t.apply("intro"), t.apply("colRole"), t.apply("colEmail"), t.apply("colPassword"),
                rows, esc(loginUrl), t.apply("signIn"), t.apply("note"));
        emailService.sendEmail(lead.getEmail(), t.apply("subject"), html);
    }

    /** "Nhãn|email|mật khẩu;..." — mục sai định dạng bị bỏ qua kèm cảnh báo, không làm app chết. */
    static List<DemoAccount> parseDemoAccounts(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        return Arrays.stream(raw.split(";"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> {
                    String[] parts = s.split("\\|", 3);
                    if (parts.length != 3 || parts[1].isBlank() || parts[2].isBlank()) {
                        log.warn("Bỏ qua mục app.landing.demo-accounts sai định dạng (cần Nhãn|email|mật khẩu)");
                        return null;
                    }
                    return new DemoAccount(parts[0].trim(), parts[1].trim(), parts[2].trim());
                })
                .filter(Objects::nonNull)
                .toList();
    }

    /** Gửi qua {@link EmailService#sendEmail} (đã @Async ở bean đó) — gọi @Async trong cùng class không qua proxy nên không dùng. */
    private void notifySales(LandingLead lead) {
        if (notifyEmail.isEmpty()) return;
        String subject = "[KeyGo] Đăng ký tư vấn mới: " + lead.getFullName()
                + (lead.getCompany() != null ? " · " + lead.getCompany() : "");
        String html = """
                <div style="font-family:Inter,Arial,sans-serif;font-size:14px;color:#0f172a">
                  <h2 style="margin:0 0 12px">Đăng ký tư vấn mới từ trang giới thiệu</h2>
                  <table cellpadding="6" style="border-collapse:collapse">
                    <tr><td style="color:#64748b">Họ tên</td><td><b>%s</b></td></tr>
                    <tr><td style="color:#64748b">Điện thoại</td><td><a href="tel:%s">%s</a></td></tr>
                    <tr><td style="color:#64748b">Email</td><td>%s</td></tr>
                    <tr><td style="color:#64748b">Công ty</td><td>%s</td></tr>
                    <tr><td style="color:#64748b">Quy mô</td><td>%s</td></tr>
                    <tr><td style="color:#64748b">Ghi chú</td><td>%s</td></tr>
                    <tr><td style="color:#64748b">Thời gian</td><td>%s</td></tr>
                  </table>
                </div>
                """.formatted(
                esc(lead.getFullName()), esc(lead.getPhone()), esc(lead.getPhone()),
                esc(orDash(lead.getEmail())), esc(orDash(lead.getCompany())), esc(orDash(lead.getHeadcount())),
                esc(orDash(lead.getNote())), TIME_FMT.format(lead.getCreatedAt() == null ? Instant.now() : lead.getCreatedAt()));
        // Lead đã lưu; mail hỏng chỉ ghi log bên EmailService, sale vẫn thấy trong bảng landing_leads
        emailService.sendEmail(notifyEmail, subject, html);
    }

    private static String normalizePhone(String raw) {
        String digits = raw.replaceAll("[^0-9+]", "");
        if (digits.startsWith("+84")) digits = "0" + digits.substring(3);
        return digits;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String orDash(String s) {
        return s == null ? "—" : s;
    }

    private static String esc(String s) {
        return HtmlUtils.htmlEscape(s);
    }
}
