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
 * Kết quả nhân viên tự nhờ AI soi bài trước khi nộp. Cố ý KHÔNG có trường mức chất lượng hay điểm — người dùng
 * đã chốt: nhân viên chỉ thấy nhận xét.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiSelfCheckResponse {
    private UUID id;
    private UUID kpiCriteriaId;
    private UUID kpiSubmissionId;
    private AiReviewStatus status;
    /** Trả lại lần soi trước cho ĐÚNG bài này — không gọi mô hình, không tốn token. */
    private boolean reused;
    private String summary;
    private List<String> evidenceQuotes;
    private List<String> strengths;
    private List<String> gaps;
    private List<String> suggestions;
    private List<AiReviewBasisResponse> basis;
    /** Mỗi phần tử "tên tệp: lý do". */
    private List<String> unreadableFiles;
    private Integer filesRead;
    private Integer filesTotal;
    /** Phiên bản bộ tiêu chí đã dùng ({@code null} = đơn vị chưa có bộ tiêu chí xác nhận). */
    private Integer criteriaSetVersion;
    private Instant createdAt;
    private Instant finishedAt;
}
