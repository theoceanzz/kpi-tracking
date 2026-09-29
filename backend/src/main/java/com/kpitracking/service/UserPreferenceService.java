package com.kpitracking.service;

import com.kpitracking.dto.request.user.UpdateUserPreferencesRequest;
import com.kpitracking.dto.response.auth.UserInfoResponse;
import com.kpitracking.entity.User;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.SupportedLanguages;
import com.kpitracking.i18n.Terms;
import com.kpitracking.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tuỳ chọn cá nhân lưu theo tài khoản (đăng nhập máy khác vẫn giữ, email/thông báo gửi đúng ngôn ngữ).
 * Luồng đồng bộ với localStorage ở frontend: {@code docs/I18N_DESIGN.md} §7.
 */
@Service
@RequiredArgsConstructor
public class UserPreferenceService {

    private final UserRepository userRepository;
    private final AuthService authService;

    @Transactional
    public UserInfoResponse updatePreferences(UpdateUserPreferencesRequest request) {
        String language = request.getLanguage() == null || request.getLanguage().isBlank()
                ? null
                : request.getLanguage().trim();
        if (language != null && !SupportedLanguages.isSupported(language)) {
            throw new BusinessException(ErrorCode.UNSUPPORTED_LANGUAGE,
                    language, String.join(", ", SupportedLanguages.ALL));
        }

        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "email", email));
        user.setPreferredLanguage(language);
        userRepository.save(user);

        // Trả nguyên hồ sơ /auth/me để frontend thay luôn user trong store (có effectiveLanguage mới).
        return authService.getCurrentUser();
    }
}
