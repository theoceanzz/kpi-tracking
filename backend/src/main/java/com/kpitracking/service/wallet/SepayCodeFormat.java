package com.kpitracking.service.wallet;

import java.security.SecureRandom;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Mã đối soát nằm trong nội dung chuyển khoản — NGUỒN SỰ THẬT DUY NHẤT cho cả
 * việc sinh mã lẫn việc trích mã ra khỏi nội dung webhook.
 *
 * <p><b>Vì sao phải gom vào một class.</b> Bộ sinh và bộ regex nằm ở hai file
 * khác nhau là cách chắc chắn nhất để chúng lệch nhau, và khi lệch thì MỌI
 * webhook thật đều rơi vào trạng thái không khớp — lỗi chỉ lộ ra khi đã có tiền
 * thật chạy qua. Đặt cạnh nhau ở đây, cộng với bài kiểm thử sinh hàng loạt mã rồi
 * đối chiếu với {@link #PATTERN}, là chốt chặn duy nhất chống lệch.
 *
 * <p>Trên dashboard SePay cần đặt tiền tố mã đối soát là {@value #PREFIX} để SePay
 * tự điền sẵn trường {@code code} trong payload.
 */
public final class SepayCodeFormat {

    private SepayCodeFormat() {}

    public static final String PREFIX = "NAP";

    public static final int BODY_LENGTH = 8;

    /**
     * Bỏ {@code 0}, {@code 1}, {@code I}, {@code O}: người dùng phải gõ tay mã này
     * vào nội dung chuyển khoản trên app ngân hàng, và bốn ký tự đó là nguồn gõ
     * nhầm phổ biến nhất.
     */
    public static final String ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

    /**
     * Khớp CHÍNH XÁC bộ ký tự của {@link #ALPHABET} — {@code [2-9A-HJ-NP-Z]} là
     * đúng tập đó viết dưới dạng khoảng. Tìm trong chuỗi chứ không so bằng toàn
     * phần, vì ngân hàng thường chèn thêm chữ vào nội dung chuyển khoản.
     */
    public static final Pattern PATTERN = Pattern.compile(PREFIX + "[2-9A-HJ-NP-Z]{" + BODY_LENGTH + "}");

    /** Độ dài mã đầy đủ: {@value #PREFIX} + {@value #BODY_LENGTH} ký tự. */
    public static final int TOTAL_LENGTH = 3 + BODY_LENGTH;

    private static final SecureRandom RANDOM = new SecureRandom();

    public static String generate() {
        StringBuilder sb = new StringBuilder(TOTAL_LENGTH).append(PREFIX);
        for (int i = 0; i < BODY_LENGTH; i++) {
            sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }

    /**
     * Trích mã đơn từ một chuỗi bất kỳ. Dùng cho cả trường {@code code} mà SePay
     * đã tách sẵn lẫn trường {@code content} thô khi SePay không tách được.
     */
    public static Optional<String> extractFrom(String text) {
        if (text == null || text.isBlank()) {
            return Optional.empty();
        }
        Matcher m = PATTERN.matcher(text.toUpperCase());
        return m.find() ? Optional.of(m.group()) : Optional.empty();
    }
}
