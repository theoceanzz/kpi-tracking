package com.kpitracking.service;

import com.kpitracking.dto.response.district.DistrictResponse;
import com.kpitracking.dto.response.province.ProvinceResponse;
import com.kpitracking.repository.DistrictRepository;
import com.kpitracking.repository.ProvinceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProvinceService {

    private final ProvinceRepository provinceRepository;
    private final DistrictRepository districtRepository;

    @Transactional(readOnly = true)
    public List<ProvinceResponse> getAllProvinces() {
        return provinceRepository.findAll().stream()
                .map(province -> ProvinceResponse.builder()
                        .id(province.getId())
                        .name(province.getName())
                        .code(province.getCode())
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public List<DistrictResponse> getDistrictsByProvince(UUID provinceId) {
        return districtRepository.findByProvinceId(provinceId).stream()
                .map(district -> DistrictResponse.builder()
                        .id(district.getId())
                        .name(district.getName())
                        .code(district.getCode())
                        .provinceId(district.getProvince().getId())
                        .build())
                .toList();
    }
}
