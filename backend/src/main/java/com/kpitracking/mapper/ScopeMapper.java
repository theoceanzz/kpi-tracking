package com.kpitracking.mapper;

import com.kpitracking.dto.response.scope.ScopeResponse;
import com.kpitracking.entity.Scope;
import org.mapstruct.Mapper;

import java.util.List;

@Mapper(componentModel = "spring")
public interface ScopeMapper {

    ScopeResponse toResponse(Scope scope);

    List<ScopeResponse> toResponseList(List<Scope> scopes);
}
