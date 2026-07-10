package com.kpitracking.mapper;

import com.kpitracking.dto.request.organization.QualitativeLevelRequest;
import com.kpitracking.dto.response.organization.QualitativeLevelResponse;
import com.kpitracking.entity.QualitativeLevel;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface QualitativeLevelMapper {
    QualitativeLevelResponse toResponse(QualitativeLevel level);
    QualitativeLevel toEntity(QualitativeLevelRequest request);
}
