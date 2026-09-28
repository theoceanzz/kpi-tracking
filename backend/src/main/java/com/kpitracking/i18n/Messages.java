package com.kpitracking.i18n;

import com.kpitracking.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * Tra câu đã dịch từ {@code i18n/messages*.properties}.
 *
 * <p>Trong request, ngôn ngữ lấy từ {@link LocaleContextHolder} (do {@link LocaleContextFilter} đặt theo
 * {@code Accept-Language}). Code chạy nền (email, thông báo, job) không có request nên phải truyền
 * {@link Locale} của người nhận — lấy qua {@link UserLanguageResolver}.
 *
 * <p>Key thiếu thì trả về chính key thay vì ném lỗi: người dùng thấy một chuỗi lạ, còn hơn là mất
 * luôn phản hồi lỗi vì lỗi trong lúc dựng phản hồi lỗi.
 */
@Component
@RequiredArgsConstructor
public class Messages {

    private final MessageSource messageSource;

    public String get(String key, Object... args) {
        return get(LocaleContextHolder.getLocale(), key, args);
    }

    public String get(Locale locale, String key, Object... args) {
        return messageSource.getMessage(key, args, key, locale);
    }

    public String error(ErrorCode code, Object... args) {
        return get(code.messageKey(), args);
    }
}
