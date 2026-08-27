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
 * </ul>
 *
 * <p><b>Gọi {@code proceed} nhiều lần thì khung vẫn chạy đúng, nhưng đừng làm.</b> Cửa thoát hiểm
 * từng làm thế và cái giá là chạy lại cả phần chuỗi phía sau — định tuyến lại từ đầu, dựng lại
 * prompt, bắn trùng sự kiện tiến độ, rồi phải đi dọn bộ nhớ hội thoại mà chính lần chạy lại làm
 * bẩn. Việc quay lui nay thuộc về {@link com.kpitracking.service.ai.agent.AgentGraph}, nơi nó là
 * một cạnh có điều kiện chứ không phải một lần chạy lại.
 */
@FunctionalInterface
public interface AiStageChain {

    /** Chạy phần còn lại của chuỗi và trả về câu trả lời cho người dùng. */
    String proceed(AiTurn turn);
}
