package com.kpitracking.service;

import com.kpitracking.dto.request.department.AddMemberRequest;
import com.kpitracking.dto.request.department.CreateDepartmentRequest;
import com.kpitracking.dto.request.department.UpdateDepartmentRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.department.DepartmentMemberResponse;
import com.kpitracking.dto.response.department.DepartmentResponse;
import com.kpitracking.entity.Company;
import com.kpitracking.entity.Department;
import com.kpitracking.entity.DepartmentMember;
import com.kpitracking.entity.User;
import com.kpitracking.exception.DuplicateResourceException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.DepartmentMapper;
import com.kpitracking.repository.CompanyRepository;
import com.kpitracking.repository.DepartmentMemberRepository;
import com.kpitracking.repository.DepartmentRepository;
import com.kpitracking.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DepartmentService {

    private final DepartmentRepository departmentRepository;
    private final DepartmentMemberRepository departmentMemberRepository;
    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final DepartmentMapper departmentMapper;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    private UUID getCurrentCompanyId() {
        return getCurrentUser().getCompany().getId();
    }

    private void validateDepartmentManager(Department department, User currentUser) {
        if (currentUser.getRole() == com.kpitracking.enums.UserRole.DIRECTOR) {
            return;
        }
        if (department.getHead() == null || !department.getHead().getId().equals(currentUser.getId())) {
            throw new com.kpitracking.exception.ForbiddenException("Only DIRECTOR or Department HEAD can manage members");
        }
    }

    @Transactional
    public DepartmentResponse createDepartment(CreateDepartmentRequest request) {
        UUID companyId = getCurrentCompanyId();

        if (departmentRepository.existsByNameAndCompanyId(request.getName(), companyId)) {
            throw new DuplicateResourceException("Department", "name", request.getName());
        }

        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Company", "id", companyId));

        Department department = Department.builder()
                .company(company)
                .name(request.getName())
                .description(request.getDescription())
                .build();

        if (request.getHeadId() != null) {
            User head = userRepository.findByIdAndCompanyId(request.getHeadId(), companyId)
                    .orElseThrow(() -> new ResourceNotFoundException("User (head)", "id", request.getHeadId()));
            department.setHead(head);
        }
        if (request.getDeputyId() != null) {
            User deputy = userRepository.findByIdAndCompanyId(request.getDeputyId(), companyId)
                    .orElseThrow(() -> new ResourceNotFoundException("User (deputy)", "id", request.getDeputyId()));
            department.setDeputy(deputy);
        }

        department = departmentRepository.save(department);
        return departmentMapper.toResponse(department);
    }

    @Transactional(readOnly = true)
    public PageResponse<DepartmentResponse> getDepartments(int page, int size) {
        UUID companyId = getCurrentCompanyId();
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<Department> deptPage = departmentRepository.findByCompanyId(companyId, pageable);

        return PageResponse.<DepartmentResponse>builder()
                .content(deptPage.getContent().stream().map(departmentMapper::toResponse).toList())
                .page(deptPage.getNumber())
                .size(deptPage.getSize())
                .totalElements(deptPage.getTotalElements())
                .totalPages(deptPage.getTotalPages())
                .last(deptPage.isLast())
                .build();
    }

    @Transactional(readOnly = true)
    public DepartmentResponse getDepartmentById(UUID departmentId) {
        UUID companyId = getCurrentCompanyId();
        Department department = departmentRepository.findByIdAndCompanyId(departmentId, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Department", "id", departmentId));
        return departmentMapper.toResponse(department);
    }

    @Transactional
    public DepartmentResponse updateDepartment(UUID departmentId, UpdateDepartmentRequest request) {
        UUID companyId = getCurrentCompanyId();
        Department department = departmentRepository.findByIdAndCompanyId(departmentId, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Department", "id", departmentId));

        if (request.getName() != null) {
            department.setName(request.getName());
        }
        if (request.getDescription() != null) {
            department.setDescription(request.getDescription());
        }
        if (request.getHeadId() != null) {
            User head = userRepository.findByIdAndCompanyId(request.getHeadId(), companyId)
                    .orElseThrow(() -> new ResourceNotFoundException("User (head)", "id", request.getHeadId()));
            department.setHead(head);
        }
        if (request.getDeputyId() != null) {
            User deputy = userRepository.findByIdAndCompanyId(request.getDeputyId(), companyId)
                    .orElseThrow(() -> new ResourceNotFoundException("User (deputy)", "id", request.getDeputyId()));
            department.setDeputy(deputy);
        }

        department = departmentRepository.save(department);
        return departmentMapper.toResponse(department);
    }

    @Transactional
    public void deleteDepartment(UUID departmentId) {
        UUID companyId = getCurrentCompanyId();
        Department department = departmentRepository.findByIdAndCompanyId(departmentId, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Department", "id", departmentId));
        department.setDeletedAt(Instant.now());
        departmentRepository.save(department);
    }

    @Transactional
    public DepartmentMemberResponse addMember(UUID departmentId, AddMemberRequest request) {
        User currentUser = getCurrentUser();
        UUID companyId = currentUser.getCompany().getId();

        Department department = departmentRepository.findByIdAndCompanyId(departmentId, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Department", "id", departmentId));

        validateDepartmentManager(department, currentUser);

        User user = userRepository.findByIdAndCompanyId(request.getUserId(), companyId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", request.getUserId()));

        if (departmentMemberRepository.existsByDepartmentIdAndUserId(departmentId, request.getUserId())) {
            throw new DuplicateResourceException("Member already exists in this department");
        }

        DepartmentMember member = DepartmentMember.builder()
                .department(department)
                .user(user)
                .position(request.getPosition())
                .build();

        member = departmentMemberRepository.save(member);
        return departmentMapper.toMemberResponse(member);
    }

    @Transactional
    public void removeMember(UUID departmentId, UUID userId) {
        User currentUser = getCurrentUser();
        UUID companyId = currentUser.getCompany().getId();
        Department department = departmentRepository.findByIdAndCompanyId(departmentId, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Department", "id", departmentId));

        validateDepartmentManager(department, currentUser);

        DepartmentMember member = departmentMemberRepository.findByDepartmentIdAndUserId(departmentId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Department member not found"));
        departmentMemberRepository.delete(member);
    }

    @Transactional(readOnly = true)
    public List<DepartmentMemberResponse> getMembers(UUID departmentId) {
        UUID companyId = getCurrentCompanyId();
        departmentRepository.findByIdAndCompanyId(departmentId, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Department", "id", departmentId));

        List<DepartmentMember> members = departmentMemberRepository.findByDepartmentId(departmentId);
        return departmentMapper.toMemberResponseList(members);
    }
}
