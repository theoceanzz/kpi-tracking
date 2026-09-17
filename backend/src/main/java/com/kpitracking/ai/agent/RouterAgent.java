package com.kpitracking.ai.agent;

import dev.langchain4j.service.UserMessage;
import dev.langchain4j.service.V;

/**
 * Agent định tuyến: câu hỏi → các nhóm công cụ cần mở.
 *
 * <p>Thay {@code LlmIntentStrategy}. Phần nhóm tool giữ NGUYÊN VĂN bản đã đo (45 câu); chỗ trống
 * {@code hints} nhận thêm một dòng cho mỗi {@code IntentHandler} đang bật (vd HELP) — thêm nhánh
 * mới không phải sửa prompt này. Trả chuỗi thô; {@code TurnSteps.route} bóc thành nhóm và quyết
 * định lùi về đâu khi model trả lạ — logic đó là của ứng dụng, không nhét vào prompt.
 *
 * <p>Vì sao là agent riêng chứ không gộp vào agent chính: một lời gọi nhỏ, không tool, rẻ, chạy
 * trước; nó thu hẹp bộ công cụ để agent chính không phải đọc 24 mô tả tool ở mọi lượt.
 */
public interface RouterAgent {

    @UserMessage("""
            Phân loại câu hỏi của người dùng vào một hoặc nhiều nhóm công cụ.

            LOOKUP  - cơ cấu tổ chức, đơn vị, nhân sự, chức vụ, hồ sơ cá nhân
            KPI     - chỉ tiêu KPI, kỳ đánh giá, bài nộp, ai chưa nộp, tổng quan KPI của đơn vị
            INSIGHT - xếp hạng, so sánh đơn vị, xu hướng theo thời gian, cảnh báo rủi ro,
                      bức tranh toàn đơn vị (quân số + số đơn vị con + số kỳ)
            BSC     - bộ tiêu chí (người dùng còn gọi là thẻ điểm cân bằng), hạng mục/lĩnh vực
                      (tài chính/khách hàng/quy trình/học hỏi),
                      cân bằng viễn cảnh, điểm BSC
            OKR     - mục tiêu (objective), kết quả then chốt (key result), tiến độ mục tiêu
            ACTION  - người dùng RA LỆNH thay đổi dữ liệu: duyệt / phê duyệt / từ chối bài nộp,
                      duyệt chỉ tiêu, duyệt yêu cầu điều chỉnh, nhắc người chưa nộp.
                      CHỈ chọn khi họ bảo LÀM, không chọn khi họ chỉ HỎI về những thứ đó.

            {{hints}}

            Chỉ trả về tên nhóm, phân tách bằng dấu phẩy. Không giải thích.
            Câu hỏi cần nhiều loại dữ liệu thì trả nhiều nhóm.
            Không chắc thì trả: LOOKUP,KPI,INSIGHT

            Câu hỏi: {{question}}
            """)
    String route(@V("hints") String hints, @V("question") String question);
}
