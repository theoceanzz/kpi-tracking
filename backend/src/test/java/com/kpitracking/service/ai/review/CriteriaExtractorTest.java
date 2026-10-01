package com.kpitracking.service.ai.review;

import com.kpitracking.ai.agent.CriteriaExtractionAgent;
import com.kpitracking.ai.document.model.DocumentSection;
import com.kpitracking.ai.document.profile.CriteriaScheme;
import com.kpitracking.ai.document.profile.DocumentProfiles;
import com.kpitracking.ai.document.section.LegalStructureSectioning;
import dev.langchain4j.model.output.TokenUsage;
import dev.langchain4j.service.Result;
import org.assertj.core.groups.Tuple;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bóc ĐẦY ĐỦ mọi mục, mỗi dòng một VAI TRÒ (trong phạm vi loại tài liệu cho phép) và một CHỦ ĐỀ lấy từ chính
 * tài liệu — tài liệu 3 chương ra 3 nhóm, dòng của mục thưởng không bao giờ lọt vào căn cứ chấm.
 */
class CriteriaExtractorTest {

    private static final String DOC = """
            CHƯƠNG II. CHỨC NĂNG, NHIỆM VỤ CÁC NHÓM
            Điều 4. Nhóm Truyền thông & Thương hiệu
            a) Xây dựng và triển khai kế hoạch truyền thông, nội dung theo tuần, tháng, quý hoặc từng chiến dịch.
            b) Quản trị hình ảnh và nhận diện thương hiệu của Công ty, các sản phẩm, dịch vụ và dự án.
            c) Quản trị và phát triển các kênh truyền thông như website, Facebook, LinkedIn, TikTok.
            CHƯƠNG IV. LẬP KẾ HOẠCH VÀ ĐÁNH GIÁ CÔNG VIỆC TRÊN KEYGO
            Điều 10. Đánh giá kết quả công việc
            1. Người quản lý thực hiện đánh giá trên KeyGo trên cơ sở: mức độ hoàn thành mục tiêu; chất lượng sản
            phẩm đầu ra; tiến độ; mức độ chủ động; mức độ phối hợp; kết quả thực tế mang lại cho khách hàng.
            CHƯƠNG V. CƠ CHẾ THƯỞNG DỰ ÁN
            Điều 13. Phân bổ thưởng giữa các nhóm chức năng
            Các yếu tố xem xét bao gồm: đóng góp tạo lập cơ hội kinh doanh; phát triển và chốt khách hàng; khối
            lượng công việc; mức độ phức tạp; trách nhiệm triển khai; đóng góp chuyên môn; hiệu quả kinh tế.
            """;

    private static final CriteriaScheme REGULATION = new DocumentProfiles.RegulationProfile().criteriaScheme();

    private CriteriaExtractionAgent agent;
    private CriteriaExtractor extractor;

    private static Result<String> json(String s) {
        return Result.<String>builder().content(s).tokenUsage(new TokenUsage(10, 5)).build();
    }

    @BeforeEach
    void setUp() {
        agent = mock(CriteriaExtractionAgent.class);
        extractor = new CriteriaExtractor(agent, 2, 10);
    }

    @AfterEach
    void tearDown() {
        extractor.shutdown();
    }

    @Test
    @DisplayName("vai trò theo chủ đề mục + scheme: thưởng/tổ chức → tra cứu; căn cứ ngoài mục đánh giá → AI đọc; vai trò ngoài scheme → dự phòng")
    void roleFollowsSectionTopicAndScheme() {
        assertThat(CriteriaExtractor.roleFor("THUONG", "TIEU_CHI", REGULATION)).isEqualTo("TRA_CUU");
        assertThat(CriteriaExtractor.roleFor("TO_CHUC", "THAM_KHAO", REGULATION)).isEqualTo("TRA_CUU");
        assertThat(CriteriaExtractor.roleFor("KHAC", "THANG_MUC", REGULATION)).isEqualTo("THAM_KHAO");
        assertThat(CriteriaExtractor.roleFor("KHAC", "THAM_KHAO", REGULATION)).isEqualTo("THAM_KHAO");
        assertThat(CriteriaExtractor.roleFor("DANH_GIA", "TIEU_CHI", REGULATION)).isEqualTo("TIEU_CHI");
        assertThat(CriteriaExtractor.roleFor(null, "TIEU_CHI", REGULATION)).isEqualTo("TIEU_CHI");
        // Mô tả công việc không có căn cứ chấm → hạ về vai trò dự phòng của nó.
        CriteriaScheme jd = new DocumentProfiles.JobDescriptionProfile().criteriaScheme();
        assertThat(CriteriaExtractor.roleFor("DANH_GIA", "TIEU_CHI", jd)).isEqualTo("TRA_CUU");
    }

    @Test
    @DisplayName("nhiều dòng trùng một tên chung, mỗi dòng một ý -> lấy ý làm tên; tên riêng giữ nguyên")
    void repeatedGenericNamesBecomeTheItem() {
        var rows = List.of(
                new CriteriaExtractor.Row("TIEU_CHI", "Tiêu chí đánh giá", null, null, List.of("tiến độ"), null, null, "Điều 10"),
                new CriteriaExtractor.Row("TIEU_CHI", "Tiêu chí đánh giá", null, null, List.of("mức độ chủ động"), null, null, "Điều 10"),
                new CriteriaExtractor.Row("THANG_MUC", "Mức Hoàn thành", null, null, List.of("Hoàn thành"), null, null, "Điều 10"));

        assertThat(CriteriaExtractor.distinctNames(rows)).extracting(CriteriaExtractor.Row::ten)
                .containsExactly("Tiến độ", "Mức độ chủ động", "Mức Hoàn thành");
    }

    @Test
    @DisplayName("tài liệu 3 chương → 3 chủ đề (tên chương, bỏ số, hạ chữ HOA, giữ 'KeyGo'); vai trò đúng; tên trống → lấy nội dung")
    void everySectionKeptWithTopicPerChapter() {
        when(agent.extract(contains("Điều 4"))).thenReturn(json("""
                {"chuDe":"TO_CHUC","nhom":"Nhiệm vụ bộ phận","dong":[{"loai":"TRA_CUU","ten":"Nhiệm vụ Nhóm Truyền thông",
                 "cacMuc":["Xây dựng và triển khai kế hoạch truyền thông","Quản trị hình ảnh"],"phamVi":"Nhóm Truyền thông",
                 "doanGoc":"Xây dựng và triển khai kế hoạch truyền thông"}]}"""));
        when(agent.extract(contains("Điều 10"))).thenReturn(json("""
                {"chuDe":"DANH_GIA","nhom":"Đánh giá","dong":[{"loai":"TIEU_CHI","ten":"Tiến độ","doanGoc":"trên cơ sở: … tiến độ"}]}"""));
        when(agent.extract(contains("Điều 13"))).thenReturn(json("""
                {"chuDe":"THUONG","nhom":"Thưởng","dong":[{"loai":"TIEU_CHI","ten":"Yếu tố xét phân bổ thưởng",
                 "cacMuc":["đóng góp tạo lập cơ hội kinh doanh"],"doanGoc":"Các yếu tố xem xét bao gồm"},
                 {"loai":"TRA_CUU","ten":"","moTa":"Không áp dụng nguyên tắc chia đều giữa các nhóm.","doanGoc":""},
                 {"loai":"TRA_CUU","ten":"","moTa":"","cacMuc":[]}]}"""));
        List<DocumentSection> sections = LegalStructureSectioning.split(DOC);

        CriteriaExtractor.Outcome out = extractor.extract("Quy định", sections, REGULATION, DOC);

        assertThat(out.failed()).isEmpty();
        assertThat(out.skipped()).isEmpty();
        assertThat(out.rows()).extracting(CriteriaExtractor.Row::ten, CriteriaExtractor.Row::kind, CriteriaExtractor.Row::topic)
                .containsExactly(
                        Tuple.tuple("Nhiệm vụ Nhóm Truyền thông", "TRA_CUU", "Chức năng, nhiệm vụ các nhóm"),
                        Tuple.tuple("Tiến độ", "TIEU_CHI", "Lập kế hoạch và đánh giá công việc trên KeyGo"),
                        Tuple.tuple("Yếu tố xét phân bổ thưởng", "TRA_CUU", "Cơ chế thưởng dự án"),
                        Tuple.tuple("Không áp dụng nguyên tắc chia đều giữa các nhóm.", "TRA_CUU", "Cơ chế thưởng dự án"));
    }

    @Test
    @DisplayName("phụ lục có tên → chủ đề là tên phụ lục; phụ lục chỉ có số → nhãn mô hình")
    void appendixTitleIsTopic() {
        TopicNames names = new TopicNames("Phiếu dùng cho từng dự án.");
        DocumentSection titled = new DocumentSection(
                List.of("PHỤ LỤC 02. PHIẾU XÁC ĐỊNH VÀ PHÂN BỔ THƯỞNG DỰ ÁN", "I. THÔNG TIN DỰ ÁN"), "…");
        DocumentSection bare = new DocumentSection(List.of("PHỤ LỤC 03", "Danh sách"), "…");

        assertThat(CriteriaExtractor.topicOf(titled, "Thông tin dự án", REGULATION, names))
                .isEqualTo("Phiếu xác định và phân bổ thưởng dự án");
        assertThat(CriteriaExtractor.topicOf(bare, "Danh sách nhân sự", REGULATION, names)).isEqualTo("Danh sách nhân sự");
        DocumentSection whole = new DocumentSection(List.of("PHỤ LỤC 01. MA TRẬN PHÂN CÔNG NHÂN SỰ VÀ TRÁCH NHIỆM"), "…");
        assertThat(CriteriaExtractor.topicOf(whole, "Phân công nhân sự", REGULATION, names))
                .isEqualTo("Ma trận phân công nhân sự và trách nhiệm");
    }

    @Test
    @DisplayName("tài liệu có chương: các mục trước chương đầu (quyết định ban hành, mục đích) chung chủ đề 'Phần mở đầu'")
    void sectionsBeforeFirstChapterSharePreambleTopic() {
        String doc = """
                QUYẾT ĐỊNH
                Điều 1. Ban hành kèm theo Quyết định này Quy định phân công chức năng, nhiệm vụ và cơ chế phối hợp công việc
                của Công ty và các Phụ lục kèm theo; các cá nhân, nhóm chức năng và đơn vị có liên quan chịu trách nhiệm thi
                hành Quyết định này và Quy định ban hành kèm theo, tổ chức phổ biến tới toàn bộ nhân sự trong nhóm.
                Điều 2. Mục đích
                Xác định rõ chức năng, nhiệm vụ và trách nhiệm đầu mối của các nhóm chức năng và cá nhân trong Công ty; hạn
                chế chồng chéo, bỏ sót công việc; tăng cường phối hợp giữa các nhóm trong hoạt động kinh doanh và dự án.
                CHƯƠNG I. CƠ CẤU VÀ NGUYÊN TẮC PHÂN CÔNG
                Điều 3. Các nhóm chức năng
                Công ty tổ chức ba nhóm chức năng chính: Truyền thông; Vận hành, Khách hàng và Kinh doanh; Công nghệ và Sản
                phẩm số. Mỗi nhóm có một Team Leader chịu trách nhiệm điều phối công việc và báo cáo Ban lãnh đạo hằng tuần.
                """;
        when(agent.extract(contains("Điều 1"))).thenReturn(json("""
                {"chuDe":"KHAC","nhom":"Ban hành quy định","dong":[{"loai":"TRA_CUU","ten":"Ban hành","doanGoc":"Ban hành kèm theo Quyết định này"}]}"""));
        when(agent.extract(contains("Điều 2"))).thenReturn(json("""
                {"chuDe":"KHAC","nhom":"Mục đích","dong":[{"loai":"TRA_CUU","ten":"Mục đích","doanGoc":"Xác định rõ chức năng"}]}"""));
        when(agent.extract(contains("Điều 3"))).thenReturn(json("""
                {"chuDe":"TO_CHUC","nhom":"Cơ cấu","dong":[{"loai":"TRA_CUU","ten":"Các nhóm","doanGoc":"Công ty tổ chức ba nhóm"}]}"""));

        CriteriaExtractor.Outcome out = extractor.extract("Quy định", LegalStructureSectioning.split(doc), REGULATION, doc);

        assertThat(out.rows()).extracting(CriteriaExtractor.Row::topic)
                .containsExactly("Phần mở đầu", "Phần mở đầu", "Cơ cấu và nguyên tắc phân công");
    }

    @Test
    @DisplayName("một câu liệt kê bị tách thành nhiều dòng cùng đoạn gốc → gộp một dòng, mỗi dòng cũ một ý; căn cứ chấm không gộp")
    void splitListMergedBack() {
        String excerpt = "Nguyên tắc: Việc phân bổ căn cứ vào đóng góp thực tế, bao gồm **chốt khách hàng**, delivery, chất lượng";
        List<CriteriaExtractor.Row> split = List.of(
                new CriteriaExtractor.Row("TRA_CUU", "Chốt khách hàng", null, null, List.of("chốt khách hàng"), null, excerpt, "III. PHÂN BỔ"),
                new CriteriaExtractor.Row("TRA_CUU", "Delivery", "", null, List.of("delivery"), null, excerpt, "III. PHÂN BỔ"),
                new CriteriaExtractor.Row("TRA_CUU", "Chất lượng", null, null, null, null, excerpt, "III. PHÂN BỔ"),
                new CriteriaExtractor.Row("TRA_CUU", "Khác", "Một dòng riêng có mô tả", null, null, null, "khác", "III. PHÂN BỔ"));
        List<CriteriaExtractor.Row> criteria = List.of(
                new CriteriaExtractor.Row("TIEU_CHI", "Tiến độ", null, null, null, null, "trên cơ sở: tiến độ; chất lượng; phối hợp", "Điều 10"),
                new CriteriaExtractor.Row("TIEU_CHI", "Chất lượng", null, null, null, null, "trên cơ sở: tiến độ; chất lượng; phối hợp", "Điều 10"),
                new CriteriaExtractor.Row("TIEU_CHI", "Phối hợp", null, null, null, null, "trên cơ sở: tiến độ; chất lượng; phối hợp", "Điều 10"));

        List<CriteriaExtractor.Row> merged = CriteriaExtractor.mergeSplitLists(split);

        assertThat(merged).hasSize(2);
        assertThat(merged.get(0).ten()).isEqualTo("Nguyên tắc");
        assertThat(merged.get(0).cacMuc()).containsExactly("chốt khách hàng", "delivery", "Chất lượng");
        assertThat(merged.get(1).ten()).isEqualTo("Khác");
        assertThat(CriteriaExtractor.mergeSplitLists(criteria)).hasSize(3);
        assertThat(CriteriaExtractor.mergeSplitLists(split.subList(0, 2))).hasSize(2);   // 2 dòng: chưa đủ để gộp
    }

    @Test
    @DisplayName("đoạn gốc khớp dù mô hình thêm nhãn 'Chức năng:', nối ý bằng '.;', tô đậm '**'; chữ sai vẫn không khớp")
    void excerptToleratesPunctuationButNotWords() {
        String hay = CriteriaExtractor.compact("""
                1. Chức năng
                Chịu trách nhiệm xây dựng, quản trị và phát triển hình ảnh.
                2. Nhiệm vụ
                a) Phát triển, vận hành và nâng cấp các sản phẩm.
                b) Tiếp nhận, phân tích và triển khai yêu cầu.""");

        assertThat(CriteriaExtractor.excerptFound(hay, "Chức năng: Chịu trách nhiệm xây dựng, quản trị")).isTrue();
        assertThat(CriteriaExtractor.excerptFound(hay, "a) Phát triển, vận hành và nâng cấp các sản phẩm.; b) Tiếp nhận")).isTrue();
        assertThat(CriteriaExtractor.excerptFound(hay, "Nhiệm vụ: a) **Phát triển, vận hành**")).isTrue();
        assertThat(CriteriaExtractor.excerptFound(hay, "Chịu trách nhiệm xây dựng và quản trị hình ảnh")).isFalse();
    }

    @Test
    @DisplayName("tên chủ đề: từ HOA lẫn trên dòng thường của PDF không dạy cách viết ('VÀ', 'CÔNG'); từ viết tắt / tên riêng giữ; nhãn Hoa Mọi Chữ hạ về thường")
    void topicCasing() {
        TopicNames names = new TopicNames("""
                CÔNG TY CỔ PHẦN TƯ VẤN VÀ ĐÀO TẠO Độc lập – Tự do – Hạnh phúc
                Công ty phân công và đánh giá KPI, OKR trên KeyGo.
                """);

        assertThat(names.fromHeading("CHƯƠNG I. CƠ CẤU VÀ NGUYÊN TẮC PHÂN CÔNG")).isEqualTo("Cơ cấu và nguyên tắc phân công");
        assertThat(names.fromHeading("CHƯƠNG IV. ĐÁNH GIÁ KPI TRÊN KEYGO")).isEqualTo("Đánh giá KPI trên KeyGo");
        assertThat(names.fromLabel("Quỹ Thưởng Dự Án")).isEqualTo("Quỹ thưởng dự án");
        assertThat(names.fromLabel("Nhóm Truyền thông & Thương hiệu")).isEqualTo("Nhóm Truyền thông & Thương hiệu");
    }

    @Test
    @DisplayName("dòng thiếu đoạn gốc → lấy phần nội dung đã chép nếu NGUYÊN VĂN có trong mục; bịa / quá ngắn → để trống; đoạn gốc sẵn có không đụng")
    void missingExcerptRecoveredFromVerbatimContent() {
        String section = CriteriaExtractor.compact(DOC);
        CriteriaExtractor.Row fromDescription = new CriteriaExtractor.Row("TRA_CUU", "Cơ hội kinh doanh",
                "đóng góp tạo lập cơ hội kinh doanh", null, null, null, "", null);
        CriteriaExtractor.Row fromItem = new CriteriaExtractor.Row("TRA_CUU", "Kênh truyền thông", "Các kênh",
                null, List.of("Quản trị và phát triển các kênh truyền thông như website"), null, null, null);
        CriteriaExtractor.Row invented = new CriteriaExtractor.Row("TRA_CUU", "Tiến độ",
                "Một câu không có trong tài liệu gốc", null, null, null, null, null);
        CriteriaExtractor.Row given = new CriteriaExtractor.Row("TRA_CUU", "X", "đóng góp tạo lập cơ hội kinh doanh",
                null, null, null, "đoạn mô hình tự ghi", null);

        assertThat(fromDescription.withExcerptFrom(section).doanGoc()).isEqualTo("đóng góp tạo lập cơ hội kinh doanh");
        assertThat(fromItem.withExcerptFrom(section).doanGoc()).startsWith("Quản trị và phát triển");
        assertThat(invented.withExcerptFrom(section).doanGoc()).isNull();
        assertThat(given.withExcerptFrom(section).doanGoc()).isEqualTo("đoạn mô hình tự ghi");
    }

    @Test
    @DisplayName("không có chương → chủ đề là nhãn mô hình đặt; trùng khác hoa/thường gộp một")
    void noChaptersUseModelLabels() {
        String doc = """
                Điều 1. Giờ làm việc
                Nhân viên làm việc từ 8 giờ đến 17 giờ các ngày từ thứ Hai đến thứ Sáu, nghỉ trưa từ 12 giờ đến 13 giờ.
                Người đi muộn quá 15 phút phải báo trưởng bộ phận trước khi vào ca làm việc trong ngày hôm đó.
                Làm thêm giờ phải được trưởng bộ phận duyệt trước trên hệ thống và được tính theo quy định hiện hành.
                Điều 2. Nghỉ phép
                Mỗi năm nhân viên có 12 ngày phép, đăng ký trước 3 ngày làm việc qua hệ thống, trưởng bộ phận duyệt.
                Phép năm chưa dùng hết được chuyển sang quý I năm sau, quá hạn thì huỷ, không quy đổi thành tiền.
                Nghỉ ốm từ 2 ngày trở lên phải nộp giấy xác nhận của cơ sở y tế cho bộ phận nhân sự trong 5 ngày.
                """;
        when(agent.extract(contains("Điều 1"))).thenReturn(json("""
                {"chuDe":"KHAC","nhom":"thời gian làm việc","dong":[{"loai":"TRA_CUU","ten":"Giờ làm việc","doanGoc":""}]}"""));
        when(agent.extract(contains("Điều 2"))).thenReturn(json("""
                {"chuDe":"KHAC","nhom":"Thời gian làm việc","dong":[{"loai":"TRA_CUU","ten":"Nghỉ phép","doanGoc":""}]}"""));

        List<DocumentSection> sections = LegalStructureSectioning.split(doc);
        CriteriaExtractor.Outcome out = extractor.extract("Nội quy", sections, REGULATION, doc);

        assertThat(sections).hasSize(2);
        assertThat(out.rows()).extracting(CriteriaExtractor.Row::ten).containsExactly("Giờ làm việc", "Nghỉ phép");
        assertThat(out.rows()).extracting(CriteriaExtractor.Row::topic).containsOnly("Thời gian làm việc");
    }
}
