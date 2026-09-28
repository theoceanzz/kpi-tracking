package com.kpitracking.dto.response.feedback360;

import com.kpitracking.enums.F360Relationship;
import com.kpitracking.enums.F360SubjectStatus;
import lombok.*;

import java.util.List;
import java.util.UUID;

/**
 * Một người được đánh giá trong danh sách của chiến dịch. Tiến độ chỉ là SỐ ĐẾM theo nhóm —
 * danh sách ai chấm/ai chưa nộp nằm ở endpoint riêng, chỉ HR xem được.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360SubjectRowResponse {
    private UUID id;
    private UUID userId;
    private String fullName;
    private String email;
    private String avatarUrl;
    private UUID orgUnitId;
    private String orgUnitName;
    private F360SubjectStatus status;
    private Double overallScore;
    private Integer submittedCount;
    private Integer assignmentCount;
    private List<Progress> progress;
    /** Cảnh báo cấu hình (nhóm dưới ngưỡng ẩn danh, thiếu cấp trên…). */
    private List<String> warnings;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Progress {
        private F360Relationship relationship;
        private Integer submitted;
        private Integer total;
    }
}
