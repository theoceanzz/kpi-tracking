package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

/**
 * Một dòng tiêu chí trong phiếu hạnh kiểm.
 *
 * Tên/mô tả/trọng số được CHỤP LẠI từ {@link ConductCriteria} lúc mở phiếu: sửa bộ tiêu chí
 * về sau không được viết lại các phiếu đã chấm — điểm tổng đã cộng theo trọng số cũ.
 */
@Entity
@Table(name = "conduct_evaluation_items")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ConductEvaluationItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conduct_evaluation_id", nullable = false)
    private ConductEvaluation conductEvaluation;

    /** Tiêu chí gốc — null khi tiêu chí đã bị xoá khỏi cấu hình. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "criteria_id")
    private ConductCriteria criteria;

    @Column(name = "criteria_name", nullable = false)
    private String criteriaName;

    @Column(name = "criteria_description", columnDefinition = "TEXT")
    private String criteriaDescription;

    @Column(name = "weight", nullable = false)
    private Double weight;

    @Column(name = "position_index", nullable = false)
    private Integer position;

    /** Điểm do CBNV/giảng viên tự đánh giá. */
    @Column(name = "self_score")
    private Double selfScore;

    /** "Dẫn chứng" cho điểm tự đánh giá. */
    @Column(name = "self_evidence", columnDefinition = "TEXT")
    private String selfEvidence;

    /** Điểm do cán bộ quản lý trực tiếp (CBQLTT) đánh giá. */
    @Column(name = "manager_score")
    private Double managerScore;

    /** "Nhận xét của Cán bộ quản lý". */
    @Column(name = "manager_comment", columnDefinition = "TEXT")
    private String managerComment;
}
