package com.kpitracking.ai.agent;

import dev.langchain4j.service.SystemMessage;
import dev.langchain4j.service.UserMessage;

/**
 * Agent sinh câu hỏi gợi ý tiếp theo từ dữ liệu tool vừa lấy.
 *
 * <p>Thay phần gọi model của {@code FollowupService}; prompt hệ thống giữ nguyên tệp
 * {@code followupSuggestionsPrompt.st}. Chạy SONG SONG với bước kiểm duyệt ở cuối lượt, vì hai
 * việc không phụ thuộc nhau.
 */
public interface FollowupAgent {

    @SystemMessage(fromResource = "promptTemplates/followupSuggestionsPrompt.st")
    String suggest(@UserMessage String dataContext);
}
