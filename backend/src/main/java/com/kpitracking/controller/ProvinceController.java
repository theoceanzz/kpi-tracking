package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.district.DistrictResponse;
import com.kpitracking.dto.response.province.ProvinceResponse;
import com.kpitracking.service.ProvinceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/provinces")
@RequiredArgsConstructor
@Tag(name = "Provinces", description = "Province & District lookup (public)")
public class ProvinceController {

    private final ProvinceService provinceService;

    @GetMapping
    @Operation(summary = "List all provinces")
    public ResponseEntity<ApiResponse<List<ProvinceResponse>>> getAllProvinces() {
        return ResponseEntity.ok(ApiResponse.success(provinceService.getAllProvinces()));
    }

    @GetMapping("/{provinceId}/districts")
    @Operation(summary = "List districts by province")
    public ResponseEntity<ApiResponse<List<DistrictResponse>>> getDistricts(@PathVariable UUID provinceId) {
        return ResponseEntity.ok(ApiResponse.success(provinceService.getDistrictsByProvince(provinceId)));
    }
}
