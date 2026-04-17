package com.kpitracking.mapper;

import com.kpitracking.dto.response.policy.PolicyConditionResponse;
import com.kpitracking.dto.response.policy.PolicyResponse;
import com.kpitracking.entity.Policy;
import com.kpitracking.entity.PolicyCondition;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring")
public interface PolicyMapper {

    @Mapping(source = "orgUnit.id", target = "orgUnitId")
    @Mapping(source = "orgUnit.name", target = "orgUnitName")
    @Mapping(source = "conditions", target = "conditions")
    PolicyResponse toResponse(Policy policy);

    PolicyConditionResponse toConditionResponse(PolicyCondition condition);

    List<PolicyConditionResponse> toConditionResponseList(List<PolicyCondition> conditions);
}
