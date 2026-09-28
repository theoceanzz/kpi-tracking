package com.kpitracking.i18n;

import com.kpitracking.exception.ErrorCode;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContext;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.context.support.ResourceBundleMessageSource;

import java.util.Locale;

/**
 * Dịch câu lỗi mà không cần Spring bean — dùng cho {@code getMessage()} của exception có {@link ErrorCode}.
 *
 * <p>Nhiều chỗ bắt exception rồi dùng lại {@code getMessage()} (gom lỗi import, trả cho trợ lý AI, ghi
 * log), nên exception có mã vẫn phải cho ra câu đọc được theo ngôn ngữ của request hiện tại. Ngoài
 * request (job, unit test) thì dùng tiếng Việt — không bao giờ theo locale của JVM.
 */
public final class ErrorMessages {

    /** messages = lỗi và nhãn chung; notifications = chuông/email sự kiện; exports = tiêu đề file xuất. */
    public static final String[] BASENAMES = {"i18n/messages", "i18n/notifications", "i18n/exports"};

    private static final MessageSource SOURCE = create();

    private ErrorMessages() {}

    /** Cấu hình dùng chung với bean {@code messageSource} trong {@code LocaleConfig}. */
    public static ResourceBundleMessageSource create() {
        ResourceBundleMessageSource source = new ResourceBundleMessageSource();
        source.setBasenames(BASENAMES);
        source.setDefaultEncoding("UTF-8");
        source.setFallbackToSystemLocale(false);
        return source;
    }

    public static String resolve(ErrorCode code, Object[] args) {
        return resolve(currentLocale(), code, args);
    }

    public static String resolve(Locale locale, ErrorCode code, Object[] args) {
        return SOURCE.getMessage(code.messageKey(), args, code.name(), locale);
    }

    /**
     * Câu bất kỳ trong messages*.properties theo ngôn ngữ của request hiện tại — cho đoạn chữ ghép vào
     * câu lỗi (nhãn bước, từng lỗi cấu hình) ở nơi không tiện tiêm bean {@code Messages}. Key thiếu thì
     * trả {@code fallback}.
     */
    public static String text(String key, String fallback, Object... args) {
        return text(currentLocale(), key, fallback, args);
    }

    public static String text(Locale locale, String key, String fallback, Object... args) {
        return SOURCE.getMessage(key, args, fallback, locale);
    }

    /** Ngôn ngữ của request hiện tại, đã chuẩn hoá về ngôn ngữ hỗ trợ; ngoài request là tiếng Việt. */
    public static Locale currentLocale() {
        LocaleContext context = LocaleContextHolder.getLocaleContext();
        Locale locale = context != null ? context.getLocale() : null;
        return locale != null ? SupportedLanguages.toLocale(locale.getLanguage()) : SupportedLanguages.DEFAULT_LOCALE;
    }
}
