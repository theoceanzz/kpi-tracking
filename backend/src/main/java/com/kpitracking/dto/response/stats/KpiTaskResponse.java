package com.kpitracking.dto.response.stats;

import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiTaskResponse {
    private UUID id;
    private String name;
    private String periodName;
    private Instant deadline;
    private String status; // NOT_STARTED, PENDING, OVERDUE, APPROVED
    private Instant startDate;
    private Integer submissionCount;
    private Integer expectedSubmissions;
    /**
     * Điểm quản lý CHO, đúng nghĩa đen (thang của chỉ tiêu, tối đa = {@link #managerScoreMax}).
     *
     * <p>Trước đây trường này chứa {@code min(100, managerScore/weight×100)} lấy từ MỘT bài nộp
     * điểm cao nhất — một "% đạt" tự chế: sai nguồn (điểm chấm chứ không phải thực đạt/chỉ tiêu),
     * sai trần (100 thay vì 150) và bỏ qua mọi bài nộp khác.
     */
    private Double managerScore;
    /** Điểm tối đa của chỉ tiêu, để giao diện hiện "32/40" thay vì tự quy ra phần trăm. */
    private Double managerScoreMax;
    /**
     * % đạt theo đúng bộ tính điểm của lõi (0..150). {@code null} = chỉ tiêu không tham gia tính
     * điểm, hoặc chỉ tiêu định tính chưa được chấm — khác hẳn 0.
     */
    private Double attainmentPercent;
    private String managerName;
    private com.kpitracking.enums.kpi.KpiType kpiType;
    private String qualitativeLevelName;
}
