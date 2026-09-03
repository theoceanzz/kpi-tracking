package com.kpitracking.service.wallet;

import com.kpitracking.service.wallet.SepayAccountMatch.Verdict;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Đối chiếu số tài khoản là lớp chặn cuối giữa "tiền về đúng chỗ" và "ghi có cho
 * tổ chức khác". Sai theo hướng quá chặt thì tiền thật bị kẹt trong hàng đợi, sai
 * theo hướng quá lỏng thì mã đơn toàn cục trở thành đường ghi có xuyên tổ chức —
 * nên cả hai hướng đều phải có bài kiểm thử.
 */
class SepayAccountMatchTest {

    @Test
    @DisplayName("Khớp bất kể dấu cách và chữ hoa/thường của số tài khoản")
    void matchesIgnoringFormatting() {
        assertEquals(Verdict.MATCHED, SepayAccountMatch.verify("0123456789", "0123456789", null));
        assertEquals(Verdict.MATCHED, SepayAccountMatch.verify("0123 456 789", "0123456789", null));
        assertEquals(Verdict.MATCHED, SepayAccountMatch.verify("0123456789", "0123-456-789", null));
        assertEquals(Verdict.MATCHED, SepayAccountMatch.verify("vqr0123", "VQR0123", null));
    }

    @Test
    @DisplayName("Khớp cả khi số trên mã QR là tài khoản ảo nằm ở subAccount")
    void matchesVirtualAccount() {
        assertEquals(Verdict.MATCHED,
                SepayAccountMatch.verify("96247VQR", "0977423805", "96247VQR"));
    }

    @Test
    @DisplayName("Tài khoản khác hẳn phải báo lệch, không được ghi có tự động")
    void reportsMismatch() {
        assertEquals(Verdict.MISMATCHED,
                SepayAccountMatch.verify("0123456789", "0977423805", null));
        assertEquals(Verdict.MISMATCHED,
                SepayAccountMatch.verify("0123456789", "0977423805", "0977423806"));
        // Thiếu một chữ số vẫn là tài khoản khác — không có khái niệm khớp gần đúng.
        assertEquals(Verdict.MISMATCHED,
                SepayAccountMatch.verify("0123456789", "012345678", null));
    }

    @Test
    @DisplayName("Thiếu dữ liệu thì phải nói là không kiểm được, không được coi là lệch")
    void missingDataIsUnverifiable() {
        assertEquals(Verdict.UNVERIFIABLE, SepayAccountMatch.verify(null, "0123456789", null));
        assertEquals(Verdict.UNVERIFIABLE, SepayAccountMatch.verify("   ", "0123456789", null));
        assertEquals(Verdict.UNVERIFIABLE, SepayAccountMatch.verify("0123456789", null, null));
        assertEquals(Verdict.UNVERIFIABLE, SepayAccountMatch.verify("0123456789", "", "  "));
    }

    @Test
    @DisplayName("Chuẩn hoá phải khớp đúng biểu thức regexp_replace dùng trong SQL")
    void normalizeMatchesSqlSideRule() {
        assertEquals("0123456789", SepayAccountMatch.normalize(" 0123.456-789 "));
        assertEquals("VQR96247", SepayAccountMatch.normalize("vqr 96247"));
        assertNull(SepayAccountMatch.normalize("---"));
        assertNull(SepayAccountMatch.normalize(""));
        assertNull(SepayAccountMatch.normalize(null));
    }
}
