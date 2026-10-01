package com.kpitracking.ai.document.section;

import com.kpitracking.ai.document.model.DocumentSection;
import com.kpitracking.service.ai.review.CriteriaExtractor;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Quy chế tự do phải được cắt theo Chương / Điều / Phụ lục — mỗi mục bóc riêng để mô hình chép trọn thay vì
 * nén cả tài liệu (lỗi "mất thông tin" khi bóc quy chế 17 trang). Và đoạn gốc có "…" vẫn kiểm được.
 */
class LegalStructureSectioningTest {

    private static final String DOC = """
            QUY ĐỊNH
            PHÂN CÔNG CHỨC NĂNG, NHIỆM VỤ
            Điều 1. Mục đích
            1. Xác định rõ chức năng, nhiệm vụ và trách nhiệm đầu mối của các nhóm chức năng và cá nhân trong Công ty.
            2. Hạn chế chồng chéo, bỏ sót công việc hoặc không xác định được người chịu trách nhiệm.
            3. Tăng cường phối hợp giữa các nhóm trong hoạt động kinh doanh, triển khai dự án, phát triển sản phẩm.
            Trang 2
            CHƯƠNG IV. LẬP KẾ HOẠCH VÀ ĐÁNH GIÁ CÔNG VIỆC TRÊN KEYGO
            Điều 10. Đánh giá kết quả công việc
            1. Người quản lý, Project Owner hoặc người được giao thẩm quyền thực hiện đánh giá trên cơ sở: mức độ hoàn
            thành mục tiêu; chất lượng sản phẩm đầu ra; tiến độ; mức độ chủ động; mức độ phối hợp; kết quả thực tế.
            2. Việc đánh giá được thực hiện trên KeyGo theo hệ thống thang đánh giá do Công ty quy định.
            3. Mức “Hoàn thành” là mức tối thiểu được xác định là đáp ứng yêu cầu công việc.
            PHỤ LỤC 02
            PHIẾU XÁC ĐỊNH VÀ PHÂN BỔ THƯỞNG DỰ ÁN
            Phụ lục này dùng để xác định quỹ thưởng và phân bổ thưởng cho từng dự án đã nghiệm thu.
            I. THÔNG TIN DỰ ÁN
            Tên dự án, khách hàng, Project Owner, thời gian thực hiện, doanh thu dự án, chi phí trực tiếp, lợi nhuận gộp,
            tình trạng nghiệm thu và tình trạng thanh toán của khách hàng đối với dự án đang xét thưởng.
            V. PHÂN BỔ THƯỞNG CHO CÁ NHÂN
            Mức A – Đóng góp đặc biệt: Vai trò then chốt, ảnh hưởng trực tiếp và đáng kể đến kết quả dự án.
            Mức B – Đóng góp cao: Hoàn thành tốt phần việc quan trọng, chủ động và tạo giá trị rõ rệt.
            Mức C – Đóng góp đạt yêu cầu: Hoàn thành đầy đủ phần việc được giao, đảm bảo chất lượng và tiến độ.
            """;

    @Test
    @DisplayName("cắt theo Điều và mục La Mã trong phụ lục; mục mang tên chương; bỏ dòng số trang")
    void splitsByArticleAndAppendixSections() {
        List<DocumentSection> s = LegalStructureSectioning.split(DOC);

        assertThat(s).extracting(DocumentSection::title)
                .contains("Điều 1. Mục đích", "Điều 10. Đánh giá kết quả công việc",
                        "I. THÔNG TIN DỰ ÁN", "V. PHÂN BỔ THƯỞNG CHO CÁ NHÂN");
        DocumentSection art10 = s.stream()
                .filter(x -> x.title().startsWith("Điều 10")).findFirst().orElseThrow();
        assertThat(art10.label()).startsWith("CHƯƠNG IV").endsWith("Điều 10. Đánh giá kết quả công việc");
        assertThat(art10.text()).contains("Mức “Hoàn thành” là mức tối thiểu");
        assertThat(s).allSatisfy(x -> assertThat(x.text()).doesNotContain("Trang 2"));
        assertThat(s).extracting(DocumentSection::title).noneMatch(t -> t.startsWith("Phụ lục này"));
        // Không mất chữ nào: mọi dòng nội dung đều nằm trong đúng một mục.
        assertThat(String.join("\n", s.stream().map(DocumentSection::text).toList()))
                .contains("Mức C – Đóng góp đạt yêu cầu");
    }

    @Test
    @DisplayName("mục ngắn gộp vào mục sau: tên ghi đủ các mục đã gộp (không để nội dung Điều 1 mang nhãn Điều 2)")
    void mergedSectionNamesAllArticles() {
        String doc = """
                Điều 1. Ban hành kèm theo Quyết định này Quy định phân công.
                Điều 2. Các cá nhân, nhóm chức năng và đơn vị có liên quan chịu trách nhiệm thi hành Quyết định này
                và Quy định ban hành kèm theo; người phụ trách từng nhóm tổ chức phổ biến tới toàn bộ nhân sự của nhóm,
                theo dõi việc thực hiện và báo cáo vướng mắc để Ban lãnh đạo điều chỉnh kịp thời khi cần thiết.
                """;

        List<DocumentSection> s = LegalStructureSectioning.split(doc);

        assertThat(s).singleElement().satisfies(x -> assertThat(x.title())
                .startsWith("Điều 1. Ban hành").contains(" · Điều 2. Các cá nhân"));
    }

    @Test
    @DisplayName("tiêu đề chương / phụ lục xuống dòng trong PDF → nối dòng viết HOA kế tiếp vào tên; không nối Điều, dòng thường")
    void wrappedHeadingsJoined() {
        String pdf = """
                CHƯƠNG IV. LẬP KẾ HOẠCH VÀ ĐÁNH GIÁ CÔNG VIỆC TRÊN
                KEYGO
                Điều 10. Đánh giá kết quả công việc
                1. Người quản lý, Project Owner hoặc người được giao thẩm quyền thực hiện đánh giá trên cơ sở: mức độ hoàn
                thành mục tiêu; chất lượng sản phẩm đầu ra; tiến độ; mức độ chủ động; mức độ phối hợp; kết quả thực tế.
                2. Việc đánh giá được thực hiện trên KeyGo theo hệ thống thang đánh giá do Công ty quy định.
                PHỤ LỤC 02
                PHIẾU XÁC ĐỊNH VÀ PHÂN BỔ THƯỞNG DỰ ÁN
                (Kèm theo Quy định phân công chức năng, nhiệm vụ và cơ chế phối hợp công việc)
                I. THÔNG TIN DỰ ÁN
                Tên dự án, khách hàng, Project Owner, thời gian thực hiện, doanh thu dự án, chi phí trực tiếp.
                """;

        List<DocumentSection> s = LegalStructureSectioning.split(pdf);

        assertThat(s).extracting(x -> x.path().get(0)).containsExactly(
                "CHƯƠNG IV. LẬP KẾ HOẠCH VÀ ĐÁNH GIÁ CÔNG VIỆC TRÊN KEYGO",
                "PHỤ LỤC 02. PHIẾU XÁC ĐỊNH VÀ PHÂN BỔ THƯỞNG DỰ ÁN");
        assertThat(s.get(0).text()).contains("KEYGO");   // dòng nối vẫn ở trong nội dung
        assertThat(LegalStructureSectioning.withContinuation("CHƯƠNG I. QUY ĐỊNH CHUNG", "ĐIỀU 1. PHẠM VI"))
                .isEqualTo("CHƯƠNG I. QUY ĐỊNH CHUNG");
        assertThat(LegalStructureSectioning.withContinuation("PHỤ LỤC 01", "(Kèm theo quy định)")).isEqualTo("PHỤ LỤC 01");
        assertThat(LegalStructureSectioning.withContinuation("PHỤ LỤC 01", "PHỤ LỤC 02")).isEqualTo("PHỤ LỤC 01");
    }

    @Test
    @DisplayName("không có tiêu đề nào (bảng, văn bản trơn) -> chia theo độ dài, không mục nào quá trần")
    void noHeadingsFallsBackToSize() {
        String plain = ("Dòng nội dung không đánh số tiêu đề nào cả, lặp lại cho đủ dài.\n").repeat(200);

        List<DocumentSection> s = LegalStructureSectioning.split(plain);

        assertThat(s.size()).isGreaterThan(1);
        assertThat(s).allSatisfy(x -> assertThat(x.text().length()).isLessThanOrEqualTo(SizeSectioning.MAX_CHARS));
    }

    @Test
    @DisplayName("đoạn gốc: bỏ qua khác biệt khoảng trắng / dấu đầu dòng; '…' được phép nếu các mảnh đúng thứ tự")
    void excerptMatchingToleratesEllipsisAndBullets() {
        String hay = CriteriaExtractor.compact("Quỹ thưởng có thể được xác định theo:\n•Một khoản tiền cố định;\n"
                + "•Một tỷ lệ trên doanh thu;\n•Một tỷ lệ trên lợi nhuận hoặc lợi nhuận gộp;");

        assertThat(CriteriaExtractor.excerptFound(hay, "• Một khoản tiền cố định; • Một tỷ lệ trên doanh thu")).isTrue();
        assertThat(CriteriaExtractor.excerptFound(hay, "Quỹ thưởng có thể được xác định … lợi nhuận gộp")).isTrue();
        assertThat(CriteriaExtractor.excerptFound(hay, "lợi nhuận gộp … Quỹ thưởng có thể")).isFalse();   // sai thứ tự
        assertThat(CriteriaExtractor.excerptFound(hay, "Một tỷ lệ trên chi phí")).isFalse();              // bịa
    }

    @Test
    @DisplayName("đoạn trích vắt qua ranh giới trang vẫn khớp — so trên chữ đã bỏ dòng 'Trang N' (bản mô hình đọc)")
    void excerptAcrossPageBreak() {
        String pdf = "•Một tỷ lệ trên lợi nhuận hoặc lợi nhuận gộp;\nTrang 7\n•Một phần ngân sách thưởng được phê duyệt;";
        String excerpt = "Một tỷ lệ trên lợi nhuận hoặc lợi nhuận gộp; Một phần ngân sách thưởng được phê duyệt;";

        assertThat(CriteriaExtractor.excerptFound(CriteriaExtractor.compact(pdf), excerpt)).isFalse();
        assertThat(CriteriaExtractor.excerptFound(
                CriteriaExtractor.compact(LegalStructureSectioning.withoutPageMarkers(pdf)), excerpt)).isTrue();
    }
}
