package com.kpitracking.ai.agent;

import dev.langchain4j.service.UserMessage;
import dev.langchain4j.service.V;

/**
 * Agent lập kế hoạch: câu hỏi nhiều vế → "TÊN_TOOL | việc cần lấy", mỗi bước một dòng.
 *
 * <p>Thay phần gọi model của {@code PlanNode}; prompt giữ nguyên văn. Bóc kết quả ở
 * {@link PlanParser} — rộng rãi có chủ đích vì model hay quên dấu {@code |} hoặc đánh số.
 *
 * <p>Kế hoạch dùng cho hai việc: nới nhóm công cụ (tool nêu trong kế hoạch thì nhóm của nó được
 * mở dù router không chọn), và kiểm "còn thiếu vế nào" sau khi agent chính trả lời.
 */
public interface PlannerAgent {

    @UserMessage("""
            Chia câu hỏi sau thành các bước lấy dữ liệu, mỗi bước một dòng, tối đa 4 bước.

            Mỗi dòng viết đúng dạng:  TÊN_TOOL | việc cần lấy

            Chỉ được dùng các TÊN_TOOL sau:
            search           - tìm đơn vị/người/KPI theo tên khi chưa biết chính xác
            get_org_unit     - thông tin đơn vị, cây đơn vị, đơn vị con
            get_people       - danh sách người, chức vụ, hồ sơ cá nhân
            get_kpi          - chỉ tiêu KPI, kỳ đánh giá, ai được giao, tổng quan KPI của đơn vị
            get_submissions  - bài nộp, lịch sử nộp, ai chưa nộp
            rank             - xếp hạng người hoặc đơn vị
            compare_org_units- so sánh các đơn vị theo hiệu suất, tiến độ, quân số, tỉ lệ hoàn thành.
                               KHÔNG có chỉ số rủi ro — câu hỏi về rủi ro phải dùng get_analytics
            get_analytics    - bức tranh toàn đơn vị (quân số + số đơn vị con + số kỳ),
                               xu hướng qua các kỳ, và KPI rủi ro/trễ hạn

            Quy tắc:
            - Mỗi VẾ của câu hỏi là MỘT bước. Câu hỏi có 3 vế thì phải có 3 bước.
            - Chỉ tách bước khi câu hỏi thật sự cần nhiều loại dữ liệu khác nhau.
            - Câu hỏi đơn giản chỉ cần MỘT bước.
            - Không giải thích, không đánh số, không thêm chữ nào khác.

            Câu hỏi: {{question}}
            """)
    String plan(@V("question") String question);
}
