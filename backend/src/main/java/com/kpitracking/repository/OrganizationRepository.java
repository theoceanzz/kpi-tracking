package com.kpitracking.repository;

import com.kpitracking.entity.Organization;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrganizationRepository extends JpaRepository<Organization, UUID> {

    Optional<Organization> findByCode(String code);
    boolean existsByCode(String code);
    boolean existsByName(String name);

    /** Một tổ chức Lark chỉ được gắn với một công ty — dùng để chặn liên kết trùng. */
    Optional<Organization> findByLarkTenantKeyHash(String larkTenantKeyHash);

    /**
     * Danh sách công ty đã kết nối Lark, phục vụ màn chọn công ty công khai.
     * Chỉ trả công ty đang hoạt động và đã xác minh tenant.
     */
    @Query("SELECT o FROM Organization o " +
           "WHERE o.larkEnabled = true " +
           "AND o.larkTenantKeyHash IS NOT NULL " +
           "AND o.status = com.kpitracking.enums.OrganizationStatus.ACTIVE " +
           // Phải tìm được cả theo tên Lark, vì đó mới là tên hiển thị trên màn chọn công ty
           "AND (:keyword IS NULL OR :keyword = '' " +
           "     OR LOWER(CAST(o.name AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')) " +
           "     OR LOWER(CAST(o.code AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')) " +
           "     OR LOWER(CAST(o.larkTenantName AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')))")
    Page<Organization> searchLarkEnabled(@Param("keyword") String keyword, Pageable pageable);
}
