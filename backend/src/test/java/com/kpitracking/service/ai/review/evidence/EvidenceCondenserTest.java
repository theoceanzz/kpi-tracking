package com.kpitracking.service.ai.review.evidence;

import com.kpitracking.ai.document.model.Block;
import com.kpitracking.ai.document.model.FileRef;
import com.kpitracking.ai.document.parse.DocxParser;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tệp minh chứng dài: rút về trần mà không mất phần giải trình. Ca gốc (29/09): tệp mẫu 04 có 20 bảng đẩy mục
 * "VIII. GIẢI THÍCH KẾT QUẢ" ra sau ký tự 6.000 — cắt đầu làm AI báo "chưa giải thích nguyên nhân và kế hoạch".
 */
class EvidenceCondenserTest {

    private static List<Block> fixture04() throws Exception {
        try (InputStream in = EvidenceCondenserTest.class
                .getResourceAsStream("/fixtures/ai-review/minh-chung-dai-nhieu-bang.docx")) {
            assertThat(in).isNotNull();
            return new DocxParser().parse(FileRef.of("04.docx", in.readAllBytes())).blocks();
        }
    }

    @Test
    @DisplayName("tệp mẫu 04 ở trần 6.000: giữ đủ nguyên nhân, kế hoạch tháng 11 và kết luận; chỉ lược dòng bảng")
    void keepsExplanationOfFixture04() throws Exception {
        List<Block> blocks = fixture04();
        assertThat(EvidenceCondenser.render(blocks, -1, null).length()).isGreaterThan(6000);   // đúng ca bị cắt cũ

        EvidenceCondenser.Result r = EvidenceCondenser.condense(blocks, null, 6000);

        assertThat(r.truncated()).isTrue();
        assertThat(r.text().length()).isLessThanOrEqualTo(6000);
        assertThat(r.text())
                .contains("VIII. GIẢI THÍCH KẾT QUẢ")
                .contains("Nguyên nhân: 1. Thay đổi yêu cầu từ business")
                .contains("Sự cố hạ tầng network")
                .contains("Kế hoạch tháng 11")
                .contains("2 tính năng còn lại sẽ triển khai trong tháng 11/2026")
                .contains("X. KẾT LUẬN")
                .contains("[… bảng còn")
                .doesNotContain("đã lược đoạn giữa");
    }

    @Test
    @DisplayName("tài liệu vừa trần: giữ nguyên, không đánh dấu lược")
    void shortDocumentUntouched() {
        List<Block> blocks = List.of(new Block.Heading(1, "Báo cáo"), new Block.Paragraph("Hoàn thành 8 API.", false),
                new Block.TableRow(List.of("API", "Trạng thái")), new Block.TableRow(List.of("Tạo đơn", "Xong")));

        EvidenceCondenser.Result r = EvidenceCondenser.condense(blocks, null, 6000);

        assertThat(r.truncated()).isFalse();
        assertThat(r.text()).isEqualTo("Báo cáo\nHoàn thành 8 API.\nAPI | Trạng thái\nTạo đơn | Xong");
    }

    @Test
    @DisplayName("bảng dài: giữ tiêu đề + vài dòng đầu, đoạn văn sau bảng vẫn còn")
    void compressesTablesFirst() {
        List<Block> blocks = new ArrayList<>();
        blocks.add(new Block.TableRow(List.of("Ngày", "Uptime")));
        for (int d = 1; d <= 200; d++) blocks.add(new Block.TableRow(List.of("Ngày " + d, "99,9%")));
        blocks.add(new Block.Paragraph("Kế hoạch: bổ sung cảnh báo tự động trong tháng 11.", false));

        EvidenceCondenser.Result r = EvidenceCondenser.condense(blocks, null, 400);

        assertThat(r.text()).startsWith("Ngày | Uptime\nNgày 1 | 99,9%")
                .contains("[… bảng còn")
                .endsWith("Kế hoạch: bổ sung cảnh báo tự động trong tháng 11.");
    }

    @Test
    @DisplayName("toàn chữ vẫn quá dài: giữ đầu và CUỐI (kết luận / kế hoạch), lược đoạn giữa")
    void keepsHeadAndTailOfLongProse() {
        List<Block> blocks = new ArrayList<>();
        blocks.add(new Block.Paragraph("Mở đầu báo cáo.", false));
        for (int i = 0; i < 100; i++) blocks.add(new Block.Paragraph("Đoạn diễn giải số " + i + " về quá trình làm.", false));
        blocks.add(new Block.Paragraph("Kế hoạch tháng sau: hoàn thành 2 tính năng còn lại.", false));

        EvidenceCondenser.Result r = EvidenceCondenser.condense(blocks, null, 600);

        assertThat(r.truncated()).isTrue();
        assertThat(r.text()).startsWith("Mở đầu báo cáo.")
                .contains("[… đã lược đoạn giữa: đọc 600/")
                .endsWith("Kế hoạch tháng sau: hoàn thành 2 tính năng còn lại.");
    }
}
