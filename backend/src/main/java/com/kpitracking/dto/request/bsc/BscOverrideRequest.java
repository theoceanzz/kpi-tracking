package com.kpitracking.dto.request.bsc;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

/**
 * Ghi đè điểm công nhận của một cá nhân (QĐ-6 — cơ chế THỦ CÔNG, tách hẳn khỏi hệ số tự động).
 *
 * <p>Lý do là BẮT BUỘC: đây là hành vi ngoại lệ và phải giải trình được về sau. Gửi
 * {@code score = null} để huỷ ghi đè, quay lại điểm công nhận do hệ thống tính.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BscOverrideRequest {

    /** Điểm ghi đè. Null = huỷ ghi đè. */
    private Double score;

    @NotBlank
    private String reasonCode;

    private String comment;
}
