package com.kpitracking.ai.document.parse;

import com.kpitracking.ai.document.model.Block;
import com.kpitracking.ai.document.model.FileRef;
import com.kpitracking.ai.document.model.ParsedDocument;
import com.kpitracking.service.document.DocumentPolicy;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BlockNoteParserTest {

    private static final String DOC = """
            [
              {"id":"1","type":"heading","props":{"level":2,"textColor":"red"},
               "content":[{"type":"text","text":"Mục tiêu ","styles":{"bold":true}},{"type":"text","text":"Q1","styles":{}}],
               "children":[]},
              {"id":"2","type":"paragraph","props":{},"content":[
                 {"type":"text","text":"Xem ","styles":{}},
                 {"type":"link","href":"https://keygo.vn","content":[{"type":"text","text":"quy chế","styles":{}}]}],
               "children":[
                 {"id":"3","type":"bulletListItem","props":{},"content":[{"type":"text","text":"Ý con","styles":{}}],"children":[]}]},
              {"id":"4","type":"checkListItem","props":{"checked":true},"content":[{"type":"text","text":"Xong","styles":{}}],"children":[]},
              {"id":"5","type":"table","props":{},"content":{"type":"tableContent","rows":[
                 {"cells":[{"type":"tableCell","props":{},"content":[{"type":"text","text":"A","styles":{}}]},
                           [{"type":"text","text":"B","styles":{}}]]}]},"children":[]},
              {"id":"6","type":"image","props":{"url":"https://x/y.png","caption":"Hình 1"},"children":[]},
              {"id":"7","type":"paragraph","props":{},"content":[],"children":[]}
            ]
            """;

    @Test
    @DisplayName("Đọc khối BlockNote giữ cấu trúc: tiêu đề có cấp, liên kết, khối con, việc cần làm, bảng, chú thích ảnh")
    void parsesStructure() throws Exception {
        ParsedDocument doc = new BlockNoteParser().parse(FileRef.of("Kế hoạch.kgdoc", DOC.getBytes(StandardCharsets.UTF_8)));
        assertThat(doc.blocks()).containsExactly(
                new Block.Heading(2, "Mục tiêu Q1"),
                new Block.Paragraph("Xem quy chế"),
                new Block.Paragraph("Ý con", true),
                new Block.Paragraph("[x] Xong", true),
                new Block.TableRow(List.of("A", "B")),
                new Block.Paragraph("Hình 1"));
        assertThat(doc.hasHeadings()).isTrue();
    }

    @Test
    @DisplayName("Tài liệu trống là Unparseable, không phải lỗi")
    void emptyIsUnparseable() {
        assertThatThrownBy(() -> new BlockNoteParser().parse(FileRef.of("a.kgdoc", "[]".getBytes(StandardCharsets.UTF_8))))
                .isInstanceOf(DocumentParser.Unparseable.class);
    }

    @Test
    @DisplayName("Chính sách tệp nhận .kgdoc chỉ khi là mảng JSON")
    void policyAcceptsOnlyJsonArray() {
        assertThat(DocumentPolicy.check("a.kgdoc", "application/json", DOC.getBytes(StandardCharsets.UTF_8)).contentType())
                .isEqualTo(DocumentPolicy.ONLINE_CONTENT_TYPE);
        assertThatThrownBy(() -> DocumentPolicy.check("a.kgdoc", null, "{\"a\":1}".getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(com.kpitracking.exception.BusinessException.class);
        assertThatThrownBy(() -> DocumentPolicy.check("a.kgdoc", null, "# không phải JSON".getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(com.kpitracking.exception.BusinessException.class);
    }
}
