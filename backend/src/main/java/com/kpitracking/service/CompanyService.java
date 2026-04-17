package com.kpitracking.service;

import com.kpitracking.dto.request.company.UpdateCompanyRequest;
import com.kpitracking.dto.response.company.CompanyResponse;
import com.kpitracking.entity.Company;
import com.kpitracking.entity.District;
import com.kpitracking.entity.Province;
import com.kpitracking.entity.User;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.CompanyMapper;
import com.kpitracking.repository.CompanyRepository;
import com.kpitracking.repository.DistrictRepository;
import com.kpitracking.repository.ProvinceRepository;
import com.kpitracking.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CompanyService {

    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final ProvinceRepository provinceRepository;
    private final DistrictRepository districtRepository;
    private final CompanyMapper companyMapper;
    private final CloudinaryStorageService cloudinaryStorageService;

    private UUID getCurrentCompanyId() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
        return user.getCompany().getId();
    }

    @Transactional(readOnly = true)
    public CompanyResponse getMyCompany() {
        UUID companyId = getCurrentCompanyId();
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Company", "id", companyId));
        return companyMapper.toResponse(company);
    }

    @Transactional
    public CompanyResponse updateCompany(UpdateCompanyRequest request) {
        UUID companyId = getCurrentCompanyId();
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Company", "id", companyId));

        if (request.getName() != null) {
            company.setName(request.getName());
        }
        if (request.getTaxCode() != null) {
            company.setTaxCode(request.getTaxCode());
        }
        if (request.getEmail() != null) {
            company.setEmail(request.getEmail());
        }
        if (request.getPhone() != null) {
            company.setPhone(request.getPhone());
        }
        if (request.getAddress() != null) {
            company.setAddress(request.getAddress());
        }
        if (request.getProvinceId() != null) {
            Province province = provinceRepository.findById(request.getProvinceId())
                    .orElseThrow(() -> new ResourceNotFoundException("Province", "id", request.getProvinceId()));
            company.setProvince(province);
        }
        if (request.getDistrictId() != null) {
            District district = districtRepository.findById(request.getDistrictId())
                    .orElseThrow(() -> new ResourceNotFoundException("District", "id", request.getDistrictId()));
            company.setDistrict(district);
        }

        company = companyRepository.save(company);

        return companyMapper.toResponse(company);

    }

    @Transactional
    public CompanyResponse uploadLogo(org.springframework.web.multipart.MultipartFile file) {
        UUID companyId = getCurrentCompanyId();
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Company", "id", companyId));

        try {
            String logoUrl = cloudinaryStorageService.uploadFile(file, "company_logos");
            company.setLogoUrl(logoUrl);
            company = companyRepository.save(company);
            return companyMapper.toResponse(company);
        } catch (java.io.IOException e) {
            throw new com.kpitracking.exception.BusinessException("Failed to upload company logo: " + e.getMessage());
        }
    }
}
