package com.kpitracking.service.ai;

/**
 * Phần còn lại của chuỗi xử lý, tính từ stage hiện tại trở đi.
 *
 * <p>Một {@link AiStage} tự quyết định làm gì với nó — đó là điểm mấu chốt khiến khung này chèn
 * được cả ba dạng công đoạn:
 * <ul>
 *   <li><b>Chèn trước:</b> làm việc rồi {@code return next.proceed(turn)}</li>
 *   <li><b>Cắt ngắn:</b> trả kết quả luôn, KHÔNG gọi {@code proceed} (bộ nhớ đệm)</li>
 *   <li><b>Chạy sau:</b> {@code String answer = next.proceed(turn)} rồi mới xử lý (kiểm duyệt)</li>
 *   <li><b>Thử lại:</b> gọi {@code proceed} lần nữa (cửa thoát hiểm khi model xin thêm tool)</li>
 * </ul>
 */
@FunctionalInterface
public interface AiStageChain {

    /** Chạy phần còn lại của chuỗi và trả về câu trả lời cho người dùng. */
    String proceed(AiTurn turn);
}
