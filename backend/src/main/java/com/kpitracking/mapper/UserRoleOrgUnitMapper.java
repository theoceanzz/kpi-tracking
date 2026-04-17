package com.kpitracking.mapper;

import com.kpitracking.dto.response.userrole.UserRoleOrgUnitResponse;
import com.kpitracking.entity.UserRoleOrgUnit;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring")
public interface UserRoleOrgUnitMapper {

    @Mapping(source = "user.id", target = "userId")
    @Mapping(source = "user.fullName", target = "userFullName")
    @Mapping(source = "user.email", target = "userEmail")
    @Mapping(source = "role.id", target = "roleId")
    @Mapping(source = "role.name", target = "roleName")
    @Mapping(source = "orgUnit.id", target = "orgUnitId")
    @Mapping(source = "orgUnit.name", target = "orgUnitName")
    @Mapping(source = "assignedBy.id", target = "assignedById")
    @Mapping(source = "assignedBy.fullName", target = "assignedByName")
    UserRoleOrgUnitResponse toResponse(UserRoleOrgUnit entity);

    List<UserRoleOrgUnitResponse> toResponseList(List<UserRoleOrgUnit> entities);
}
