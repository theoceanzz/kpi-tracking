package com.kpitracking.mapper;

import com.kpitracking.dto.response.evaluation.EvaluationResponse;
import com.kpitracking.entity.Evaluation;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface EvaluationMapper {

    @Mapping(source = "user.id", target = "userId")
    @Mapping(source = "user.fullName", target = "userName")
    @Mapping(source = "kpiPeriod.id", target = "kpiPeriodId")
    @Mapping(source = "kpiPeriod.name", target = "kpiPeriodName")
    @Mapping(source = "evaluator.id", target = "evaluatorId")
    @Mapping(source = "evaluator.fullName", target = "evaluatorName")
    @Mapping(source = "orgUnit.id", target = "orgUnitId")
    @Mapping(source = "orgUnit.name", target = "orgUnitName")
    EvaluationResponse toResponse(Evaluation evaluation);
}
