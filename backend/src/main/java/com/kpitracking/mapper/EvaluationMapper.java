package com.kpitracking.mapper;

import com.kpitracking.dto.response.evaluation.EvaluationResponse;
import com.kpitracking.entity.Evaluation;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface EvaluationMapper {

    @Mapping(source = "user.id", target = "userId")
    @Mapping(source = "user.fullName", target = "userName")
    @Mapping(source = "kpiCriteria.id", target = "kpiCriteriaId")
    @Mapping(source = "kpiCriteria.name", target = "kpiCriteriaName")
    @Mapping(source = "evaluator.id", target = "evaluatorId")
    @Mapping(source = "evaluator.fullName", target = "evaluatorName")
    EvaluationResponse toResponse(Evaluation evaluation);
}
