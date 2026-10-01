package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

/** Một dòng của bộ tiêu chí: tên, mô tả, trọng số, các mức, phạm vi, và đoạn văn gốc máy bóc ra. */
@Entity
@Table(name = "ai_criteria_set_items")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AiCriteriaSetItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "set_id", nullable = false)
    private UUID setId;

    @Column(name = "position", nullable = false)
    @Builder.Default
    private Integer position = 0;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "weight", precision = 6, scale = 2)
    private BigDecimal weight;

    /** Mỗi dòng "Mức: mô tả". */
    @Column(name = "scale_levels", columnDefinition = "TEXT")
    private String scaleLevels;

    @Column(name = "scope", columnDefinition = "TEXT")
    private String scope;

    @Column(name = "source_excerpt", columnDefinition = "TEXT")
    private String sourceExcerpt;

    /** Đoạn văn gốc có thật trong tài liệu tải lên không — sai thì màn đối chiếu cảnh báo. */
    @Column(name = "excerpt_verified", nullable = false)
    @Builder.Default
    private Boolean excerptVerified = false;

    /** Người duyệt đã đối chiếu và xác nhận dòng đúng dù máy không thấy nguyên văn — hết cảnh báo "cần kiểm lại". */
    @Column(name = "reviewer_confirmed", nullable = false)
    @Builder.Default
    private Boolean reviewerConfirmed = false;

    /** Vai trò: TIEU_CHI căn cứ chấm · THANG_MUC thang mức · THAM_KHAO AI đọc khi chấm · TRA_CUU chỉ tra cứu. */
    @Column(name = "kind", nullable = false, length = 20)
    @Builder.Default
    private String kind = "TIEU_CHI";

    /** Mục gốc trong tài liệu (vd "CHƯƠNG IV › Điều 10. Đánh giá kết quả công việc"). */
    @Column(name = "section")
    private String section;

    /** Chủ đề lấy từ chính tài liệu ("Cơ chế thưởng dự án", "Nhiệm vụ bộ phận") — nhóm hiển thị động. */
    @Column(name = "topic", length = 120)
    private String topic;
}
