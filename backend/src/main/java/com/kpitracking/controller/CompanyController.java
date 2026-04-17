package com.kpitracking.controller;

import com.kpitracking.dto.request.company.UpdateCompanyRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.company.CompanyResponse;
import com.kpitracking.service.CompanyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/company")
@RequiredArgsConstructor
@Tag(name = "Company", description = "Company management endpoints")
public class CompanyController {

    private final CompanyService companyService;

    @GetMapping
    @Operation(summary = "Get current company info")
    public ResponseEntity<ApiResponse<CompanyResponse>> getMyCompany() {
        CompanyResponse response = companyService.getMyCompany();
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping
    @PreAuthorize("hasRole('DIRECTOR')")
    @Operation(summary = "Update company info (Director only)")
    public ResponseEntity<ApiResponse<CompanyResponse>> updateCompany(@Valid @RequestBody UpdateCompanyRequest request) {
        CompanyResponse response = companyService.updateCompany(request);
        return ResponseEntity.ok(ApiResponse.success("Company updated successfully", response));
    }

    @PostMapping(value = "/logo", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('DIRECTOR')")
    @Operation(summary = "Upload company logo (Director only)")
    public ResponseEntity<ApiResponse<CompanyResponse>> uploadLogo(@RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        CompanyResponse response = companyService.uploadLogo(file);
        return ResponseEntity.ok(ApiResponse.success("Company logo uploaded successfully", response));
    }
}
