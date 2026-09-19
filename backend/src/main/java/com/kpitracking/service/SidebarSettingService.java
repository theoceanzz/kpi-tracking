package com.kpitracking.service;

import com.kpitracking.entity.Organization;
import com.kpitracking.entity.SidebarSetting;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.SidebarSettingRepository;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.security.PermissionChecker;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SidebarSettingService {

    private final SidebarSettingRepository sidebarSettingRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final PermissionChecker permissionChecker;

    /**
     * organizationId đến từ đường dẫn do client gửi, nên phải đối chiếu với tổ chức của người
     * gọi: đọc thì cần là thành viên, ghi thì cần ORG:UPDATE (hoặc SYSTEM:ADMIN) ở đúng tổ chức đó.
     */
    private UUID requireMember(UUID organizationId) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        UUID userId = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email))
                .getId();
        if (!permissionChecker.isMemberOfOrganization(userId, organizationId)) {
            throw new ForbiddenException("Bạn không thuộc tổ chức này");
        }
        return userId;
    }

    private void requireCanEdit(UUID organizationId) {
        UUID userId = requireMember(organizationId);
        if (!permissionChecker.hasPermissionInOrganization(userId, "COMPANY:UPDATE", organizationId)) {
            throw new ForbiddenException("Bạn không có quyền đổi tên mục điều hướng của tổ chức");
        }
    }

    @Transactional(readOnly = true)
    public Map<String, String> getCustomLabels(UUID organizationId) {
        requireMember(organizationId);
        return sidebarSettingRepository.findByOrganizationId(organizationId)
                .stream()
                .collect(Collectors.toMap(SidebarSetting::getMenuKey, SidebarSetting::getCustomLabel));
    }

    /**
     * Đặt nhãn tuỳ chỉnh cho một mục điều hướng. Nhãn RỖNG nghĩa là "về tên mặc định" nên
     * XOÁ hẳn bản ghi, không lưu chuỗi rỗng: để lại bản ghi rỗng thì bảng đầy rác, và
     * `getCustomLabels` vẫn trả về khoá đó khiến phía client tưởng mục đang được đổi tên.
     */
    @Transactional
    public void updateCustomLabel(UUID organizationId, String menuKey, String customLabel) {
        requireCanEdit(organizationId);
        if (customLabel == null || customLabel.isBlank()) {
            sidebarSettingRepository.findByOrganizationIdAndMenuKey(organizationId, menuKey)
                    .ifPresent(sidebarSettingRepository::delete);
            return;
        }

        SidebarSetting setting = sidebarSettingRepository
                .findByOrganizationIdAndMenuKey(organizationId, menuKey)
                .orElseGet(() -> {
                    Organization org = organizationRepository.findById(organizationId)
                            .orElseThrow(() -> new ResourceNotFoundException("Organization", "id", organizationId));
                    return SidebarSetting.builder()
                            .organization(org)
                            .menuKey(menuKey)
                            .build();
                });

        setting.setCustomLabel(customLabel.trim());
        sidebarSettingRepository.save(setting);
    }
}
