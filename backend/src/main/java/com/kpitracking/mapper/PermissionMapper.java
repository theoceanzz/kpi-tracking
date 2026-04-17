package com.kpitracking.mapper;

import com.kpitracking.dto.response.permission.PermissionResponse;
import com.kpitracking.entity.Permission;
import org.mapstruct.Mapper;

import java.util.List;

@Mapper(componentModel = "spring")
public interface PermissionMapper {

    PermissionResponse toResponse(Permission permission);

    List<PermissionResponse> toResponseList(List<Permission> permissions);
}
