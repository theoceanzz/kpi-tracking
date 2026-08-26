package com.kpitracking.entity;

import com.kpitracking.enums.BscFixedPerspective;
import com.kpitracking.enums.BscPerspectiveStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Một HẠNG MỤC BSC (nhãn UI: "Hạng mục"; tên bảng/entity giữ nguyên để tránh churn) cấu hình theo tổ chức.
 * VD: Công tác giảng dạy, Nghiên cứu khoa học, Cố vấn học tập… Org tự thêm/đổi tên/sắp xếp, tái dùng qua nhiều kỳ.
 * Mỗi hạng mục PHẢI gán vào đúng 1 trong 4 {@link BscFixedPerspective} cố định (Tài chính, Khách hàng,
 * Quy trình nội bộ, Học hỏi & phát triển) — đây là tầng phân loại (nhóm cha) để gộp hiển thị.
 */
@Entity
@Table(name = "bsc_perspectives")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BscPerspective {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Column(name = "code", nullable = false, length = 50)
    private String code;

    /** Lĩnh vực CỐ ĐỊNH mà hạng mục này thuộc về (bắt buộc). */
    @Enumerated(EnumType.STRING)
    @Column(name = "fixed_perspective", length = 20)
    private BscFixedPerspective fixedPerspective;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "color", length = 20)
    private String color;

    @Column(name = "icon", length = 50)
    private String icon;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private Integer displayOrder = 0;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private BscPerspectiveStatus status = BscPerspectiveStatus.ACTIVE;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
