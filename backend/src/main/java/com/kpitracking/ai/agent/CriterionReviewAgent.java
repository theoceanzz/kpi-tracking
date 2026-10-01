package com.kpitracking.ai.agent;

import dev.langchain4j.service.Result;
import dev.langchain4j.service.SystemMessage;
import dev.langchain4j.service.UserMessage;

/**
 * Đọc bài nộp của MỘT chỉ tiêu và nhận xét CHẤT LƯỢNG nội dung — agent thứ nhất của luồng AI đánh giá
 * bài nộp ({@code SubmissionReviewWorkflow}).
 *
 * <p>Mỗi lời gọi chỉ mang một chỉ tiêu: prompt ngắn, JSON ổn định hơn, và một chỉ tiêu lỗi không kéo hỏng
 * cả lượt. Ba con số (đáp ứng, đúng hạn, điểm) KHÔNG phải việc của agent này — mã nguồn tính và
 * {@code ReviewResultValidator} ghi đè nếu mô hình lỡ điền.
 *
 * <p>Dữ liệu vào là MỘT khối chữ do {@code ReviewPrompts} dựng sẵn — không đi qua template của langchain4j,
 * để chữ nhân viên gõ (có thể chứa {@code {{…}}}) không bao giờ bị hiểu thành biến.
 */
public interface CriterionReviewAgent {

    @SystemMessage(fromResource = "promptTemplates/criterionReviewSystem.st")
    Result<String> review(@UserMessage String criterionBlock);
}
