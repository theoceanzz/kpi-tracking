package com.kpitracking.service;

import com.kpitracking.entity.Organization;
import com.kpitracking.entity.SidebarSetting;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.SidebarSettingRepository;
import com.kpitracking.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
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

    @Transactional(readOnly = true)
    public Map<String, String> getCustomLabels(UUID organizationId) {
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
