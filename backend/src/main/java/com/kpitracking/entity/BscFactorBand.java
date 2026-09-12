package com.kpitracking.entity;

import com.kpitracking.enums.BscFactorScope;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

/**
 * Một dải kết quả BSC → một NHÃN. VD: 80–95% ⇒ "Cần cải thiện". Dải chỉ dùng để đọc kết quả của
 * đơn vị/công ty; nó KHÔNG còn sinh ra hệ số nhân vào điểm của nhân viên.
 *
 * <p>Khoảng NỬA MỞ [from, to): ranh giới thuộc về dải TRÊN, nên đúng 95% rơi vào dải 95–105 chứ
 * không phải 80–95. {@code fromPercent = null} là âm vô cùng, {@code toPercent = null} là dương
 * vô cùng — nhờ vậy hai dải đầu/cuối phủ hết mọi giá trị mà không cần con số ma.
 */
@Entity
@Table(name = "bsc_factor_bands")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BscFactorBand {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "policy_id", nullable = false)
    private BscCascadePolicy policy;

    /** Dải này dùng để tra kết quả của cấp nào (đơn vị hay công ty). */
    @Enumerated(EnumType.STRING)
    @Column(name = "scope", nullable = false, length = 10)
    private BscFactorScope scope;

    @Column(name = "from_percent")
    private Double fromPercent;

    @Column(name = "to_percent")
    private Double toPercent;

    /** KHÔNG CÒN DÙNG để tính điểm — giữ lại vì cột NOT NULL và còn dữ liệu các kỳ cũ. */
    @Deprecated
    @Column(name = "factor", nullable = false)
    private Double factor;

    @Column(name = "label", length = 100)
    private String label;

    @Column(name = "color", length = 20)
    private String color;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private Integer displayOrder = 0;

    /** Giá trị có rơi vào dải này không. Null ở hai đầu = vô cùng. */
    public boolean contains(double percent) {
        if (fromPercent != null && percent < fromPercent) return false;
        return toPercent == null || percent < toPercent;
    }
}
