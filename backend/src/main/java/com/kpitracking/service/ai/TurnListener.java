package com.kpitracking.service.ai;

/**
 * Nơi nhận tiến độ của một lượt hỏi, để client hiện "đang làm gì" thay vì nhìn màn hình trống.

 *
 * <p><b>Vì sao là interface chứ không phải để stage tự gọi HTTP.</b> Stage không được biết gì về
 * HTTP, SSE hay client — giữ đúng ranh giới hiện tại. {@link AiTurnPipeline} là chỗ DUY NHẤT gọi
 * các hàm ở đây, vì nó vốn đã bọc mọi stage; nhờ vậy thêm công đoạn mới được báo tiến độ miễn phí,
 * không phải nhớ gọi gì và cũng không thể quên.
 *
 * <p>Lượt không cần tiến độ (đường JSON thường) dùng {@link #NOOP} — {@code Null Object}, để
 * pipeline khỏi phải kiểm null ở mỗi chỗ phát.
 *
 * <p><b>Cài đặt KHÔNG được ném ngoại lệ.</b> Báo tiến độ là phần thêm; nó hỏng thì lượt hỏi vẫn
 * phải trả lời được. Pipeline bọc mọi lời gọi ở đây trong try/catch để chắc điều đó.
 */
public interface TurnListener {

    /** Không làm gì — dùng cho lượt không cần tiến độ. */
    TurnListener NOOP = new TurnListener() {};

    /**
     * Bắt đầu chạy một công đoạn.
     *
     * <p>Chỉ phát khi VÀO, không phát khi ra. Đồ thị agent có hai cạnh quay lui, nên một đỉnh chạy
     * được nhiều lần trong cùng một lượt; phát cả lúc ra sẽ ra thứ
     * tự lồng nhau khó hiểu. Vào lần hai thì client thấy công đoạn lặp lại — đúng sự thật là nó
     * đang chạy lại.
     *
     * @param code  tên lớp công đoạn, ổn định để client đối chiếu
     * @param label nhãn tiếng Việt để hiện cho người dùng
     */
    default void stageStarted(String code, String label) {}

    /**
     * Một mẩu chữ của câu trả lời.
     *
     * <p><b>Là BẢN XEM TRƯỚC, chưa qua lọc.</b> {@code ResponseSanitizingAdvisor} chạy trên TOÀN VĂN
     * (sửa bảng Markdown vỡ, xoá tên tool lọt ra) nên không thể lọc theo từng mẩu — một tên tool bị
     * cắt đôi qua hai mẩu sẽ lọt lưới. Client PHẢI thay bản xem trước bằng văn bản ở sự kiện kết thúc.
     */
    default void token(String chunk) {}
}
