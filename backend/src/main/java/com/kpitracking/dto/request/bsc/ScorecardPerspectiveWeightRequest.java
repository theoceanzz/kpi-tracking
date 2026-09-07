package com.kpitracking.dto.request.bsc;

import com.kpitracking.enums.BscGateEffect;
import com.kpitracking.enums.BscGateScope;
import com.kpitracking.enums.BscMeasurementSource;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ScorecardPerspectiveWeightRequest {
    @NotNull
    private UUID perspectiveId;
    @NotNull
    private Double weightPercentage;
    private Integer displayOrder;
    /**
     * Mục tiêu RIÊNG của hạng mục trong bộ tiêu chí này (QĐ-2 — công ty 100 tỷ, phòng KD 60 tỷ...).
     * Danh sách hạng mục gửi lên là AUTHORITATIVE như với trọng số: null = xoá mục tiêu riêng.
     * Khi TẠO MỚI mà cả ba trường mục tiêu đều null thì kế thừa mặc định của hạng mục.
     */
    private Double targetValue;
    /** Kết quả tối thiểu riêng của cấp này; phải ≤ {@link #targetValue} khi cả hai được đặt. */
    private Double minimumValue;
    /** Đơn vị tính của mục tiêu/tối thiểu ở cấp này. */
    private String unit;
    /** Nguồn lấy kết quả thực đạt của chỉ tiêu ở cấp đơn vị. Bỏ trống = giữ nguyên/ROLLUP. */
    private BscMeasurementSource measurementSource;

    // ── Hạng mục chặn (QĐ-7): áp trần xếp loại, KHÔNG trừ điểm ──
    private Boolean isGate;
    private Double gateMinPercent;
    private BscGateEffect gateEffect;
    private Integer gateCapRating;
    private BscGateScope gateAppliesTo;

    /** Lý do đổi trọng số (ghi vào lịch sử nếu trọng số thay đổi). */
    private String reason;
}
