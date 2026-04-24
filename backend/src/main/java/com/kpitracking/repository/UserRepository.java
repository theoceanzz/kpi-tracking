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

    Optional<User> findByEmployeeCode(String employeeCode);

    boolean existsByPhone(String phone);

    Optional<User> findByResetPasswordToken(String resetPasswordToken);

    Optional<User> findByVerifyEmailToken(String verifyEmailToken);

    @Query("SELECT DISTINCT u FROM User u " +
           "LEFT JOIN UserRoleOrgUnit uro ON u.id = uro.user.id " +
           "LEFT JOIN uro.role r " +
           "WHERE (:keyword IS NULL OR :keyword = '' OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "OR LOWER(u.email) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
           "AND (:roleName IS NULL OR r.name = :roleName) " +
           "AND (u.deletedAt IS NULL) " +
           "AND NOT EXISTS (SELECT 1 FROM UserRoleOrgUnit uro2 WHERE uro2.user.id = u.id AND uro2.role.name = 'DIRECTOR')")
    Page<User> searchUsers(@Param("keyword") String keyword, @Param("roleName") String roleName, Pageable pageable);
}
