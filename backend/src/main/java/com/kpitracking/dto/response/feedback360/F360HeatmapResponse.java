package com.kpitracking.dto.response.feedback360;

import lombok.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Năng lực × đơn vị cho một chiến dịch (§10.2-5). Mỗi dòng là một nhóm ĐỦ k người: đơn vị có ít
 * hơn k người đã có kết quả được gộp lên đơn vị cha — nếu không, trung bình của phòng 2 người để lộ
 * điểm của người còn lại. Nhóm không đủ k kể cả khi leo tới gốc thì bị bỏ.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360HeatmapResponse {
    private Integer scaleMax;
    private Integer anonymityThreshold;
    /** Tên năng lực theo đúng thứ tự cột. */
    private List<String> competencies;
    private List<Row> rows;
    /** Số người có kết quả nhưng không vào dòng nào (nhóm không đủ k). */
    private Integer excludedCount;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Row {
        private UUID orgUnitId;
        private String orgUnitName;
        /** Dòng này gộp thêm người từ các đơn vị con dưới ngưỡng. */
        private Boolean rolledUp;
        private Integer subjectCount;
        private Double overall;
        /** Tên năng lực → TB điểm "người khác". */
        private Map<String, Double> scores;
    }
}
