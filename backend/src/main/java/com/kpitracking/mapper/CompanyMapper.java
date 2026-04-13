package com.kpitracking.mapper;

import com.kpitracking.dto.response.company.CompanyResponse;
import com.kpitracking.entity.Company;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface CompanyMapper {

    @Mapping(source = "province.id", target = "provinceId")
    @Mapping(source = "province.name", target = "provinceName")
    @Mapping(source = "district.id", target = "districtId")
    @Mapping(source = "district.name", target = "districtName")
    CompanyResponse toResponse(Company company);
}
