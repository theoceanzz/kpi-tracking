package com.kpitracking.ai.agent;

import dev.langchain4j.service.Result;
import dev.langchain4j.service.SystemMessage;
import dev.langchain4j.service.UserMessage;

/**
 * Tổng hợp kết quả từng chỉ tiêu (ĐÃ qua kiểm) thành tóm tắt chung, mức tin cậy và danh sách thứ còn
 * thiếu — agent thứ hai của luồng AI đánh giá bài nộp.
 *
 * <p>Đọc kết quả đã kiểm thay vì đọc lại toàn bộ bài nộp: rẻ hơn, và không thể "nhớ ra" một nhận định mà
 * bước kiểm đã bỏ vì thiếu trích dẫn.
 */
public interface ReviewSummaryAgent {

    @SystemMessage(fromResource = "promptTemplates/reviewSummarySystem.st")
    Result<String> summarize(@UserMessage String reviewDigest);
}
