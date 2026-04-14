package com.kpitracking.repository;

import com.kpitracking.entity.User;
import com.kpitracking.enums.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    boolean existsByPhone(String phone);

    Optional<User> findByIdAndCompanyId(UUID id, UUID companyId);

    Page<User> findByCompanyId(UUID companyId, Pageable pageable);

    @Query("SELECT u FROM User u WHERE u.company.id = :companyId AND u.role = :role")
    Page<User> findByCompanyIdAndRole(@Param("companyId") UUID companyId,
                                      @Param("role") UserRole role,
                                      Pageable pageable);

    @Query("SELECT u FROM User u WHERE u.company.id = :companyId " +
           "AND (LOWER(u.fullName) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "OR LOWER(u.email) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<User> searchByCompanyId(@Param("companyId") UUID companyId,
                                 @Param("keyword") String keyword,
                                 Pageable pageable);

    Optional<User> findByResetPasswordToken(String resetPasswordToken);

    Optional<User> findByVerifyEmailToken(String verifyEmailToken);

    long countByCompanyId(UUID companyId);

    List<User> findAllByCompanyId(UUID companyId);
}
