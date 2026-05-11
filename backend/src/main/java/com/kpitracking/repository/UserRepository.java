package com.kpitracking.repository;

import com.kpitracking.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    boolean existsByEmailAndDeletedAtIsNull(String email);

    Optional<User> findByEmployeeCode(String employeeCode);
    
    boolean existsByEmployeeCodeAndDeletedAtIsNull(String employeeCode);

    boolean existsByEmployeeCodeAndIdNotAndDeletedAtIsNull(String employeeCode, UUID id);

    boolean existsByPhoneAndDeletedAtIsNull(String phone);

    Optional<User> findByResetPasswordToken(String resetPasswordToken);

    Optional<User> findByVerifyEmailToken(String verifyEmailToken);

    @Query("SELECT DISTINCT u FROM User u " +
           "LEFT JOIN UserRoleOrgUnit uro ON u.id = uro.user.id " +
           "LEFT JOIN uro.role r " +
           "WHERE (:organizationId IS NULL OR uro.orgUnit.orgHierarchyLevel.organization.id = :organizationId) " +
           "AND (:isGlobalAdmin = true OR EXISTS (SELECT 1 FROM UserRoleOrgUnit uro2 JOIN uro2.orgUnit ou WHERE uro2.user.id = u.id AND EXISTS (SELECT 1 FROM OrgUnit p WHERE ou.path LIKE CONCAT(p.path, '%') AND p.id IN :allowedOrgUnitIds))) " +
           "AND (:keyword IS NULL OR :keyword = '' OR LOWER(CAST(u.fullName AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')) " +
           "OR LOWER(CAST(u.email AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%'))) " +
           "AND (:roleName IS NULL OR r.name = :roleName) " +
           "AND (:orgUnitPath IS NULL OR uro.orgUnit.path LIKE :orgUnitPath) " +
           "AND (u.deletedAt IS NULL) " +
           "AND (:excludeSelf = false OR u.id != :currentUserId) " +
           "AND (:excludeAdmin = false OR u.id = :currentUserId OR NOT EXISTS (SELECT 1 FROM RolePermission rp3 JOIN UserRoleOrgUnit uro3 ON rp3.role.id = uro3.role.id WHERE uro3.user.id = u.id AND rp3.permission.code = 'SYSTEM:ADMIN')) " +
           "AND (:excludeManager = false OR u.id = :currentUserId OR NOT EXISTS (SELECT 1 FROM RolePermission rp4 JOIN UserRoleOrgUnit uro4 ON rp4.role.id = uro4.role.id WHERE uro4.user.id = u.id AND rp4.permission.code = 'KPI:APPROVE')) " +
           "AND (:currentUserRank IS NULL OR :currentUserRank = 0 OR r.rank > :currentUserRank OR u.id = :currentUserId)")
    Page<User> searchUsers(
            @Param("isGlobalAdmin") boolean isGlobalAdmin,
            @Param("organizationId") UUID organizationId,
            @Param("allowedOrgUnitIds") java.util.Collection<UUID> allowedOrgUnitIds,
            @Param("keyword") String keyword, 
            @Param("roleName") String roleName, 
            @Param("orgUnitPath") String orgUnitPath,
            @Param("currentUserId") UUID currentUserId,
            @Param("currentUserRank") Integer currentUserRank,
            @Param("excludeSelf") boolean excludeSelf,
            @Param("excludeAdmin") boolean excludeAdmin,
            @Param("excludeManager") boolean excludeManager,
            Pageable pageable
    );
}
