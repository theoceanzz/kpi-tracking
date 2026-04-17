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

    boolean existsByEmail(String email);

    boolean existsByPhone(String phone);

    Optional<User> findByResetPasswordToken(String resetPasswordToken);

    Optional<User> findByVerifyEmailToken(String verifyEmailToken);

<<<<<<< HEAD
    long countByCompanyId(UUID companyId);

    List<User> findAllByCompanyId(UUID companyId);

    @Query("SELECT dm.user FROM DepartmentMember dm WHERE dm.department.id = :departmentId AND dm.department.company.id = :companyId")
    Page<User> findByDepartmentId(@Param("companyId") UUID companyId, @Param("departmentId") UUID departmentId, Pageable pageable);

    @Query("SELECT dm.user FROM DepartmentMember dm WHERE dm.department.id = :departmentId AND dm.department.company.id = :companyId " +
           "AND (LOWER(dm.user.fullName) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "OR LOWER(dm.user.email) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<User> searchByDepartmentId(@Param("companyId") UUID companyId, @Param("departmentId") UUID departmentId, @Param("keyword") String keyword, Pageable pageable);
=======
    @Query("SELECT u FROM User u WHERE " +
           "LOWER(u.fullName) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "OR LOWER(u.email) LIKE LOWER(CONCAT('%', :keyword, '%'))")
    Page<User> searchByKeyword(@Param("keyword") String keyword, Pageable pageable);
>>>>>>> 7681c6edbb52597770fb6dc8246115573f68d03b
}
