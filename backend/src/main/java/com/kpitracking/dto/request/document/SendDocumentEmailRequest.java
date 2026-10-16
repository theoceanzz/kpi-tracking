package com.kpitracking.dto.request.document;

import java.util.List;

/**
 * Thư gửi tài liệu cho người khác (kể cả người ngoài hệ thống). Tài liệu đi kèm dưới dạng link công khai có hạn dùng.
 *
 * @param to            người nhận (ít nhất một)
 * @param cc            đồng gửi, có thể trống
 * @param message       lời nhắn dạng chữ thuần — để kiểm độ dài, và là nội dung thư khi không có {@code messageDoc}
 * @param messageDoc    lời nhắn có định dạng: mảng khối BlockNote (JSON) (không phải HTML — máy chủ tự dựng HTML)
 * @param expiresInDays số ngày link còn mở được; bỏ trống = mặc định
 */
public record SendDocumentEmailRequest(List<String> to, List<String> cc, String subject, String message,
                                       String messageDoc, Integer expiresInDays) {}
