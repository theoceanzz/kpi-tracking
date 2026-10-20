package com.kpitracking.dto.response.evaluation;

import lombok.*;

import java.util.UUID;

/** Một nhánh trong điểm KPI của người kiêm nhiệm: % công sức và % hoàn thành KPI định lượng của nhánh. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class EffortShareLine {
    private UUID orgUnitId;
    private String orgUnitName;
    /** % công sức hiệu lực (đã chuẩn hoá trên các nhánh có KPI trong đợt). */
    private Double sharePercent;
    /** true = quản trị đặt tay; false = chia đều. */
    private boolean configured;
    /** true = % đã chốt cho đợt này lúc quản lý chấm (V46) — sửa % ở hồ sơ không đổi đợt này nữa. */
    private boolean frozen;
    /** % hoàn thành KPI định lượng của riêng nhánh; null nếu nhánh không có KPI định lượng. */
    private Double completionPercent;
}
