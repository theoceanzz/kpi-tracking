package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.organization.PublicOrganizationResponse;
import com.kpitracking.entity.Organization;
import com.kpitracking.repository.OrganizationRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Dữ liệu công khai phục vụ màn hình đăng nhập, không cần token.
 */
@RestController
@RequestMapping("/api/v1/public/organizations")
@RequiredArgsConstructor
@Tag(name = "Public", description = "Dữ liệu công khai cho màn hình đăng nhập")
public class PublicOrganizationController {

    private static final int MAX_PAGE_SIZE = 50;

    private final OrganizationRepository organizationRepository;

    @GetMapping
    @Operation(summary = "Danh sách công ty đã bật đăng nhập bằng Lark")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<PageResponse<PublicOrganizationResponse>>> search(
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        Page<Organization> result = organizationRepository.searchLarkEnabled(
                keyword, PageRequest.of(Math.max(page, 0), Math.min(size, MAX_PAGE_SIZE),
                        Sort.by("name").ascending()));

        return ResponseEntity.ok(ApiResponse.success(PageResponse.<PublicOrganizationResponse>builder()
                .content(result.getContent().stream()
                        .map(org -> PublicOrganizationResponse.builder()
                                .id(org.getId())
                                // Tên Lark là tên nhân viên quen thuộc; tên trong KeyGo làm dự phòng
                                .name(org.getLarkTenantName() != null && !org.getLarkTenantName().isBlank()
                                        ? org.getLarkTenantName()
                                        : org.getName())
                                .code(org.getCode())
                                .avatarUrl(org.getLarkTenantAvatarUrl())
                                .build())
                        .toList())
                .page(result.getNumber())
                .size(result.getSize())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .last(result.isLast())
                .build()));
    }
}
