package com.kpitracking.dto.response.ai;

import com.kpitracking.enums.AiReviewStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Một lượt AI đọc bài nộp của một nhân viên trong một đợt. Chỉ để THAM KHẢO khi chấm.
 *
 * <p>{@link #disclaimer} luôn có giá trị: mọi nơi hiển thị kết quả phải mang nhãn này, và gửi kèm từ máy
 * chủ thì một client quên thêm nhãn vẫn có chữ để hiện.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiSubmissionReviewResponse {

    public static final String DISCLAIMER = "Kết quả do AI gợi ý – cần quản lý xác nhận";

    private UUID id;
    private UUID kpiPeriodId;
    private UUID userId;
    private AiReviewStatus status;
    private String overallSummary;
    /** CAO | TRUNG_BINH | THAP. */
    private String confidence;
    private List<String> missingData;
    /** Mỗi phần tử "tên tệp: lý do" — tệp AI chưa đọc được nội dung. */
    private List<String> unreadableFiles;
    private List<AiSubmissionReviewItemResponse> items;
    /** Phiên bản bộ tiêu chí tổ chức đã dùng; {@code null} = chưa có bộ nào được xác nhận. */
    private Integer criteriaSetVersion;
    /** Số tệp minh chứng đọc được / tổng số. */
    private Integer filesRead;
    private Integer filesTotal;
    private String modelName;
    private String promptVersion;
    private Integer durationMs;
    private String errorMessage;
    private Instant createdAt;
    private Instant finishedAt;
    @Builder.Default
    private String disclaimer = DISCLAIMER;
}
