package com.kpitracking.advisor;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Test cho bộ lọc câu trả lời.
 *
 * <p>Trọng tâm là chỗ đã gây ra lỗi thật người dùng nhìn thấy: gạch đầu dòng bên trong ô bảng bị
 * nối thành một chuỗi chạy dài {@code "• A / • B / • C"}. Bảng Markdown không cho xuống dòng thật
 * trong ô, nên phải có một dấu phân cách riêng — và test này khoá lại chính hợp đồng đó.
 */
class ResponseSanitizingAdvisorTest {

    private final ResponseSanitizingAdvisor sanitizer =
            new ResponseSanitizingAdvisor(List.of("get_people", "get_org_unit"));

    private static final String NL = ResponseSanitizingAdvisor.CELL_LINE_BREAK;

    // ════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("gạch đầu dòng trong ô bảng thành nhiều DÒNG, không phải chuỗi nối bằng ' / '")
    void bulletsInsideTableCellBecomeLineBreaks() {
        String answer = """
                | Trưởng phòng | Nhân viên |
                |---|---|
                | • Xây dựng chiến lược<br>• Phê duyệt KPI | • Thực hiện KPI<br>• Báo cáo |
                """;

        String out = sanitizer.sanitizeText(answer);

        assertThat(out)
                .as("chuỗi ' / ' chính là thứ người dùng không đọc nổi")
                .doesNotContain(" / ");
        assertThat(out).contains("• Xây dựng chiến lược" + NL + "• Phê duyệt KPI");
        assertThat(out).contains("• Thực hiện KPI" + NL + "• Báo cáo");
    }

    @Test
    @DisplayName("dấu phân cách KHÔNG được làm vỡ bảng — mỗi dòng vẫn đủ số cột")
    void separatorKeepsTableIntact() {
        String answer = """
                | Đơn vị | Trách nhiệm |
                |---|---|
                | Team A | • Một<br>• Hai<br>• Ba |
                """;

        String out = sanitizer.sanitizeText(answer);

        for (String line : out.split("\n")) {
            if (line.isBlank()) continue;
            assertThat(line)
                    .as("mọi dòng phải còn nguyên là dòng bảng: %s", line)
                    .startsWith("|");
            assertThat(line.chars().filter(c -> c == '|').count())
                    .as("số cột không đổi: %s", line)
                    .isEqualTo(3);
        }
    }

    @Test
    @DisplayName("<br> NGOÀI bảng vẫn thành xuống dòng thật")
    void breaksOutsideTableStayRealNewlines() {
        String out = sanitizer.sanitizeText("Dòng một<br>Dòng hai");

        assertThat(out).isEqualTo("Dòng một\nDòng hai");
        assertThat(out).doesNotContain(NL);
    }

    @Test
    @DisplayName("dòng dữ liệu THIẾU dấu | mở đầu vẫn được vá — không phá hành vi sẵn có")
    void stillRepairsBrokenTableRows() {
        // Model nhỏ hay viết "1." thay cho dấu | mở đầu, khiến bảng vỡ đôi khi render.
        String answer = """
                | Đơn vị | Số người |
                |---|---|
                1. Team A | 3 |
                """;

        String out = sanitizer.sanitizeText(answer);

        assertThat(out).contains("| Team A | 3 |");
    }

    @Test
    @DisplayName("tên tool lọt ra ngoài vẫn bị xoá — không phá hành vi sẵn có")
    void stillRedactsLeakedToolNames() {
        String out = sanitizer.sanitizeText("Tôi đã dùng công cụ `get_people` để tra cứu.");

        assertThat(out).doesNotContain("get_people");
    }
}
