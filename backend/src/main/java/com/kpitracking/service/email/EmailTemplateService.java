package com.kpitracking.service.email;

import java.util.Locale;
import com.kpitracking.i18n.SupportedLanguages;
import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.dto.response.email.EmailTemplateResponse;
import com.kpitracking.entity.EmailTemplate;
import com.kpitracking.entity.Organization;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.i18n.Terms;
import com.kpitracking.repository.EmailTemplateRepository;
import com.kpitracking.service.email.EmailTemplateCatalog.TemplateDef;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Sinh nội dung email từ template: lấy bản tuỳ chỉnh của tổ chức nếu có,
 * không thì rơi về mặc định trong {@link EmailTemplateCatalog}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmailTemplateService {

    /**
     * Email đã sinh xong, sẵn sàng gửi. {@code enabled=false} ⇒ tổ chức đã tắt loại mail này.
     * {@code source} là HTML thân mail TRƯỚC khi thay biến — dùng khi người dùng chuyển
     * từ trình soạn khối sang chế độ nâng cao và cần HTML gốc còn nguyên {{bien}}.
     */
    public record RenderedEmail(String subject, String html, String source, boolean enabled) {}

    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{\\s*([a-zA-Z0-9_]+)\\s*}}");

    /**
     * Các mẫu HTML nguy hiểm bị loại khi lưu template ở chế độ HTML toàn phần.
     * Email client vốn đã chặn script, nhưng khung xem trước chạy ngay trong trình duyệt
     * người quản trị nên vẫn phải lọc ở server.
     */
    private static final List<Pattern> UNSAFE_PATTERNS = List.of(
            Pattern.compile("(?is)<\\s*script.*?>.*?<\\s*/\\s*script\\s*>"),
            Pattern.compile("(?is)<\\s*script[^>]*/?>"),
            Pattern.compile("(?is)<\\s*iframe.*?>.*?<\\s*/\\s*iframe\\s*>"),
            Pattern.compile("(?is)<\\s*(object|embed|form)[^>]*>"),
            Pattern.compile("(?is)\\son[a-z]+\\s*=\\s*\"[^\"]*\""),
            Pattern.compile("(?is)\\son[a-z]+\\s*=\\s*'[^']*'"),
            Pattern.compile("(?is)\\son[a-z]+\\s*=\\s*[^\\s>]+"),
            Pattern.compile("(?is)javascript\\s*:")
    );

    private final EmailTemplateRepository repository;
    private final com.kpitracking.repository.UserRepository userRepository;
    private final com.kpitracking.repository.UserRoleOrgUnitRepository userRoleOrgUnitRepository;

    @Value("${app.frontend-url:${app.cors.allowed-origins:http://localhost:3000}}")
    private String frontendUrl;

    public String getFrontendUrl() {
        return frontendUrl;
    }

    // ─────────────────────── Danh mục cho màn hình cấu hình ───────────────────────

    /** Toàn bộ danh mục, mỗi mục kèm nội dung đang có hiệu lực của tổ chức. */
    @Transactional(readOnly = true)
    /**
     * @param language ngôn ngữ của BẢN MAIL đang cấu hình (mỗi ngôn ngữ một bản tuỳ chỉnh). Nhãn, mô tả,
     *                 nhóm trên màn hình cấu hình thì theo ngôn ngữ giao diện của người đang xem.
     */
    public List<EmailTemplateResponse> listForOrg(UUID orgId, String language) {
        String lang = requireLanguage(language);
        List<EmailTemplate> all = repository.findByOrganizationId(orgId);
        Map<String, EmailTemplate> custom = all.stream().filter(t -> lang.equals(t.getLanguage()))
                .collect(java.util.stream.Collectors.toMap(EmailTemplate::getTemplateCode, t -> t, (a, b) -> a));

        return EmailTemplateCatalog.all().stream()
                .map(def -> toResponse(def, custom.get(def.getCode()), lang, disabledIn(all, def.getCode())))
                .toList();
    }

    @Transactional(readOnly = true)
    public EmailTemplateResponse getForOrg(UUID orgId, String code, String language) {
        String lang = requireLanguage(language);
        TemplateDef def = requireDef(code);
        return toResponse(def, repository.findByOrganizationIdAndTemplateCodeAndLanguage(orgId, code, lang).orElse(null), lang,
                disabledIn(repository.findByOrganizationId(orgId), code));
    }

    /** Công tắc gửi dùng chung mọi ngôn ngữ: một bản nào đó đang tắt là loại mail đang tắt. */
    private static boolean disabledIn(List<EmailTemplate> all, String code) {
        return all.stream().anyMatch(t -> code.equals(t.getTemplateCode()) && Boolean.FALSE.equals(t.getEnabled()));
    }

    private EmailTemplateResponse toResponse(TemplateDef base, EmailTemplate custom, String language, boolean disabled) {
        Locale uiLocale = ErrorMessages.currentLocale();
        TemplateDef ui = EmailTemplateCatalog.localized(base, uiLocale);
        TemplateDef def = EmailTemplateCatalog.localized(base, SupportedLanguages.toLocale(language));
        return EmailTemplateResponse.builder()
                .code(def.getCode())
                .label(ui.getLabel())
                .description(ui.getDescription())
                .group(EmailTemplateCatalog.groupLabel(def.getGroup(), uiLocale))
                .subject(custom != null ? custom.getSubject() : def.getDefaultSubject())
                .body(custom != null ? custom.getBody() : def.getDefaultBody())
                .fullHtml(custom != null && Boolean.TRUE.equals(custom.getFullHtml()))
                // Loại mail không tự quản công tắc thì luôn báo là đang bật, khớp với
                // hành vi thật ở render() thay vì phản ánh cờ cũ trong DB.
                .enabled(!EmailTemplateCatalog.CONTROL_SELF.equals(def.getEnabledControl()) || !disabled)
                .enabledControl(def.getEnabledControl())
                .customized(custom != null)
                .defaultSubject(def.getDefaultSubject())
                .defaultBody(def.getDefaultBody())
                .variables(ui.getVariables())
                .requiredVariables(def.getRequiredVariables())
                .build();
    }

    /** Tổ chức của người đang đăng nhập. */
    @Transactional(readOnly = true)
    public UUID getCurrentOrgId() {
        String email = org.springframework.security.core.context.SecurityContextHolder
                .getContext().getAuthentication().getName();
        var user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "email", email));
        var roles = userRoleOrgUnitRepository.findByUserId(user.getId());
        if (roles.isEmpty()) {
            throw new ResourceNotFoundException(Terms.of("resource.organization"), "user", email);
        }
        return roles.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
    }

    @Transactional(readOnly = true)
    public UUID getCurrentUserId() {
        String email = org.springframework.security.core.context.SecurityContextHolder
                .getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "email", email))
                .getId();
    }

    // ─────────────────────────────── Sinh nội dung ───────────────────────────────

    /**
     * Sinh email cho một tổ chức. {@code orgId} null (VD luồng quên mật khẩu khi chưa
     * xác định được tổ chức) thì dùng thẳng bản mặc định.
     */
    @Transactional(readOnly = true)
    public RenderedEmail render(UUID orgId, String code, Map<String, String> variables) {
        return render(orgId, code, variables, SupportedLanguages.DEFAULT_LOCALE);
    }

    /** Sinh email theo ngôn ngữ người nhận: bản tuỳ chỉnh của tổ chức cho ngôn ngữ đó, không có thì mặc định của ngôn ngữ đó. */
    @Transactional(readOnly = true)
    public RenderedEmail render(UUID orgId, String code, Map<String, String> variables, Locale locale) {
        String lang = SupportedLanguages.toLocale(locale == null ? null : locale.getLanguage()).getLanguage();
        Locale mailLocale = SupportedLanguages.toLocale(lang);
        TemplateDef def = EmailTemplateCatalog.get(code, mailLocale);
        if (def == null) {
            throw new BusinessException(ErrorCode.NO_EMAIL_TYPE_CODE, String.valueOf(code));
        }

        EmailTemplate custom = orgId == null ? null
                : repository.findByOrganizationIdAndTemplateCodeAndLanguage(orgId, code, lang).orElse(null);

        // Chỉ tôn trọng cờ tắt với loại mail thực sự được phép tắt. Bản ghi cũ có thể
        // còn enabled=false từ trước khi phân quyền công tắc; để nguyên thì mail khôi
        // phục mật khẩu vẫn bị chặn bởi một nút không còn tồn tại trên giao diện.
        // Công tắc gửi là của LOẠI mail, không của từng bản ngôn ngữ: tắt ở bản nào cũng là tắt.
        boolean disabled = orgId != null && EmailTemplateCatalog.CONTROL_SELF.equals(def.getEnabledControl())
                && repository.findByOrganizationId(orgId).stream()
                        .anyMatch(t -> code.equals(t.getTemplateCode()) && Boolean.FALSE.equals(t.getEnabled()));
        if (disabled) {
            return new RenderedEmail(null, null, null, false);
        }

        String subject = custom != null ? custom.getSubject() : def.getDefaultSubject();
        String body = custom != null ? custom.getBody() : def.getDefaultBody();
        boolean fullHtml = custom != null && Boolean.TRUE.equals(custom.getFullHtml());

        Map<String, String> vars = withDefaults(variables);
        String renderedSubject = substituteSubject(subject, vars);
        String renderedBody = substitute(body, vars);

        String html = fullHtml
                ? renderedBody
                : EmailLayout.wrap(substitute(def.getHeaderTitle(), vars), renderedBody, mailLocale);

        return new RenderedEmail(renderedSubject, html, body, true);
    }

    /** Sinh bản xem trước bằng dữ liệu mẫu, dùng cho màn hình cấu hình. Không lưu gì. */
    public RenderedEmail preview(String code, String subject, String body, boolean fullHtml, String language) {
        Locale mailLocale = SupportedLanguages.toLocale(requireLanguage(language));
        TemplateDef def = EmailTemplateCatalog.localized(requireDef(code), mailLocale);
        Map<String, String> sample = sampleVariables(def);

        // Lọc cả hai chế độ: bản xem trước là HTML CHƯA lưu nên chưa qua sanitize ở save().
        String renderedBody = sanitize(substitute(body, sample));
        String html = fullHtml
                ? renderedBody
                : EmailLayout.wrap(substitute(def.getHeaderTitle(), sample), renderedBody, mailLocale);

        String renderedSubject = substituteSubject(
                subject != null && !subject.isBlank() ? subject : def.getDefaultSubject(), sample);
        return new RenderedEmail(renderedSubject, html, sanitize(body), true);
    }

    /**
     * Thay {{bien}} bằng giá trị. Biến không có giá trị được thay bằng chuỗi rỗng
     * thay vì để nguyên — tránh gửi đi email lòi ra "{{ten_nhan_vien}}".
     */
    /**
     * Mọi giá trị biến đều được escape HTML trước khi chèn: họ tên, tên KPI, nội dung thông báo
     * là dữ liệu người dùng gõ; không escape thì một cái tên chứa {@code <a href=...>} sẽ thành
     * liên kết lừa đảo trong email gửi tới người khác. Escape cũng không làm hỏng URL trong
     * {@code href} — {@code &amp;} là dạng đúng của {@code &} trong thuộc tính HTML.
     *
     * <p>Ngoại lệ duy nhất: các biến trong {@link EmailTemplateCatalog#HTML_BLOCK_VARIABLES} là
     * khối HTML hệ thống dựng sẵn và đã tự escape phần người dùng nhập — chèn nguyên văn, nếu
     * không cả lá thư gộp hiện ra toàn thẻ {@code <p style=...>}.
     */
    private String substitute(String text, Map<String, String> vars) {
        return substitute(text, vars, true);
    }

    /**
     * Tiêu đề thư là header text thuần, KHÔNG phải HTML: escape ở đây thì "Khách hàng" tới
     * hộp thư thành "Kh&amp;aacute;ch h&amp;agrave;ng". Biến khối HTML lỡ đặt vào tiêu đề thì
     * bỏ thẻ; xuống dòng ép thành khoảng trắng để giá trị biến không chèn thêm header mới.
     */
    private String substituteSubject(String text, Map<String, String> vars) {
        return substitute(text, vars, false).replaceAll("\\s*\\R\\s*", " ").trim();
    }

    private String substitute(String text, Map<String, String> vars, boolean html) {
        if (text == null) return "";
        Matcher m = PLACEHOLDER.matcher(text);
        StringBuilder sb = new StringBuilder();
        while (m.find()) {
            String name = m.group(1);
            String raw = vars.getOrDefault(name, "");
            String value;
            if (EmailTemplateCatalog.HTML_BLOCK_VARIABLES.contains(name)) {
                value = html ? raw : stripTags(raw);
            } else {
                // Truyền "UTF-8" để chỉ escape < > & " ' — mặc định (ISO-8859-1) còn đổi cả
                // chữ có dấu thành &aacute; làm HTML phình to và khó đọc khi debug.
                value = html ? org.springframework.web.util.HtmlUtils.htmlEscape(raw, "UTF-8") : raw;
            }
            m.appendReplacement(sb, Matcher.quoteReplacement(value));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private static String stripTags(String htmlFragment) {
        return org.springframework.web.util.HtmlUtils.htmlUnescape(
                htmlFragment.replaceAll("(?s)<[^>]*>", " ").replaceAll("\\s+", " ").trim());
    }

    /** Bổ sung các biến có ở mọi template mà nơi gọi không cần truyền. */
    private Map<String, String> withDefaults(Map<String, String> variables) {
        Map<String, String> vars = new java.util.HashMap<>(variables != null ? variables : Map.of());
        vars.putIfAbsent("link_he_thong", frontendUrl);
        return vars;
    }

    private Map<String, String> sampleVariables(TemplateDef def) {
        Map<String, String> sample = new java.util.LinkedHashMap<>();
        def.getVariables().forEach((name, desc) -> sample.put(name, sampleValue(name, desc)));
        sample.put("link_he_thong", frontendUrl);
        return sample;
    }

    private String sampleValue(String name, String description) {
        return switch (name) {
            case "ma_otp" -> "482913";
            case "mat_khau" -> "Abc@12345";
            case "email" -> "nhanvien@congty.vn";
            case "ten_nhan_vien", "ten_nguoi_nhan", "nguoi_gui" -> "Nguyễn Văn A";
            case "don_vi" -> "Phòng Kinh doanh";
            case "ky_danh_gia" -> "Kỳ 6 tháng đầu năm 2026";
            case "diem_tu_danh_gia" -> "68";
            case "diem_qltt" -> "71";
            case "diem_chot" -> "75";
            case "xep_loai" -> "Khá";
            case "muc_dinh_tinh" -> "4/5";
            case "xep_loai_ma_tran" -> "3/5";
            case "nhan_xet" -> "Hoàn thành tốt nhiệm vụ, cần cải thiện tiến độ báo cáo.";
            case "tieu_de" -> "Báo cáo KPI mới cần duyệt";
            case "noi_dung" -> "Nhân viên Nguyễn Văn A vừa nộp báo cáo cho chỉ tiêu KPI 'Doanh số quý'.";
            case "bang_diem_dot" -> "<table class='score-table'><tr><th>Đợt</th><th>Tự ĐG</th><th>QLTT</th></tr>"
                    + "<tr><td>Tháng 1</td><td>70</td><td>72</td></tr>"
                    + "<tr><td>Tháng 2</td><td>66</td><td>70</td></tr></table>";
            case "link_he_thong" -> frontendUrl;
            default -> "[" + description + "]";
        };
    }

    // ─────────────────────────────── Cấu hình ───────────────────────────────

    @Transactional(readOnly = true)
    public List<EmailTemplate> findAllCustom(UUID orgId) {
        return repository.findByOrganizationId(orgId);
    }

    /**
     * Lưu template. {@code body} là HTML thân email do trình soạn trực quan sinh ra
     * (hoặc do người dùng tự viết ở chế độ nâng cao) — HTML là nguồn sự thật duy nhất,
     * trình soạn đọc ngược lại được nhờ các thuộc tính {@code data-email}.
     */
    @Transactional
    public EmailTemplate save(UUID orgId, UUID actorId, String code, String language, String subject,
                              String body, boolean fullHtml, boolean enabled) {
        String lang = requireLanguage(language);
        TemplateDef def = EmailTemplateCatalog.localized(requireDef(code), SupportedLanguages.toLocale(lang));
        validateRequiredVariables(def, subject, body);

        EmailTemplate entity = repository.findByOrganizationIdAndTemplateCodeAndLanguage(orgId, code, lang)
                .orElseGet(() -> {
                    Organization org = new Organization();
                    org.setId(orgId);
                    return EmailTemplate.builder().organization(org).templateCode(code).language(lang).build();
                });

        entity.setSubject(subject != null && !subject.isBlank() ? subject.trim() : def.getDefaultSubject());
        entity.setBody(sanitize(body));
        entity.setFullHtml(fullHtml);
        entity.setEnabled(resolveEnabled(def, enabled));
        entity.setUpdatedBy(actorId);
        EmailTemplate saved = repository.save(entity);
        // Công tắc gửi dùng chung mọi ngôn ngữ của loại mail này.
        repository.findByOrganizationId(orgId).stream()
                .filter(t -> code.equals(t.getTemplateCode()) && !t.getId().equals(saved.getId()))
                .forEach(t -> t.setEnabled(saved.getEnabled()));
        return saved;
    }

    /**
     * Quyết định giá trị bật/tắt được phép lưu, tuỳ theo ai làm chủ công tắc.
     * Kiểm tra ở server chứ không chỉ ẩn nút trên giao diện — gọi thẳng API vẫn phải chặn.
     */
    private boolean resolveEnabled(TemplateDef def, boolean requested) {
        switch (def.getEnabledControl()) {
            case EmailTemplateCatalog.CONTROL_LOCKED:
                if (!requested) {
                    throw new BusinessException(ErrorCode.CANNOT_TURNED_OFF, def.getLabel());
                }
                return true;
            case EmailTemplateCatalog.CONTROL_NOTIFICATION_SETTINGS:
                // Công tắc thuộc tab Thiết lập thông báo. Ép true để một giá trị false
                // sót lại từ trước không âm thầm chặn mail bằng nút không còn hiển thị.
                return true;
            default:
                return requested;
        }
    }

    /** Xoá bản tuỳ chỉnh ⇒ quay về nội dung mặc định. */
    @Transactional
    public void resetToDefault(UUID orgId, String code, String language) {
        requireDef(code);
        repository.deleteByOrganizationIdAndTemplateCodeAndLanguage(orgId, code, requireLanguage(language));
    }

    /** Ngôn ngữ của bản mail đang cấu hình; bỏ trống là tiếng Việt, mã lạ thì báo lỗi. */
    private static String requireLanguage(String language) {
        if (language == null || language.isBlank()) return SupportedLanguages.DEFAULT;
        if (!SupportedLanguages.isSupported(language)) {
            throw new com.kpitracking.exception.BusinessException(ErrorCode.UNSUPPORTED_LANGUAGE, language,
                    String.join(", ", SupportedLanguages.ALL));
        }
        return language;
    }

    /**
     * Chặn lưu template thiếu biến bắt buộc. Đây là chốt an toàn quan trọng nhất:
     * mail OTP mà mất {{ma_otp}} thì không ai khôi phục được mật khẩu nữa.
     */
    private void validateRequiredVariables(TemplateDef def, String subject, String body) {
        if (body == null || body.isBlank()) {
            throw new BusinessException(ErrorCode.EMAIL_CONTENT_CANNOT_EMPTY);
        }
        String combined = (subject == null ? "" : subject) + " " + body;
        List<String> missing = new ArrayList<>();
        for (String required : def.getRequiredVariables()) {
            if (!combined.contains("{{" + required + "}}")) missing.add("{{" + required + "}}");
        }
        if (!missing.isEmpty()) {
            throw new BusinessException(ErrorCode.TEMPLATE_MUST_CONTAIN_VARIABLE, def.getLabel(), String.join(", ", missing));
        }
    }

    /** Loại bỏ script/handler/iframe khỏi HTML người dùng nhập. */
    public String sanitize(String html) {
        if (html == null) return "";
        String cleaned = html;
        for (Pattern p : UNSAFE_PATTERNS) {
            cleaned = p.matcher(cleaned).replaceAll("");
        }
        return cleaned;
    }

    private TemplateDef requireDef(String code) {
        TemplateDef def = EmailTemplateCatalog.get(code);
        if (def == null) throw new BusinessException(ErrorCode.NO_EMAIL_TYPE_CODE, String.valueOf(code));
        return def;
    }
}
