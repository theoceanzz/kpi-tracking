package com.kpitracking.ai.agent;

import dev.langchain4j.service.SystemMessage;
import dev.langchain4j.service.UserMessage;

/**
 * Tóm tắt nhận xét mở của một báo cáo 360 (docs/FEEDBACK_360_DESIGN.md §9.5).
 *
 * <p>Đầu vào CHỈ gồm nhận xét của các nhóm đã qua ngưỡng ẩn danh, không kèm nhãn nhóm, đã xáo thứ
 * tự; prompt cấm trích nguyên văn dài và cấm suy đoán người viết.
 */
public interface Feedback360SummaryAgent {

    @SystemMessage(fromResource = "promptTemplates/feedback360SummaryPrompt.st")
    String summarize(@UserMessage String comments);
}
