package com.kpitracking.service.wallet;

/**
 * Đối chiếu tài khoản nhận tiền của webhook với tài khoản mà tổ chức đã khai
 * trong cấu hình ví — NGUỒN SỰ THẬT DUY NHẤT cho việc so số tài khoản.
 *
 * <p><b>Vì sao cần lớp này.</b> Mã đơn {@code NAPxxxxxxxx} là toàn cục, nên chỉ
 * dựa vào mã thì một giao dịch về BẤT KỲ tài khoản nào mà SePay đang theo dõi
 * cũng ghi có được cho đơn của bất kỳ tổ chức nào. Số tài khoản là thứ duy nhất
 * trong payload nói lên tiền thật sự về đâu, nên nó phải được kiểm — vừa để tách
 * tổ chức, vừa để bắt lỗi gõ nhầm số tài khoản trong cấu hình (gõ nhầm thì mã QR
 * trỏ vào tài khoản SePay không theo dõi: tiền đi thật mà không webhook nào về).
 *
 * <p>So sánh sau khi bỏ mọi ký tự không phải chữ/số: người cấu hình hay gõ
 * {@code "0123 456 789"} trong khi ngân hàng trả về {@code "0123456789"}, và một
 * dấu cách không đáng để chặn một khoản tiền thật.
 */
public final class SepayAccountMatch {

    private SepayAccountMatch() {}

    /**
     * Kết quả đối chiếu. Có ba trạng thái chứ không phải hai: KHÔNG kiểm được
     * khác hẳn với LỆCH, và gộp chúng làm một sẽ hoặc chặn oan tiền thật, hoặc
     * bỏ lọt tiền về nhầm tài khoản.
     */
    public enum Verdict {
        /** Tài khoản trong payload đúng là tài khoản tổ chức đã khai. */
        MATCHED,
        /** Tiền về một tài khoản khác hẳn — không được ghi có tự động. */
        MISMATCHED,
        /** Thiếu dữ liệu để kết luận (chưa khai cấu hình, hoặc payload không có số tài khoản). */
        UNVERIFIABLE
    }

    /**
     * @param configured số tài khoản tổ chức khai trong cấu hình ví
     * @param accountNumber trường {@code accountNumber} của payload
     * @param subAccount trường {@code subAccount} của payload — tài khoản ảo (VA).
     *        Phải so cả hai: khi dùng VA thì {@code accountNumber} là tài khoản
     *        gốc còn số in trên mã QR lại là VA, so mỗi một trường sẽ báo lệch
     *        cho đúng những giao dịch hợp lệ nhất.
     */
    public static Verdict verify(String configured, String accountNumber, String subAccount) {
        String want = normalize(configured);
        String acc = normalize(accountNumber);
        String sub = normalize(subAccount);

        if (want == null || (acc == null && sub == null)) {
            return Verdict.UNVERIFIABLE;
        }
        return want.equals(acc) || want.equals(sub) ? Verdict.MATCHED : Verdict.MISMATCHED;
    }

    /** Bỏ mọi ký tự không phải chữ/số rồi viết hoa. Trả {@code null} nếu không còn gì. */
    public static String normalize(String raw) {
        if (raw == null) return null;
        String cleaned = raw.replaceAll("[^A-Za-z0-9]", "").toUpperCase();
        return cleaned.isEmpty() ? null : cleaned;
    }
}
