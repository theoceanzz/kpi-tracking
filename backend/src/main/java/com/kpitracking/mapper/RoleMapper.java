package com.kpitracking.mapper;

import com.kpitracking.dto.response.role.RoleResponse;
import com.kpitracking.entity.Role;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface RoleMapper {

    RoleResponse toResponse(Role role);
}
