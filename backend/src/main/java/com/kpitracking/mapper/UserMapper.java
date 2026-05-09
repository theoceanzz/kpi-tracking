package com.kpitracking.mapper;

import com.kpitracking.dto.response.auth.UserInfoResponse;
import com.kpitracking.entity.User;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface UserMapper {

    @Mapping(target = "hasSeenOnboarding", source = "hasSeenOnboarding")
    UserInfoResponse toUserInfoResponse(User user);
}
