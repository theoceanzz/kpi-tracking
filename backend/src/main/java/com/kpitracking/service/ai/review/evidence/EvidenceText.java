package com.kpitracking.service.ai.review.evidence;

/**
 * Chữ bóc được từ MỘT tệp minh chứng — hoặc lý do không bóc được.
 *
 * <p>Luật "không im lặng" (tài liệu phân tích mục 7.3): tệp nào không đọc được thì vẫn có một bản ghi
 * này với {@link #unreadableReason} để tên tệp hiện ra trong kết quả, không bị bỏ qua lặng lẽ.
 *
 * @param source    {@code TEXT} = bóc thẳng lớp chữ (tin được); {@code IMAGE} = mô hình đọc ảnh chép lại
 *                  (có thể sai — chỉ để tóm tắt, không bao giờ vào điểm)
 * @param truncated đã cắt vì quá dài; {@code text} ghi rõ đã đọc tới đâu
 */
public record EvidenceText(String fileName, String text, Source source, boolean truncated, String unreadableReason) {

    public enum Source { TEXT, IMAGE }

    public static EvidenceText read(String fileName, String text, Source source, boolean truncated) {
        return new EvidenceText(fileName, text, source, truncated, null);
    }

    public static EvidenceText unreadable(String fileName, String reason) {
        return new EvidenceText(fileName, null, null, false, reason);
    }

    public boolean readable() {
        return unreadableReason == null && text != null && !text.isBlank();
    }
}
