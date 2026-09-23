package com.kpitracking.ai.rag;

import org.apache.poi.util.Units;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Test cho bộ đọc docx theo mục.
 *
 * <p>Dựng tài liệu bằng chính POI trong bộ nhớ thay vì kèm một .docx mẫu: test nói rõ tài liệu có
 * gì, và không ai phải mở Word để hiểu vì sao nó đỏ.
 */
class DocxSectionWalkerTest {

    private static XWPFParagraph heading(XWPFDocument doc, int level, String text) {
        XWPFParagraph p = doc.createParagraph();
        p.setStyle("Heading" + level);
        p.createRun().setText(text);
        return p;
    }

    private static void para(XWPFDocument doc, String text) {
        doc.createParagraph().createRun().setText(text);
    }

    private static void picture(XWPFDocument doc) throws Exception {
        BufferedImage img = new BufferedImage(4, 4, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream png = new ByteArrayOutputStream();
        javax.imageio.ImageIO.write(img, "png", png);
        XWPFRun run = doc.createParagraph().createRun();
        run.addPicture(new ByteArrayInputStream(png.toByteArray()),
                XWPFDocument.PICTURE_TYPE_PNG, "shot.png", Units.toEMU(40), Units.toEMU(40));
    }

    private static List<DocxSectionWalker.Section> walk(XWPFDocument doc) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        doc.write(out);
        return DocxSectionWalker.walk(new ByteArrayInputStream(out.toByteArray()));
    }

    @Test
    @DisplayName("Heading 2 là một mục; Heading 1 là đường dẫn cha")
    void headingsBecomeSections() throws Exception {
        XWPFDocument doc = new XWPFDocument();
        heading(doc, 1, "PHẦN 2. BẮT ĐẦU");
        heading(doc, 2, "2.1. Đăng nhập");
        para(doc, "Nhập email và mật khẩu.");
        heading(doc, 2, "2.2. Đăng ký");
        para(doc, "Khai tên tổ chức.");

        List<DocxSectionWalker.Section> s = walk(doc);

        assertThat(s).hasSize(2);
        assertThat(s.get(0).path()).containsExactly("PHẦN 2. BẮT ĐẦU", "2.1. Đăng nhập");
        assertThat(s.get(0).title()).isEqualTo("2.1. Đăng nhập");
        assertThat(s.get(0).parent()).isEqualTo("PHẦN 2. BẮT ĐẦU");
        assertThat(s.get(0).text()).isEqualTo("Nhập email và mật khẩu.");
        assertThat(s.get(1).text()).isEqualTo("Khai tên tổ chức.");
    }

    @Test
    @DisplayName("Heading 1 mới đóng mọi Heading 2 đang mở")
    void newTopLevelHeadingResetsPath() throws Exception {
        XWPFDocument doc = new XWPFDocument();
        heading(doc, 1, "PHẦN 1");
        heading(doc, 2, "1.1");
        para(doc, "a");
        heading(doc, 1, "PHẦN 2");
        para(doc, "b");   // thuộc thẳng PHẦN 2, không phải 1.1

        List<DocxSectionWalker.Section> s = walk(doc);

        assertThat(s.get(1).path()).containsExactly("PHẦN 2");
        assertThat(s.get(1).text()).isEqualTo("b");
    }

    @Test
    @DisplayName("ảnh gắn vào mục đang mở, chú thích lấy từ đoạn 'Hình N.' ngay sau")
    void picturesAttachWithCaption() throws Exception {
        XWPFDocument doc = new XWPFDocument();
        heading(doc, 2, "2.1. Đăng nhập");
        para(doc, "Cửa vào hệ thống.");
        picture(doc);
        para(doc, "Hình 3. Màn hình đăng nhập");
        para(doc, "Sau khi vào, bạn thấy trang chủ.");

        DocxSectionWalker.Section s = walk(doc).get(0);

        assertThat(s.images()).hasSize(1);
        assertThat(s.images().get(0).caption()).isEqualTo("Hình 3. Màn hình đăng nhập");
        assertThat(s.images().get(0).bytes()).isNotEmpty();
        // Chú thích vào chữ đúng MỘT lần, không lặp thành dòng riêng nữa.
        assertThat(s.text()).isEqualTo("Cửa vào hệ thống.\nHình 3. Màn hình đăng nhập\nSau khi vào, bạn thấy trang chủ.");
    }

    @Test
    @DisplayName("bảng trải thành dòng 'ô | ô'")
    void tablesFlattenToRows() throws Exception {
        XWPFDocument doc = new XWPFDocument();
        heading(doc, 2, "1.4. Hai khái niệm");
        XWPFTable t = doc.createTable(2, 2);
        t.getRow(0).getCell(0).setText("Khái niệm");
        t.getRow(0).getCell(1).setText("Nghĩa");
        t.getRow(1).getCell(0).setText("Đợt");
        t.getRow(1).getCell(1).setText("Một chu kỳ đánh giá");

        DocxSectionWalker.Section s = walk(doc).get(0);

        assertThat(s.text()).isEqualTo("Khái niệm | Nghĩa\nĐợt | Một chu kỳ đánh giá");
    }

    @Test
    @DisplayName("mục lục (style toc) và mục rỗng bị bỏ qua")
    void tocAndEmptySectionsAreSkipped() throws Exception {
        XWPFDocument doc = new XWPFDocument();
        XWPFParagraph toc = doc.createParagraph();
        toc.setStyle("toc 1");
        toc.createRun().setText("PHẦN 1 ........ 3");
        heading(doc, 1, "PHẦN 1");          // không có nội dung -> không thành mục
        heading(doc, 2, "1.1. Có nội dung");
        para(doc, "x");

        List<DocxSectionWalker.Section> s = walk(doc);

        assertThat(s).hasSize(1);
        assertThat(s.get(0).title()).isEqualTo("1.1. Có nội dung");
    }

    @Test
    @DisplayName("không có tiêu đề nào -> cả tài liệu là một mục, đường dẫn rỗng")
    void noHeadingsMeansOneSection() throws Exception {
        XWPFDocument doc = new XWPFDocument();
        para(doc, "Điều 1. Phạm vi.");
        para(doc, "Điều 2. Đối tượng.");

        List<DocxSectionWalker.Section> s = walk(doc);

        assertThat(s).hasSize(1);
        assertThat(s.get(0).path()).isEmpty();
        assertThat(s.get(0).text()).isEqualTo("Điều 1. Phạm vi.\nĐiều 2. Đối tượng.");
    }
}
