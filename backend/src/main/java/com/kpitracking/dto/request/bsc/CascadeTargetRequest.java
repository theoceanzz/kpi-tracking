package com.kpitracking.dto.request.bsc;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

/** Một đơn vị nhận phân rã, kèm mức đóng góp và mục tiêu riêng của đơn vị đó. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CascadeTargetRequest {

    @NotNull
    private UUID orgUnitId;

    /** Mức đóng góp tuyệt đối vào mục tiêu của chỉ tiêu cha (VD 60 tỷ trong 100 tỷ). */
    private Double contributionValue;

    /** Hoặc đóng góp theo % mục tiêu cha — dùng khi chỉ tiêu cha không có con số tuyệt đối. */
    private Double contributionPercent;

    /**
     * Mục tiêu của đơn vị. Bỏ trống thì lấy chính {@code contributionValue} — phần lớn trường hợp
     * hai con số này là một, bắt nhập hai lần chỉ tạo cơ hội gõ lệch.
     */
    private Double targetValue;

    private Double minimumValue;
    private String unit;

    /** Trọng số của chỉ tiêu trong bộ tiêu chí của đơn vị. Bỏ trống = 0, đơn vị tự chia sau. */
    private Double weightPercentage;
}
