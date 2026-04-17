package com.kpitracking.mapper;

import com.kpitracking.dto.response.auth.UserInfoResponse;
import com.kpitracking.entity.User;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface UserMapper {

    UserInfoResponse toUserInfoResponse(User user);
}
