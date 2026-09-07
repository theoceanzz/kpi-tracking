package com.kpitracking.mapper;

import com.kpitracking.dto.response.organization.OrganizationResponse;
import com.kpitracking.entity.Organization;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring", uses = {OrgHierarchyLevelMapper.class, EvaluationLevelMapper.class, QualitativeLevelMapper.class})
public interface OrganizationMapper {

    @Mapping(target = "enableAi", source = "enableAi")
    @Mapping(target = "enableOkr", source = "enableOkr")
    @Mapping(target = "enableWaterfall", source = "enableWaterfall")
    @Mapping(target = "enableQualitative", source = "enableQualitative")
    @Mapping(target = "enableBsc", source = "enableBsc")
    @Mapping(target = "enableConduct", source = "enableConduct")
    // Thang điểm hạnh kiểm KHÔNG còn ở cấp tổ chức: mỗi bộ tiêu chí giữ thang riêng, lấy
    // qua /conduct/config. Trả kèm ở đây chỉ tạo ra một con số thứ hai để hiểu nhầm.
    @Mapping(target = "enableReward", source = "enableReward")
    @Mapping(target = "enableCashWallet", source = "enableCashWallet")
    @Mapping(target = "pointExchangeRate", source = "pointExchangeRate")
    @Mapping(target = "performanceMatrix", source = "performanceMatrix")
    @Mapping(target = "unitClassificationRules", source = "unitClassificationRules")
    OrganizationResponse toResponse(Organization organization);
}
