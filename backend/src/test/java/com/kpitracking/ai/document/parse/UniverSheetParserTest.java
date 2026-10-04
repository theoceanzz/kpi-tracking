package com.kpitracking.ai.document.parse;

import com.kpitracking.ai.document.model.Block;
import com.kpitracking.ai.document.model.FileRef;
import com.kpitracking.ai.document.model.ParsedDocument;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.service.document.DocumentPolicy;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UniverSheetParserTest {

    private static final String SHEET = """
            {"id":"wb","name":"KPI","sheetOrder":["s2","s1"],
             "sheets":{
               "s1":{"id":"s1","name":"Trống","cellData":{}},
               "s2":{"id":"s2","name":"Chỉ tiêu","cellData":{
                 "0":{"0":{"v":"Chỉ tiêu","t":1},"1":{"v":"Trọng số","t":1}},
                 "1":{"0":{"v":"Doanh thu"},"1":{"v":40,"t":2}},
                 "2":{"0":{"v":"Tổng"},"1":{"f":"=SUM(B2:B2)","v":40.5,"t":2},"3":{"v":"ghi chú"}},
                 "5":{"1":{"v":""}}
               }}
             }}
            """;

    @Test
    @DisplayName("Đọc bảng tính Univer theo khuôn của tệp Excel: tiêu đề trang tính, dòng bảng, giá trị công thức")
    void parsesLikeExcel() throws Exception {
        ParsedDocument doc = new UniverSheetParser().parse(FileRef.of("KPI.kgsheet", SHEET.getBytes(StandardCharsets.UTF_8)));
        assertThat(doc.format()).isEqualTo("xlsx");
        assertThat(doc.blocks()).containsExactly(
                new Block.Heading(1, SpreadsheetParser.SHEET_PREFIX + "Chỉ tiêu"),
                new Block.TableRow(List.of("Chỉ tiêu", "Trọng số")),
                new Block.TableRow(List.of("Doanh thu", "40")),
                new Block.TableRow(List.of("Tổng", "40.5", "", "ghi chú")));
    }

    @Test
    @DisplayName("Bảng tính trống là Unparseable")
    void emptyIsUnparseable() {
        assertThatThrownBy(() -> new UniverSheetParser().parse(FileRef.of("a.kgsheet", "{}".getBytes(StandardCharsets.UTF_8))))
                .isInstanceOf(DocumentParser.Unparseable.class);
    }

    @Test
    @DisplayName("Chính sách tệp nhận .kgsheet chỉ khi là đối tượng JSON")
    void policyAcceptsOnlyJsonObject() {
        assertThat(DocumentPolicy.check("a.kgsheet", "application/json", SHEET.getBytes(StandardCharsets.UTF_8)).contentType())
                .isEqualTo(DocumentPolicy.ONLINE_SHEET_CONTENT_TYPE);
        assertThatThrownBy(() -> DocumentPolicy.check("a.kgsheet", null, "[]".getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(BusinessException.class);
    }
}
