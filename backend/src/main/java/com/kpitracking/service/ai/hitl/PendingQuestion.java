package com.kpitracking.service.ai.hitl;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Câu hỏi trợ lý đặt cho người dùng GIỮA LƯỢT và đang chờ trả lời.
 *
 * <p>Khác {@code ClarificationOption} (lượt kết thúc, người dùng bấm một nút rồi hệ thống chạy một
 * lượt MỚI): ở đây lượt còn sống — model đã lấy được một phần dữ liệu, chỉ thiếu một quyết định —
 * nên trả lời xong nó làm tiếp với nguyên ngữ cảnh đang có.
 *
 * <p>Một thẻ gom được vài câu ({@link Item}) để người dùng trả lời một lần: mỗi lượt vẫn chỉ hỏi MỘT
 * lần. Người dùng LUÔN tự nhập được, ngoài các lựa chọn (nếu có).
 *
 * @param questionId khoá của riêng thẻ hỏi này trong lượt
 * @param turnId     lượt đang chờ (khoá công khai để client gọi trả lời)
 * @param userId     chỉ chính người được hỏi mới trả lời được
 * @param items      các câu hỏi trong thẻ, theo thứ tự hiển thị (ít nhất một)
 */
public record PendingQuestion(
        String questionId,
        String turnId,
        UUID userId,
        List<Item> items) {

    /** Tối đa câu hỏi trong một thẻ — hơn thế là một biểu mẫu, không còn là một câu hỏi. */
    public static final int MAX_ITEMS = 3;

    public PendingQuestion {
        if (items == null || items.isEmpty()) throw new IllegalArgumentException("Thẻ hỏi cần ít nhất một câu.");
        items = List.copyOf(items);
    }

    /** Thẻ một câu — dạng phổ biến nhất (hỏi làm rõ trùng tên, ask_user một câu). */
    public static PendingQuestion single(String questionId, String turnId, UUID userId,
                                         String question, List<Option> options, boolean multiSelect) {
        return new PendingQuestion(questionId, turnId, userId, List.of(new Item(question, options, multiSelect)));
    }

    /** Câu hỏi đọc được bằng một dòng: câu đầu, hoặc các câu nối nhau khi thẻ có nhiều câu. */
    public String question() {
        return items.size() == 1 ? items.get(0).question()
                : items.stream().map(Item::question).collect(Collectors.joining(" / "));
    }

    /** Lựa chọn của câu đầu tiên — nơi dùng cũ (nút bấm dự phòng ở đường JSON) chỉ vẽ một hàng. */
    public List<Option> options() {
        return items.get(0).options();
    }

    /**
     * Một câu hỏi trong thẻ.
     *
     * @param options     lựa chọn bấm được; rỗng = hỏi mở (chỉ có ô tự nhập)
     * @param multiSelect được chọn nhiều lựa chọn (vd chọn các đơn vị cần so sánh)
     */
    public record Item(String question, List<Option> options, boolean multiSelect) {
        public Item {
            options = options == null ? List.of() : List.copyOf(options);
        }
    }

    /**
     * Một lựa chọn: {@code label} để người đọc, {@code value} để gửi lại cho model (có thể là id),
     * {@code description} là dòng phụ giúp phân biệt hai lựa chọn trùng tên.
     */
    public record Option(String value, String label, String description) {
        public static Option of(String value, String label) {
            return new Option(value, label, null);
        }
    }
}
