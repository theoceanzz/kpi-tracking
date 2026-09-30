package com.kpitracking.ai.agent;

import dev.langchain4j.service.Result;
import dev.langchain4j.service.SystemMessage;
import dev.langchain4j.service.UserMessage;

/**
 * Nhân viên nhờ AI soi bài của MỘT chỉ tiêu trước khi nộp ({@code SubmissionSelfCheckService}).
 *
 * <p>Tách khỏi {@link CriterionReviewAgent} vì người đọc khác và việc khác: agent kia viết cho QUẢN LÝ và chọn mức
 * chất lượng; agent này nói với chính người nộp ("bạn"), chỉ chỉ ra chỗ mạnh, chỗ thiếu, cách sửa — không chọn mức,
 * không cho điểm. Cùng khối dữ liệu do {@code ReviewPrompts.selfCheckBlock} dựng (không qua template, để chữ người
 * dùng gõ không bị hiểu thành biến).
 */
public interface SubmissionSelfCheckAgent {

    @SystemMessage(fromResource = "promptTemplates/selfCheckSystem.st")
    Result<String> check(@UserMessage String block);
}
