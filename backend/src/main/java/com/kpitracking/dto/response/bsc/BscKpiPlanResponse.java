package com.kpitracking.dto.response.bsc;

import lombok.*;

import java.util.List;
import java.util.UUID;

/**
 * Bản kế hoạch chia MỘT dòng chỉ tiêu BSC thành các KPI theo từng đợt.
 *
 * <p>Trả lời đúng câu hỏi trưởng đơn vị đặt ra khi bấm "Tạo KPI từ hạng mục": hạng mục này đang
 * gánh bao nhiêu, bộ tiêu chí trải trên những đợt nào, mỗi đợt đã chia được bao nhiêu rồi và
 * còn lại bao nhiêu để chia tiếp.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BscKpiPlanResponse {
    private UUID scorecardId;
    private String scorecardName;
    private UUID scorecardPerspectiveId;
    private UUID perspectiveId;
    private String name;
    private String color;
    private String unit;
    /** Mục tiêu hiệu lực của dòng chỉ tiêu (của dòng, hoặc mặc định của hạng mục). */
    private Double targetValue;
    private Double minimumValue;
    /** Trọng số của hạng mục trong bộ tiêu chí — KPI con chia nhau 100% BÊN TRONG hạng mục này. */
    private Double weightPercentage;
    /** Phòng ban của bộ tiêu chí; rỗng = bộ tiêu chí toàn tổ chức (phải tự chọn đơn vị nhận KPI). */
    private List<ScorecardOrgUnitResponse> orgUnits;
    private List<BscKpiPlanPeriodResponse> periods;
    /** Tổng mục tiêu đã chia thành KPI trên MỌI đợt của bộ tiêu chí. */
    private Double allocatedValue;
    /** Còn lại so với mục tiêu; null khi dòng chỉ tiêu chưa đặt mục tiêu. */
    private Double remainingValue;
}
