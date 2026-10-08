package com.kpitracking.service.document;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentEditServiceTest {

    @Test
    @DisplayName("Chỉ .kgdoc, .md và .txt soạn trực tiếp được")
    void formatOf() {
        assertThat(DocumentEditService.formatOf("Kế hoạch.kgdoc")).isEqualTo("blocks");
        assertThat(DocumentEditService.formatOf("Quy chế.md")).isEqualTo("markdown");
        assertThat(DocumentEditService.formatOf("ghi-chu.TXT")).isEqualTo("text");
        assertThat(DocumentEditService.formatOf("hop-dong.docx")).isNull();
        assertThat(DocumentEditService.formatOf("bang.csv")).isNull();
        assertThat(DocumentEditService.formatOf(null)).isNull();
    }

    @Test
    @DisplayName("Tên tệp từ tiêu đề giữ nguyên chữ, thay ký tự cấm — dấu / không làm mất nửa đầu tiêu đề")
    void fileNameFor() {
        assertThat(DocumentEditService.fileNameFor("Báo cáo Q1/2026")).isEqualTo("Báo cáo Q1-2026.kgdoc");
        assertThat(DocumentEditService.fileNameFor("a:b*c?\"d<e>f|g" + '\\' + "h")).isEqualTo("a-b-c--d-e-f-g-h.kgdoc");
        assertThat(DocumentEditService.fileNameFor("///")).isEqualTo("---.kgdoc");
        assertThat(DocumentEditService.fileNameFor("x".repeat(300))).hasSize(120).endsWith(".kgdoc");
    }
}
