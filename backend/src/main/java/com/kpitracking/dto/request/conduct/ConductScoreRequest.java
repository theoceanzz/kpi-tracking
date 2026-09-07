package com.kpitracking.dto.request.conduct;

import com.kpitracking.enums.ConductScope;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;
import java.util.UUID;

/**
 * Chấm một phiếu hạnh kiểm. Dùng chung cho hai phía:
 * bên tự đánh giá gửi (điểm, dẫn chứng), bên quản lý gửi (điểm, nhận xét) —
 * endpoint quyết định cột nào được ghi, không phải client.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ConductScoreRequest {

    /** Người được chấm. Bỏ trống ở luồng tự đánh giá = chính mình. */
    private UUID userId;

    @NotNull(message = "Phạm vi chấm (đợt/kỳ) không được để trống")
    private ConductScope scope;

    /** Bắt buộc khi scope = PERIOD. */
    private UUID kpiPeriodId;

    /** Bắt buộc khi scope = CYCLE. */
    private UUID kpiCycleId;

    /** Nhận xét chung cho cả phiếu (phía quản lý). */
    private String comment;

    @Valid
    private List<ConductScoreItemRequest> items;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ConductScoreItemRequest {
        /**
         * Tiêu chí được chấm — khoá chính để khớp dòng. {@code null} với dòng của phiếu cũ
         * mà tiêu chí gốc đã bị xoá khỏi cấu hình; khi đó khớp bằng {@link #position}.
         */
        private UUID criteriaId;

        /** Thứ tự dòng trong phiếu, dùng khớp dự phòng khi thiếu criteriaId. */
        private Integer position;

        /** Điểm 0..thang điểm của phiếu; null = chưa chấm. */
        private Double score;

        /** "Dẫn chứng" (tự đánh giá) hoặc "Nhận xét của Cán bộ quản lý". */
        private String note;
    }
}
