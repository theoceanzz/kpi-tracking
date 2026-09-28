package com.kpitracking.dto.response.feedback360;

import com.kpitracking.enums.F360AssignmentStatus;
import com.kpitracking.enums.F360QuestionType;
import com.kpitracking.enums.F360Relationship;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Phiếu đánh giá của người chấm: câu hỏi đã lọc theo quan hệ, kèm câu trả lời nháp. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360FormResponse {
    private UUID assignmentId;
    private UUID campaignId;
    private String campaignName;
    private Instant dueAt;
    private String subjectName;
    private String subjectAvatarUrl;
    private String subjectOrgUnitName;
    private F360Relationship relationship;
    private F360AssignmentStatus status;
    /** Còn sửa được không (chiến dịch đang mở và phiếu chưa nộp). */
    private Boolean editable;
    /** Phiếu thuộc nhóm ẩn danh — quyết định câu chữ cam kết trên đầu phiếu. */
    private Boolean anonymous;
    private Boolean strictAnonymity;
    private Integer anonymityThreshold;
    private Integer scaleMax;
    private List<Section> sections;

    /** Một năng lực, hoặc khối "Nhận xét chung" (competencyKey null). */
    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Section {
        private UUID competencyKey;
        private String title;
        private List<Question> questions;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Question {
        private UUID id;
        private F360QuestionType questionType;
        private String text;
        private Boolean required;
        private Boolean allowNa;
        private Double score;
        private Boolean na;
        private String comment;
    }
}
