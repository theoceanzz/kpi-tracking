package com.kpitracking.ai.document.profile;

import com.kpitracking.ai.document.model.Block;
import com.kpitracking.ai.document.model.ParsedDocument;
import com.kpitracking.ai.document.section.HeadingSectioning;
import com.kpitracking.ai.document.section.LegalStructureSectioning;
import com.kpitracking.ai.document.section.SheetSectioning;
import com.kpitracking.ai.document.section.SizeSectioning;
import com.kpitracking.entity.RagDocument;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Chọn phương án xử lý theo LOẠI tài liệu: khai rõ thì theo loại đó, không thì tự nhận ra (bóc bộ tiêu chí).
 * Mỗi loại tự chọn cách cắt mục hợp với nội dung.
 */
class DocumentProfileRegistryTest {

    private final DocumentProfileRegistry registry = new DocumentProfileRegistry(List.of(
            new DocumentProfiles.GuideProfile(), new DocumentProfiles.RegulationProfile(),
            new DocumentProfiles.JobDescriptionProfile(), new DocumentProfiles.StrategyProfile(),
            new DocumentProfiles.KpiTableProfile(), new DocumentProfiles.GenericProfile(),
            new DocumentProfiles.EvidenceProfile()));

    private static ParsedDocument text(String name, String body) {
        return ParsedDocument.fromText(name, body);
    }

    @Test
    @DisplayName("quy chế có nhiều 'Điều N.' → Regulation, cắt theo điều")
    void regulationDetected() {
        ParsedDocument doc = text("qc.pdf", "QUY ĐỊNH\nĐiều 1. Mục đích\nabc\nĐiều 2. Phạm vi\nabc\nĐiều 3. Đánh giá\nabc");

        DocumentProfile p = registry.detectForCriteria(doc);

        assertThat(p.kind()).isEqualTo(DocumentKind.REGULATION);
        assertThat(p.sectioning(doc)).isSameAs(LegalStructureSectioning.INSTANCE);
    }

    @Test
    @DisplayName("Excel có cột 'Trọng số' + 'Chỉ tiêu' → bảng KPI, cắt theo trang tính, chỉ căn cứ + thang mức")
    void kpiTableDetected() {
        ParsedDocument doc = new ParsedDocument("kpi.xlsx", "xlsx", List.of(
                new Block.Heading(1, "Trang tính: Tài chính"),
                new Block.TableRow(List.of("Chỉ tiêu", "Trọng số", "Mục tiêu")),
                new Block.TableRow(List.of("Doanh thu", "40%", "10 tỷ"))), ParsedDocument.TextSource.TEXT, false, null);

        DocumentProfile p = registry.detectForCriteria(doc);

        assertThat(p.kind()).isEqualTo(DocumentKind.KPI_TABLE);
        assertThat(p.sectioning(doc)).isSameAs(SheetSectioning.INSTANCE);
        assertThat(p.criteriaScheme().roles()).extracting(CriteriaScheme.Role::code).containsExactly("TIEU_CHI", "THANG_MUC");
    }

    @Test
    @DisplayName("mô tả công việc → không có căn cứ chấm; không nhận ra gì → loại chung, cắt theo tiêu đề / độ dài")
    void jobDescriptionAndFallback() {
        assertThat(registry.detectForCriteria(text("jd.docx", "BẢN MÔ TẢ CÔNG VIỆC\nChức danh: Kế toán")).kind())
                .isEqualTo(DocumentKind.JOB_DESCRIPTION);

        ParsedDocument plain = text("ghi-chu.txt", "Một ghi chú không có cấu trúc gì.");
        DocumentProfile p = registry.detectForCriteria(plain);
        assertThat(p.kind()).isEqualTo(DocumentKind.GENERIC);
        assertThat(p.sectioning(plain)).isSameAs(SizeSectioning.INSTANCE);

        ParsedDocument withHeadings = new ParsedDocument("h.docx", "docx",
                List.of(new Block.Heading(1, "Phần 1"), new Block.Paragraph("abc")), ParsedDocument.TextSource.TEXT, false, null);
        assertThat(p.sectioning(withHeadings)).isSameAs(HeadingSectioning.INSTANCE);
    }

    @Test
    @DisplayName("loại khai rõ / đã lưu: theo nguồn kho tri thức và theo tên; tên lạ → loại chung")
    void byKindSourceAndName() {
        assertThat(registry.forSource(RagDocument.Source.GUIDE).kind()).isEqualTo(DocumentKind.GUIDE);
        assertThat(registry.forName("KPI_TABLE").kind()).isEqualTo(DocumentKind.KPI_TABLE);
        assertThat(registry.forName("KHONG_CO").kind()).isEqualTo(DocumentKind.GENERIC);
        assertThat(registry.forKind(DocumentKind.EVIDENCE).indexPolicy()).isEqualTo(DocumentProfile.IndexPolicy.NO_INDEX);
    }

    @Test
    @DisplayName("hai profile cùng một loại → lỗi ngay lúc khởi động")
    void duplicateKindRejected() {
        assertThatThrownBy(() -> new DocumentProfileRegistry(List.of(new DocumentProfiles.GenericProfile(),
                new DocumentProfiles.GenericProfile()))).isInstanceOf(IllegalStateException.class);
    }
}
