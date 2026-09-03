package com.kpitracking.repository;

import com.kpitracking.entity.Organization;
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

    /**
     * Tìm tổ chức theo số tài khoản nhận tiền, dùng để quy một webhook SePay về
     * đúng tổ chức khi giao dịch chưa gắn với đơn nạp nào.
     *
     * <p>Trả về danh sách chứ không phải {@code Optional}: hai tổ chức khai trùng
     * số tài khoản là cấu hình sai nhưng không có gì trong hệ thống chặn được, và
     * khi đó phải để phía gọi coi như KHÔNG xác định được thay vì chọn bừa một
     * tổ chức rồi ghi có nhầm chỗ.
     *
     * <p>So sau khi bỏ ký tự không phải chữ/số, khớp đúng
     * {@code SepayAccountMatch.normalize} — {@code :account} phải là chuỗi đã
     * chuẩn hoá sẵn.
     */
    @Query(value = """
            SELECT * FROM organizations o
             WHERE o.sepay_account_number IS NOT NULL
               AND regexp_replace(UPPER(o.sepay_account_number), '[^A-Z0-9]', '', 'g') = :account
            """, nativeQuery = true)
    List<Organization> findBySepayAccountNumber(@Param("account") String account);
}
