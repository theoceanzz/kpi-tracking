package com.kpitracking.dto.response.feedback360;

import com.kpitracking.enums.F360CampaignStatus;
import com.kpitracking.enums.F360SubjectStatus;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Báo cáo 360 của một người: điểm lấy từ bản chụp lúc đóng ({@link #result}), nhận xét đọc live
 * (đã lọc nhận xét bị ẩn, không kèm tên người viết, không theo thứ tự nộp).
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360ReportResponse {
    private UUID subjectId;
    private UUID userId;
    private String fullName;
    private String avatarUrl;
    private String orgUnitName;
    private UUID campaignId;
    private String campaignName;
    private F360CampaignStatus campaignStatus;
    private F360SubjectStatus subjectStatus;
    private Instant closedAt;
    private Instant releasedAt;
    private F360ResultSnapshot result;
    private List<CommentBlock> comments;
    private String aiSummary;
    /** Người xem được ẩn nhận xét vi phạm (HR, và không phải báo cáo của chính họ). */
    private Boolean canHideComments;
    /** Đang xem báo cáo của chính mình. */
    private Boolean selfView;
    /** Trung bình nhóm đơn vị (đủ ngưỡng k) để so — chỉ có với người xem KHÔNG phải subject. */
    private Comparison comparison;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Comparison {
        private String label;
        private Integer subjectCount;
        private Double overall;
        /** Khoá năng lực (id) → TB điểm người khác của nhóm. */
        private java.util.Map<String, Double> byCompetency;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CommentBlock {
        private UUID questionId;
        private String question;
        private List<Comment> items;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Comment {
        /** Id câu trả lời — chỉ để HR ẩn; không suy ra được người viết. */
        private UUID id;
        private String text;
        /** Nhãn nhóm hiển thị ("Đồng nghiệp", "Người khác"…), không phải tên người. */
        private String groupLabel;
        private Boolean hidden;
    }
}
