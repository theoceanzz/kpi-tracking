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

    @Transactional
    public void updateCustomLabel(UUID organizationId, String menuKey, String customLabel) {
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
        
        setting.setCustomLabel(customLabel);
        sidebarSettingRepository.save(setting);
    }
}
