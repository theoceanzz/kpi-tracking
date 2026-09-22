package com.kpitracking.service;

import com.kpitracking.dto.request.landing.LandingLeadRequest;
import com.kpitracking.entity.LandingLead;
import com.kpitracking.exception.BusinessException;
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

/**
 * Nhận đăng ký tư vấn từ trang giới thiệu (endpoint public, không đăng nhập).
 *
 * <p>Ba lớp chống rác vì endpoint mở cho cả internet: honeypot ở DTO, giới hạn theo IP
 * (5 lượt / 10 phút, bộ đếm trong bộ nhớ như {@code AuthRateLimitFilter}) và gộp trùng theo
 * số điện thoại trong 24 giờ. Lưu xong mới gửi mail báo sale — mail hỏng không làm mất lead.
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
    private final SlidingWindowCounter counter = new SlidingWindowCounter(WINDOW);

    public LandingLeadService(LandingLeadRepository repository, EmailService emailService,
                              @Value("${app.landing.notify-email:}") String notifyEmail) {
        this.repository = repository;
        this.emailService = emailService;
        this.notifyEmail = notifyEmail == null ? "" : notifyEmail.trim();
    }

    @Transactional
    public void submit(LandingLeadRequest req, String clientIp) {
        // Bot điền vào ô ẩn → im lặng bỏ qua (controller vẫn trả 200 để bot không dò ra)
        if (req.getWebsite() != null && !req.getWebsite().isBlank()) {
            log.info("Bỏ qua lead từ bot (honeypot) ip={}", clientIp);
            return;
        }
        if (counter.increment("lead|" + clientIp) > MAX_PER_WINDOW) {
            throw new BusinessException("Bạn gửi quá nhiều lần. Vui lòng thử lại sau ít phút hoặc gọi hotline.");
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
