package com.kpitracking.service.wallet;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Chốt chặn chống lệch giữa bộ SINH mã và bộ TRÍCH mã.
 *
 * <p>Nếu hai bên lệch nhau thì MỌI webhook thật đều rơi vào trạng thái chưa khớp,
 * và lỗi chỉ lộ ra khi đã có tiền thật chạy qua. Bài kiểm thử này là thứ duy nhất
 * bắt được điều đó trước khi lên môi trường thật.
 */
class SepayCodeFormatTest {

    @Test
    @DisplayName("Mọi mã sinh ra đều phải khớp đúng biểu thức dùng để trích mã")
    void generatedCodesAlwaysMatchPattern() {
        Set<String> seen = new HashSet<>();

        for (int i = 0; i < 1000; i++) {
            String code = SepayCodeFormat.generate();

            assertTrue(SepayCodeFormat.PATTERN.matcher(code).matches(),
                    "Mã sinh ra không khớp PATTERN: " + code);
            assertEquals(SepayCodeFormat.TOTAL_LENGTH, code.length(),
                    "Độ dài mã sai: " + code);
            assertTrue(code.startsWith(SepayCodeFormat.PREFIX));
            seen.add(code);
        }

        // Không đòi hỏi duy nhất tuyệt đối, chỉ chặn trường hợp bộ sinh hỏng và
        // trả về cùng một giá trị mãi.
        assertTrue(seen.size() > 900, "Bộ sinh mã lặp lại bất thường: " + seen.size() + "/1000");
    }

    @Test
    @DisplayName("Bảng chữ cái không được chứa ký tự dễ gõ nhầm")
    void alphabetExcludesAmbiguousCharacters() {
        for (char c : new char[]{'0', '1', 'I', 'O'}) {
            assertEquals(-1, SepayCodeFormat.ALPHABET.indexOf(c),
                    "Bảng chữ cái không được chứa '" + c + "' vì người dùng phải gõ tay mã này");
        }
    }

    @Test
    @DisplayName("Trích được mã nằm lẫn trong nội dung chuyển khoản của ngân hàng")
    void extractsCodeFromBankContent() {
        String code = SepayCodeFormat.generate();

        assertEquals(code, SepayCodeFormat.extractFrom(code).orElse(null));
        assertEquals(code, SepayCodeFormat.extractFrom(code + " CT tu NGUYEN VAN A").orElse(null));
        assertEquals(code, SepayCodeFormat.extractFrom("MBVCB.123456 " + code + " FT2508").orElse(null));
        // Ngân hàng có nơi trả nội dung viết thường.
        assertEquals(code, SepayCodeFormat.extractFrom(code.toLowerCase()).orElse(null));
    }

    @Test
    @DisplayName("Nội dung không chứa mã thì trả về rỗng thay vì đoán bừa")
    void returnsEmptyWhenNoCodePresent() {
        assertTrue(SepayCodeFormat.extractFrom(null).isEmpty());
        assertTrue(SepayCodeFormat.extractFrom("").isEmpty());
        assertTrue(SepayCodeFormat.extractFrom("chuyen tien an trua").isEmpty());
        // Đúng tiền tố nhưng thiếu ký tự thân mã.
        assertTrue(SepayCodeFormat.extractFrom("NAPABC").isEmpty());
        // Đúng độ dài nhưng chứa ký tự ngoài bảng chữ cái.
        assertTrue(SepayCodeFormat.extractFrom("NAP0000IIII").isEmpty());
    }
}
