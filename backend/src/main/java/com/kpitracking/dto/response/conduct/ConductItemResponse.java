package com.kpitracking.dto.response.conduct;

import lombok.*;

import java.util.UUID;

/** Một dòng tiêu chí trong phiếu hạnh kiểm, đủ hai phía chấm. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ConductItemResponse {
    /** null khi tiêu chí gốc đã bị xoá khỏi cấu hình — phiếu vẫn giữ bản chụp. */
    private UUID criteriaId;
    private String name;
    private String description;
    private Double weight;
    private Integer position;

    private Double selfScore;
    private String selfEvidence;
    private Double managerScore;
    private String managerComment;

    /** Điểm đã tính đến trọng số = điểm × trọng số/100 (hai cột cuối của phiếu giấy). */
    private Double selfWeighted;
    private Double managerWeighted;
}
