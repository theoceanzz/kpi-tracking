package com.kpitracking.mapper;

import com.kpitracking.dto.response.department.DepartmentMemberResponse;
import com.kpitracking.dto.response.department.DepartmentResponse;
import com.kpitracking.entity.Department;
import com.kpitracking.entity.DepartmentMember;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring")
public interface DepartmentMapper {

    @Mapping(source = "head.id", target = "headId")
    @Mapping(source = "head.fullName", target = "headName")
    @Mapping(source = "deputy.id", target = "deputyId")
    @Mapping(source = "deputy.fullName", target = "deputyName")
    @Mapping(target = "memberCount", expression = "java(department.getMembers() != null ? department.getMembers().size() : 0)")
    @Mapping(source = "members", target = "members")
    DepartmentResponse toResponse(Department department);

    @Mapping(source = "user.id", target = "userId")
    @Mapping(source = "user.fullName", target = "userFullName")
    @Mapping(source = "user.email", target = "userEmail")
    DepartmentMemberResponse toMemberResponse(DepartmentMember member);

    List<DepartmentMemberResponse> toMemberResponseList(List<DepartmentMember> members);
}
