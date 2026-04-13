package com.kpitracking.mapper;

import com.kpitracking.dto.response.auth.UserInfoResponse;
import com.kpitracking.dto.response.user.UserResponse;
import com.kpitracking.entity.User;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface UserMapper {

    @Mapping(source = "company.id", target = "companyId")
    UserResponse toResponse(User user);

    @Mapping(source = "company.id", target = "companyId")
    @Mapping(source = "company.name", target = "companyName")
    UserInfoResponse toUserInfoResponse(User user);
}
