package com.kpitracking.ai.agent;

import dev.langchain4j.service.Result;
import dev.langchain4j.service.SystemMessage;
import dev.langchain4j.service.UserMessage;

/**
 * Bóc BỘ TIÊU CHÍ CHẤM từ tài liệu tổ chức tự trình bày (Word/PDF/Excel) thành một bảng theo lược đồ cố
 * định — bước "máy bóc" của hướng "máy bóc, người xác nhận" (tài liệu phân tích mục 9.3).
 *
 * <p>Kết quả KHÔNG dùng ngay: nó thành bản nháp, người quản trị đối chiếu từng dòng với đoạn văn gốc rồi
 * mới xác nhận. Lý do: bóc sai trọng số "30 %" thành "3 %" làm sai điểm cả kỳ mà trông vẫn hợp lý.
 */
public interface CriteriaExtractionAgent {

    @SystemMessage(fromResource = "promptTemplates/criteriaExtractionSystem.st")
    Result<String> extract(@UserMessage String documentText);
}
