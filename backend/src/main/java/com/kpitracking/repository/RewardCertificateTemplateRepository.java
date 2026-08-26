package com.kpitracking.repository;

import com.kpitracking.entity.RewardCertificateTemplate;
import com.kpitracking.enums.CertificateTemplateStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RewardCertificateTemplateRepository extends JpaRepository<RewardCertificateTemplate, UUID> {

    List<RewardCertificateTemplate> findByOrganizationIdOrderByDisplayOrderAscNameAsc(UUID organizationId);

    List<RewardCertificateTemplate> findByOrganizationIdAndStatusOrderByDisplayOrderAscNameAsc(
            UUID organizationId, CertificateTemplateStatus status);

    Optional<RewardCertificateTemplate> findByIdAndOrganizationId(UUID id, UUID organizationId);

    boolean existsByOrganizationIdAndNameIgnoreCase(UUID organizationId, String name);

    boolean existsByOrganizationIdAndNameIgnoreCaseAndIdNot(UUID organizationId, String name, UUID id);

    /**
     * Hạ cờ mặc định của mọi mẫu khác trước khi dựng cờ cho mẫu mới.
     *
     * <p>Viết thành một câu UPDATE thay vì tải danh sách rồi set từng cái: unique index
     * "mỗi tổ chức một mẫu mặc định" sẽ nổ ngay giữa vòng lặp nếu Hibernate quyết định
     * flush bản ghi mới trước khi hạ hết cờ cũ.
     *
     * <p>KHÔNG đặt {@code clearAutomatically}: câu này chỉ đụng vào những mẫu KHÁC, nên
     * không có gì trong ngữ cảnh persistence bị cũ đi. Xoá ngữ cảnh lại làm mẫu đang sửa
     * rơi khỏi trạng thái managed, và bước dựng phản hồi ngay sau đó sẽ vấp
     * {@code LazyInitializationException} khi đọc tên người tạo.
     */
    @Modifying(flushAutomatically = true)
    @Query("""
            UPDATE RewardCertificateTemplate t SET t.isDefault = false
             WHERE t.organization.id = :orgId AND t.isDefault = true
               AND t.id <> :exceptId
            """)
    void clearDefaultFlag(@Param("orgId") UUID orgId, @Param("exceptId") UUID exceptId);
}
