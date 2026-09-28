package com.kpitracking.i18n;

import java.util.List;
import java.util.Locale;

/**
 * Danh sách ngôn ngữ hệ thống hỗ trợ — nguồn duy nhất cho resolver, validate và cột
 * {@code users.preferred_language} / {@code organizations.default_language}.
 *
 * <p>Thêm ngôn ngữ mới: thêm mã vào {@link #ALL}, thêm {@code i18n/messages_<mã>.properties} và bộ
 * {@code locales/<mã>/} ở frontend. Tiếng Việt là bản gốc ({@code messages.properties}), nên mọi key
 * thiếu ở ngôn ngữ khác đều rơi về tiếng Việt.
 */
public final class SupportedLanguages {

    public static final String DEFAULT = "vi";

    public static final List<String> ALL = List.of("vi", "en");

    public static final Locale DEFAULT_LOCALE = Locale.forLanguageTag(DEFAULT);

    public static final List<Locale> LOCALES = ALL.stream().map(Locale::forLanguageTag).toList();

    private SupportedLanguages() {}

    public static boolean isSupported(String language) {
        return language != null && ALL.contains(language);
    }

    /** Mã không hỗ trợ (hoặc null) thì trả tiếng Việt, không bao giờ phụ thuộc locale của JVM. */
    public static Locale toLocale(String language) {
        return isSupported(language) ? Locale.forLanguageTag(language) : DEFAULT_LOCALE;
    }
}
