package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

/**
 * Bảng CHA: 4 viễn cảnh BSC (Tài chính, Khách hàng, Quy trình nội bộ, Học hỏi & phát triển)
 * theo TỪNG TỔ CHỨC. Mỗi org có bản sao 4 dòng, tự chỉnh sửa tên/màu/thứ tự; {@code code}
 * giữ cố định (khớp enum {@link com.kpitracking.enums.BscFixedPerspective}) — mỗi "Hạng mục"
 * ({@link BscPerspective}) trỏ tới đây qua cột {@code fixed_perspective} (theo mã, trong cùng org).
 */
@Entity
@Table(name = "bsc_fixed_perspectives")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BscFixedPerspectiveEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Tổ chức sở hữu bản viễn cảnh này. */
    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    /** Mã cố định (FINANCIAL, CUSTOMER, INTERNAL_PROCESS, LEARNING_GROWTH) — không cho sửa. */
    @Column(name = "code", length = 20, nullable = false)
    private String code;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "color", length = 20)
    private String color;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private Integer displayOrder = 0;
}
