package com.kpitracking.mapper;

import com.kpitracking.dto.response.evaluation.EvaluationResponse;
import com.kpitracking.entity.Evaluation;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

// uses = SoftDeletedRefs: xem SubmissionMapper.
@Mapper(componentModel = "spring", uses = SoftDeletedRefs.class)
public interface EvaluationMapper {

    @Mapping(source = "user", target = "userId", qualifiedByName = "userId")
    @Mapping(source = "user", target = "userName", qualifiedByName = "userName")
    @Mapping(target = "userAvatarUrl", expression = "java(com.kpitracking.mapper.SoftDeletedRefs.orNull(() -> evaluation.getUser() == null ? null : evaluation.getUser().getAvatarUrl()))")
    @Mapping(source = "kpiPeriod", target = "kpiPeriodId", qualifiedByName = "periodId")
    @Mapping(source = "kpiPeriod", target = "kpiPeriodName", qualifiedByName = "periodName")
    @Mapping(source = "evaluator.id", target = "evaluatorId")
    @Mapping(source = "evaluator", target = "evaluatorName", qualifiedByName = "userName")
    @Mapping(source = "orgUnit.id", target = "orgUnitId")
    @Mapping(source = "orgUnit.name", target = "orgUnitName")
    EvaluationResponse toResponse(Evaluation evaluation);
}
