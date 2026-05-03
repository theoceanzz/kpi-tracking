package com.kpitracking.mapper;

import com.kpitracking.dto.response.role.RoleResponse;
import com.kpitracking.entity.Role;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface RoleMapper {

    @Mapping(source = "parentRole.id", target = "parentRoleId")
    @Mapping(source = "parentRole.name", target = "parentRoleName")
    @Mapping(source = "level", target = "level")
    RoleResponse toResponse(Role role);
}
