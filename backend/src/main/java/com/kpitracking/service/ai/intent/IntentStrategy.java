package com.kpitracking.service.ai.intent;

import com.kpitracking.tool.ToolRegistry;

import java.util.Set;

/**
 * Cách xác định câu hỏi cần những nhóm tool nào.
 *
 * <p>Tách thành interface để đổi cách làm mà không đụng tới {@code IntentStage}: hiện tại là một
 * lần gọi LLM nhỏ ({@link LlmIntentStrategy}); khi số tool vượt khoảng 40 thì thay bằng truy hồi
 * theo ngữ nghĩa — chỉ thêm một class cài interface này.
 *
 * <p><b>Hợp đồng bắt buộc:</b> luôn trả về tập KHÔNG rỗng. Mọi trường hợp không chắc chắn phải lùi
 * về toàn bộ nhóm đọc, tức đúng hành vi khi tắt định tuyến. Định tuyến sai chỉ được phép làm tốn
 * thêm, tuyệt đối không được làm model mất công cụ một cách im lặng.
 */
public interface IntentStrategy {

    Set<ToolRegistry.Group> route(String question);

    /** Có đang bật không; tắt thì {@code IntentStage} lấy toàn bộ nhóm đọc. */
    boolean isEnabled();
}
