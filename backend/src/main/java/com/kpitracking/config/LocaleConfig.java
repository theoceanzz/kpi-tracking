package com.kpitracking.config;

import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.i18n.LocaleContextFilter;
import com.kpitracking.i18n.SupportedLanguages;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.boot.web.servlet.filter.OrderedFilter;
import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

/**
 * Đa ngôn ngữ phía backend. Thiết kế: {@code docs/I18N_DESIGN.md} §6.
 *
 * <p>Khai báo bằng code thay vì {@code spring.messages.*} trong application.yaml vì file đó bị gitignore —
 * cấu hình để ở đó sẽ chỉ có trên máy người viết.
 */
@Configuration
public class LocaleConfig {

    /**
     * Không có header, hoặc header toàn ngôn ngữ chưa hỗ trợ, đều ra tiếng Việt. "en-US" khớp "en" theo
     * phần ngôn ngữ.
     */
    @Bean
    public LocaleResolver localeResolver() {
        AcceptHeaderLocaleResolver resolver = new AcceptHeaderLocaleResolver();
        resolver.setSupportedLocales(SupportedLanguages.LOCALES);
        resolver.setDefaultLocale(SupportedLanguages.DEFAULT_LOCALE);
        return resolver;
    }

    /**
     * {@code i18n/messages.properties} là bản tiếng Việt (gốc), {@code messages_en.properties} là tiếng Anh.
     * {@code fallbackToSystemLocale = false}: key thiếu ở tiếng Anh rơi về bản gốc tiếng Việt chứ không
     * đi tìm theo locale của JVM.
     *
     * <p>Bean tên {@code messageSource} nên Spring Boot bỏ bean mặc định, và validator của Boot tự dùng
     * bean này — {@code message = "{validation.required}"} trên DTO được dịch mà không cần cấu hình thêm.
     */
    @Bean
    public MessageSource messageSource() {
        return ErrorMessages.create();
    }

    /** Ngay sau RequestContextFilter của Boot (-105) và trước Spring Security (-100). */
    @Bean
    public FilterRegistrationBean<LocaleContextFilter> localeContextFilter(LocaleResolver localeResolver) {
        FilterRegistrationBean<LocaleContextFilter> registration =
                new FilterRegistrationBean<>(new LocaleContextFilter(localeResolver));
        // OrderedRequestContextFilter đứng ở REQUEST_WRAPPER_FILTER_MAX_ORDER - 105.
        registration.setOrder(OrderedFilter.REQUEST_WRAPPER_FILTER_MAX_ORDER - 104);
        return registration;
    }
}
