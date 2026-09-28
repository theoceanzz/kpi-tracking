package com.kpitracking.i18n;

import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Ngôn ngữ thực dùng của một người: tự chọn → mặc định của tổ chức → tiếng Việt.
 *
 * <p>Đây là chỗ DUY NHẤT tính quy tắc này. Code chạy nền (email, thông báo, xuất file) gọi
 * {@link #effectiveLocale(User)} cho người NHẬN, không dùng ngôn ngữ của request đang chạy.
 */
@Component
@RequiredArgsConstructor
public class UserLanguageResolver {

    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;

    @Transactional(readOnly = true)
    public String effectiveLanguage(User user) {
        return effectiveLanguage(user.getPreferredLanguage(), userRoleOrgUnitRepository.findByUserId(user.getId()));
    }

    @Transactional(readOnly = true)
    public Locale effectiveLocale(User user) {
        return Locale.forLanguageTag(effectiveLanguage(user));
    }

    /**
     * Bản dùng khi đã có sẵn danh sách phân công (tránh query lại). Một người chỉ thuộc một tổ chức;
     * nếu dữ liệu lệch thì lấy tổ chức đầu tiên có cấu hình hợp lệ.
     */
    public String effectiveLanguage(String preferredLanguage, List<UserRoleOrgUnit> assignments) {
        if (SupportedLanguages.isSupported(preferredLanguage)) {
            return preferredLanguage;
        }
        return assignments.stream()
                .map(uro -> uro.getOrgUnit().getOrgHierarchyLevel().getOrganization())
                .filter(Objects::nonNull)
                .map(org -> org.getDefaultLanguage())
                .filter(SupportedLanguages::isSupported)
                .findFirst()
                .orElse(SupportedLanguages.DEFAULT);
    }
}
