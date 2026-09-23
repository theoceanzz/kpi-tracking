package com.kpitracking.ai.workflow;

import dev.langchain4j.agentic.scope.AgenticScope;

import java.util.function.Consumer;

/**
 * Điểm mở rộng DUY NHẤT của trợ lý: một nhánh xử lý theo ý định.
 *
 * <p>Thêm một agent mới cho một loại việc mới = thêm một bean cài interface này. Không sửa router,
 * không sửa bộ dựng workflow: {@code KeyGoAssistant} gom mọi bean, ghép {@link #routerHint()} vào
 * prompt của {@code RouterAgent}, và dựng một nhánh {@code conditional} cho mỗi bean.
 *
 * <p>Nhánh mặc định (không bean nào khớp) là agent chính gọi tool — mọi câu hỏi về số liệu thật đi
 * đường đó. Nên chỉ những việc <b>không</b> phải tra dữ liệu KeyGo mới cần một handler riêng: hỏi
 * đáp tài liệu, xuất báo cáo, soạn email... Handler không được là chỗ để né bộ lọc quyền của tool.
 */
public interface IntentHandler {

    /**
     * Nhãn mà {@code RouterAgent} trả về khi chọn nhánh này. Viết HOA, không trùng tên nhóm tool
     * ({@code LOOKUP, KPI, INSIGHT, BSC, OKR, ACTION}).
     */
    String intent();

    /**
     * Một dòng mô tả cho RouterAgent, đúng dạng các dòng nhóm tool: {@code "TÊN    - khi nào chọn"}.
     * Trả {@code null} khi nhánh này không dùng được ở lượt hiện tại — RouterAgent sẽ không thấy nó.
     */
    String routerHint();

    /** Bước xử lý khi trúng nhánh: đọc {@code AiTurn} từ scope, ghi câu trả lời vào {@code AgentState}. */
    Consumer<AgenticScope> step();
}
