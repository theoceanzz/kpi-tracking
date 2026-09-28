package com.kpitracking.i18n;

import com.kpitracking.config.LocaleConfig;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.GlobalExceptionHandler;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.service.email.EmailTemplateCatalog;
import com.kpitracking.security.audit.SecurityAuditService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.servlet.LocaleResolver;

import java.io.IOException;
import java.io.InputStreamReader;
import java.text.MessageFormat;
import java.nio.charset.StandardCharsets;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Properties;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

@DisplayName("Hạ tầng đa ngôn ngữ (P0)")
class I18nInfrastructureTest {

    /** Các mã chỉ mang câu nguyên văn từ constructor cũ — không cần câu trong messages*.properties. */
    private static final Set<ErrorCode> VERBATIM_ONLY = EnumSet.of(
            ErrorCode.BUSINESS_RULE, ErrorCode.NOT_FOUND, ErrorCode.FORBIDDEN, ErrorCode.DUPLICATE_RESOURCE,
            ErrorCode.STALE_STATE, ErrorCode.ACCOUNT_LOCKED, ErrorCode.AI_TOKEN_QUOTA_EXCEEDED,
            ErrorCode.AI_RATE_LIMITED);

    private final LocaleConfig config = new LocaleConfig();
    private final MessageSource messageSource = config.messageSource();
    private final Messages messages = new Messages(messageSource);
    private final LocaleResolver localeResolver = config.localeResolver();

    @AfterEach
    void resetLocale() {
        LocaleContextHolder.resetLocaleContext();
    }

    private static Properties load(String path) throws IOException {
        Properties props = new Properties();
        try (var in = I18nInfrastructureTest.class.getClassLoader().getResourceAsStream(path)) {
            assertThat(in).as(path).isNotNull();
            props.load(new InputStreamReader(in, StandardCharsets.UTF_8));
        }
        return props;
    }

    @Test
    @DisplayName("Mọi ErrorCode có câu dịch đều có mặt ở cả tiếng Việt và tiếng Anh")
    void everyTranslatedCodeHasViAndEnMessage() throws IOException {
        Properties vi = load("i18n/messages.properties");
        Properties en = load("i18n/messages_en.properties");
        for (ErrorCode code : ErrorCode.values()) {
            if (VERBATIM_ONLY.contains(code)) continue;
            assertThat(vi).as("vi thiếu %s", code.messageKey()).containsKey(code.messageKey());
            assertThat(en).as("en thiếu %s", code.messageKey()).containsKey(code.messageKey());
        }
    }

    @Test
    @DisplayName("File tiếng Anh không có key lạ mà bản gốc tiếng Việt không có")
    void englishKeysAreSubsetOfVietnamese() throws IOException {
        Properties vi = load("i18n/messages.properties");
        Properties en = load("i18n/messages_en.properties");
        assertThat(vi.keySet()).containsAll(en.keySet());
    }

    @Test
    @DisplayName("Tra câu theo ngôn ngữ; ngôn ngữ chưa hỗ trợ rơi về tiếng Việt, không theo locale JVM")
    void resolvesByLocaleWithVietnameseFallback() {
        assertThat(messages.get(Locale.forLanguageTag("en"), "error.BAD_CREDENTIALS"))
                .isEqualTo("Incorrect email or password");
        assertThat(messages.get(Locale.forLanguageTag("vi"), "error.BAD_CREDENTIALS"))
                .isEqualTo("Email hoặc mật khẩu không chính xác");
        assertThat(messages.get(Locale.FRENCH, "error.BAD_CREDENTIALS"))
                .isEqualTo("Email hoặc mật khẩu không chính xác");
    }

    @Test
    @DisplayName("Tham số được chèn vào câu, key thiếu thì trả chính key")
    void formatsArgumentsAndReturnsKeyWhenMissing() {
        assertThat(messages.get(Locale.forLanguageTag("en"), "error.RATE_LIMITED", 30))
                .isEqualTo("You are doing that too fast. Please try again in 30 seconds.");
        assertThat(messages.get(Locale.forLanguageTag("en"), "error.DOES_NOT_EXIST"))
                .isEqualTo("error.DOES_NOT_EXIST");
    }

    @Test
    @DisplayName("Accept-Language: không có → vi, en-US → en, ngôn ngữ lạ → vi")
    void localeResolverFollowsSupportedLanguages() {
        MockHttpServletRequest none = new MockHttpServletRequest();
        assertThat(localeResolver.resolveLocale(none).getLanguage()).isEqualTo("vi");

        MockHttpServletRequest enUs = new MockHttpServletRequest();
        enUs.addHeader("Accept-Language", "en-US,en;q=0.9");
        enUs.addPreferredLocale(Locale.US);
        assertThat(localeResolver.resolveLocale(enUs).getLanguage()).isEqualTo("en");

        MockHttpServletRequest fr = new MockHttpServletRequest();
        fr.addHeader("Accept-Language", "fr-FR");
        fr.addPreferredLocale(Locale.FRANCE);
        assertThat(localeResolver.resolveLocale(fr).getLanguage()).isEqualTo("vi");
    }

    @Test
    @DisplayName("BusinessException có mã: trả mã + câu dịch + đúng HTTP status; cách cũ giữ câu nguyên văn")
    void handlerTranslatesCodedAndKeepsLegacyVerbatim() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler(mock(SecurityAuditService.class), messages);
        LocaleContextHolder.setLocale(Locale.forLanguageTag("en"));

        ResponseEntity<ApiResponse<Void>> coded =
                handler.handleBusinessException(new BusinessException(ErrorCode.UNSUPPORTED_LANGUAGE, "fr", "vi, en"));
        assertThat(coded.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(coded.getBody().getCode()).isEqualTo("UNSUPPORTED_LANGUAGE");
        assertThat(coded.getBody().getMessage()).isEqualTo("The language \"fr\" is not supported. Choose one of: vi, en.");

        ResponseEntity<ApiResponse<Void>> legacy =
                handler.handleBusinessException(new BusinessException("Tổng trọng số vượt 100%"));
        assertThat(legacy.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(legacy.getBody().getCode()).isEqualTo("BUSINESS_RULE");
        assertThat(legacy.getBody().getMessage()).isEqualTo("Tổng trọng số vượt 100%");
    }

    @Test
    @DisplayName("Mọi câu có tham số là MessageFormat hợp lệ, và bản tiếng Anh dùng đúng bộ tham số của bản gốc")
    void messagesParseAndPlaceholdersMatch() throws IOException {
        for (String bundle : List.of("messages", "notifications", "exports")) {
            checkBundle(bundle);
        }
    }

    private void checkBundle(String bundle) throws IOException {
        Properties vi = load("i18n/" + bundle + ".properties");
        Properties en = load("i18n/" + bundle + "_en.properties");
        assertThat(vi.keySet()).as("%s_en có key lạ", bundle).containsAll(en.keySet());
        for (String key : vi.stringPropertyNames()) {
            String v = vi.getProperty(key);
            String e = en.getProperty(key);
            assertThat(e).as("en thiếu %s", key).isNotNull();
            assertThat(placeholders(e)).as("tham số lệch ở %s", key).isEqualTo(placeholders(v));
            if (!placeholders(v).isEmpty()) {
                assertThat(new MessageFormat(v).getFormatsByArgumentIndex()).as(key).isNotNull();
                assertThat(new MessageFormat(e).getFormatsByArgumentIndex()).as(key).isNotNull();
            }
            assertThat(VIETNAMESE.matcher(e).find()).as("en còn tiếng Việt ở %s: %s", key, e).isFalse();
            // Câu có tham số đi qua MessageFormat: dấu nháy đơn lẻ nuốt mất phần sau nó.
            if (!placeholders(v).isEmpty()) {
                assertThat(strayQuote(v)).as("vi có dấu ' chưa viết thành '' ở %s", key).isFalse();
                assertThat(strayQuote(e)).as("en có dấu ' chưa viết thành '' ở %s", key).isFalse();
            }
        }
    }

    /** Dấu ' lẻ không phải '' và không bọc ký tự { } — MessageFormat sẽ hiểu là mở literal. */
    private static boolean strayQuote(String pattern) {
        String rest = pattern.replace("''", "").replaceAll("'[{}#]+'", "");
        return rest.indexOf('\'') >= 0;
    }

    @Test
    @DisplayName("Thông báo lưu dạng key + tham số, đọc lại và dịch theo ngôn ngữ người xem")
    void localizedTextRoundTripsAndRendersPerLocale() {
        LocalizedText text = LocalizedText.of("notif.kpi.rejected.message", "Doanh số", "Trần Thị B",
                LocalizedText.of("notif.common.reasonSuffix", "Thiếu minh chứng"));
        LocalizedText back = LocalizedText.fromJson(text.toJson());
        assertThat(back).isNotNull();
        assertThat(back.render(Locale.forLanguageTag("vi")))
                .isEqualTo("Chỉ tiêu KPI 'Doanh số' do bạn tạo đã bị từ chối bởi Trần Thị B. Lý do: Thiếu minh chứng");
        assertThat(back.render(Locale.forLanguageTag("en")))
                .isEqualTo("The KPI 'Doanh số' you created was rejected by Trần Thị B. Reason: Thiếu minh chứng");
        assertThat(LocalizedText.renderOr(null, "câu cũ", Locale.ENGLISH)).isEqualTo("câu cũ");
    }

    @Test
    @DisplayName("Mọi loại email có nội dung mặc định tiếng Anh, giữ đủ biến bắt buộc")
    void everyEmailTemplateHasEnglishDefault() {
        for (EmailTemplateCatalog.TemplateDef def : EmailTemplateCatalog.all()) {
            EmailTemplateCatalog.TemplateDef en = EmailTemplateCatalog.get(def.getCode(), Locale.ENGLISH);
            assertThat(en.getLabel()).as("thiếu bản tiếng Anh: %s", def.getCode()).isNotEqualTo(def.getLabel());
            for (String required : def.getRequiredVariables()) {
                assertThat(en.getDefaultSubject() + en.getDefaultBody()).as("%s mất biến %s", def.getCode(), required)
                        .contains("{{" + required + "}}");
            }
            assertThat(VIETNAMESE.matcher(en.getDefaultBody() + en.getDefaultSubject() + en.getLabel()).find())
                    .as("email tiếng Anh còn tiếng Việt: %s", def.getCode()).isFalse();
        }
    }

    @Test
    @DisplayName("Exception có mã tự dịch getMessage() theo ngôn ngữ request; tham số tài nguyên cũng được dịch")
    void codedExceptionMessageFollowsRequestLocale() {
        ResourceNotFoundException ex = new ResourceNotFoundException(Terms.of("resource.user"), Terms.of("field.code"), 1234);
        assertThat(ex.getMessage()).isEqualTo("Người dùng không tìm thấy với mã: '1234'");
        LocaleContextHolder.setLocale(Locale.forLanguageTag("en"));
        assertThat(ex.getMessage()).isEqualTo("User not found with code: '1234'");
        assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND_BY_FIELD);
    }

    private static final Pattern VIETNAMESE = Pattern.compile("[ăâđêôơưĂÂĐÊÔƠƯàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]");

    /** Chỉ số tham số {n}, bỏ qua phần trong ngoặc đơn (literal của MessageFormat). */
    private static Set<String> placeholders(String pattern) {
        String unquoted = pattern.replaceAll("'[^']*'", "");
        Set<String> out = new java.util.TreeSet<>();
        Matcher m = Pattern.compile("\\{(\\d+)").matcher(unquoted);
        while (m.find()) out.add(m.group(1));
        return out;
    }
}
