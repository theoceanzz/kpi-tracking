package com.kpitracking.dto.response.feedback360;

import com.kpitracking.enums.F360RaterSource;
import com.kpitracking.enums.F360Relationship;
import com.kpitracking.enums.F360SubjectStatus;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Danh sách người chấm ĐỀ XUẤT của một người trong giai đoạn đề cử — dùng cho cả người được đánh
 * giá (ngoại lệ đề cử §6.2) lẫn người duyệt. Chỉ tồn tại khi chiến dịch đang NOMINATING.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360NominationResponse {
    private UUID subjectId;
    private UUID campaignId;
    private String campaignName;
    private Instant nominationDeadline;
    private F360SubjectStatus status;
    private Integer maxNominees;
    private Instant submittedAt;
    private String approverName;
    private UUID subjectUserId;
    private String subjectName;
    private String subjectAvatarUrl;
    private String orgUnitName;
    private List<Rater> raters;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Rater {
        private UUID assignmentId;
        private UUID raterId;
        private String name;
        private String avatarUrl;
        private F360Relationship relationship;
        private F360RaterSource source;
    }
}
