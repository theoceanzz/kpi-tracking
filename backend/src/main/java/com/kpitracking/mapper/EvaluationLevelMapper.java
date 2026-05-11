package com.kpitracking.mapper;

import com.kpitracking.dto.request.organization.EvaluationLevelRequest;
import com.kpitracking.dto.response.organization.EvaluationLevelResponse;
import com.kpitracking.entity.EvaluationLevel;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface EvaluationLevelMapper {
    EvaluationLevelResponse toResponse(EvaluationLevel level);
    EvaluationLevel toEntity(EvaluationLevelRequest request);
}
