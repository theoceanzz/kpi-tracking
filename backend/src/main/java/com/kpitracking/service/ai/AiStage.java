package com.kpitracking.service.ai;

import org.springframework.core.Ordered;

/**
 * Một công đoạn trong luồng xử lý lượt hỏi AI.
 *
 * <p>Cùng hình dạng với {@code CallAdvisor} của Spring AI đang dùng trong dự án — khác ở chỗ
 * advisor chỉ bọc <i>lời gọi model</i>, còn stage bọc <i>cả lượt</i>: từ chặn tần suất, kiểm quyền,
 * định tuyến, cho tới xử lý câu trả lời.
 *
 * <p>Thêm công đoạn mới = thêm một class cài interface này với {@code @Order} phù hợp. Không phải
 * sửa stage nào đang có, không phải sửa {@code AiService}.
 *
 * <p>Thứ tự quy ước (số nhỏ chạy trước, và cũng là lớp bọc NGOÀI cùng):
 * <pre>
 *   100 RateLimitStage      chặn tần suất
 *   200 QuotaStage          kiểm hạn mức token
 *   300 AuthScopeStage      quyền quản lý + tổ chức có bật AI không
 *   400 TurnSetupStage      dựng ngữ cảnh cho tool
 *   500 FollowupStage       sinh câu hỏi gợi ý sau khi đã có câu trả lời
 *   600 ValidationStage     soi câu trả lời trước khi trả về
 *   700 PlanningStage       lập kế hoạch trước khi định tuyến
 *   800 IntentStage         chọn nhóm tool
 *   900 ToolSelectionStage  nhóm ∩ quyền -> bộ tool
 *  1000 EscapeHatchStage    model xin thêm tool thì nới rồi gọi lại
 *  1050 PlanCompletionStage thiếu bước đã lên kế hoạch thì hỏi lại một lần
 *  1100 ModelCallStage      điểm cuối, gọi model
 * </pre>
 */
public interface AiStage extends Ordered {

    /**
     * @param turn ngữ cảnh của lượt, được các stage bổ sung dần
     * @param next phần còn lại của chuỗi — gọi hay không là quyền của stage này
     * @return câu trả lời cho người dùng
     */
    String handle(AiTurn turn, AiStageChain next);

    /** Mặc định đứng cuối, để stage mới quên đặt @Order không vô tình chen lên đầu. */
    @Override
    default int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }

    /**
     * Nhãn hiện cho người dùng KHI VÀO công đoạn này. {@code null} = không hiện.
     *
     * <p><b>Mặc định là không hiện</b>, và đó là chủ đích. Nhãn này người dùng cuối đọc, nên phần
     * lớn công đoạn không đáng hiện: {@code RateLimitStage} và {@code QuotaStage} xong trong vài
     * mili-giây, {@code IntentStage} thuần nội bộ. Bản trước lấy tên lớp làm nhãn mặc định, hệ quả
     * là công đoạn mới quên đặt nhãn sẽ hiện thẳng tên lớp Java ra giao diện.
     *
     * <p><b>Công đoạn làm việc SAU {@code next.proceed(...)} thì để {@code null} ở đây</b> và tự gọi
     * {@link AiTurn#progress(String)} đúng lúc bắt đầu làm. Nhãn phát lúc vào sẽ nói sai: chúng vào
     * chuỗi ngay đầu lượt nhưng chỉ làm việc sau khi model đã trả lời, tức 10-15 giây sau đó.
     */
    default String label() {
        return null;
    }
}
