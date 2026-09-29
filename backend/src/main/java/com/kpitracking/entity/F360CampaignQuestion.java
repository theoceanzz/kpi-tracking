package com.kpitracking.entity;

import com.kpitracking.enums.F360QuestionType;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

/**
 * Bản chụp một câu hỏi lúc chiến dịch launch. Mọi phiếu và mọi phép tính điểm đọc từ đây, không
 * đọc bộ câu hỏi gốc — sửa/xoá bộ gốc sau đó không được làm đổi ý nghĩa phiếu đã phát.
 * Chỉ ghi một lần nên không có cột thời gian.
 */
@Entity
@Table(name = "f360_campaign_questions")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360CampaignQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "campaign_id", nullable = false)
    private F360Campaign campaign;

    @Column(name = "source_question_id")
    private UUID sourceQuestionId;

    /** Id năng lực gốc — khoá gom câu theo năng lực trong bản chụp. Null = câu mở chung. */
    @Column(name = "competency_key")
    private UUID competencyKey;

    @Column(name = "competency_name")
    private String competencyName;

    @Column(name = "competency_weight")
    private Double competencyWeight;

    @Column(name = "competency_position")
    private Integer competencyPosition;

    @Enumerated(EnumType.STRING)
    @Column(name = "question_type", nullable = false)
    private F360QuestionType questionType;

    @Column(name = "text", nullable = false, columnDefinition = "TEXT")
    private String text;

    /** Nhóm quan hệ được hỏi câu này, CSV tên enum. Null = hỏi mọi nhóm. */
    @Column(name = "relationships")
    private String relationships;

    @Column(name = "required", nullable = false)
    private Boolean required;

    @Column(name = "allow_na", nullable = false)
    private Boolean allowNa;

    @Column(name = "position_index", nullable = false)
    private Integer position;
}
