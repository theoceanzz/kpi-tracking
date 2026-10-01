package com.kpitracking.service.ai.review;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Câu C4 (giữ đoạn văn gốc để trích dẫn khi giải thích điểm): mô hình chỉ chọn MÃ, đoạn gốc do mã nguồn tra — mã
 * lạ bị bỏ, và prompt với bộ kiểm đếm mã cùng một cách.
 */
class ReviewBasisTest {

    private static final ReviewContext.CriteriaSet SET = new ReviewContext.CriteriaSet(UUID.randomUUID(), 3,
            "Quy chế vận hành IT", List.of(
            new ReviewContext.CriteriaRow("Xếp loại", null, null, "A: ≥ 90%", null, "THANG_MUC",
                    "Loại A: hoàn thành từ 90% trở lên", true, "Chương III"),
            new ReviewContext.CriteriaRow("Uptime hệ thống", "Tối thiểu 99,5%", 40.0, null, null, "TIEU_CHI",
                    "Điều 5. Thời gian hoạt động của hệ thống không thấp hơn 99,5% mỗi tháng.", true, "Chương II"),
            new ReviewContext.CriteriaRow("Báo cáo sự cố", "Gửi trong 24 giờ", 20.0, null, null, "TIEU_CHI",
                    null, false, null),
            new ReviewContext.CriteriaRow("Tra cứu", "Chỉ tra kho", null, null, null, "TRA_CUU",
                    "không đưa vào prompt", true, null)));

    private static ReviewContext ctx() {
        return new ReviewContext(UUID.randomUUID(), UUID.randomUUID(), "Tháng 10/2026", UUID.randomUUID(), "An",
                List.of(), ReviewScoreCalculator.DEFAULT_SCALE, List.of(), ReviewFixtures.W,
                // Đoạn kho mang dòng đường dẫn "[tài liệu › mục]" đầu đoạn như bước nạp kho gắn vào.
                List.of(new ReviewContext.Excerpt("Sổ tay vận hành", "Mục 2 › Sự cố",
                        "[Sổ tay vận hành › Mục 2]\nSự cố mức 1 phải báo trong 2 giờ.")),
                SET, List.of());
    }

    @Test
    @DisplayName("đánh mã theo thứ tự hiện trong prompt: TIEU_CHI trước, THANG_MUC sau; TRA_CUU không có mã")
    void refsFollowPromptOrder() {
        assertThat(ReviewBasis.criteriaRefs(SET).keySet()).containsExactly("TC1", "TC2", "TC3");
        assertThat(ReviewBasis.criteriaRefs(SET).get("TC1").name()).isEqualTo("Uptime hệ thống");
        assertThat(ReviewBasis.criteriaRefs(SET).get("TC3").name()).isEqualTo("Xếp loại");

        String block = ReviewPrompts.criterionBlock(ctx(), ReviewFixtures.criterion(40, 1.0, null));
        assertThat(block).contains("- [TC1] Uptime hệ thống").contains("- [TC3] Xếp loại")
                .contains("- [QC1] [Sổ tay vận hành › Mục 2 › Sự cố]")
                .doesNotContain("Tra cứu")
                // Đoạn gốc KHÔNG vào prompt — chỉ để trích dẫn khi giải thích.
                .doesNotContain("Thời gian hoạt động của hệ thống không thấp hơn");
    }

    @Test
    @DisplayName("tra mã ra đoạn gốc: đúng chữ tài liệu, cờ khớp, bỏ mã lạ / trùng / sai dạng, tối đa 4")
    void resolveMapsRefsToOriginalText() {
        List<ReviewResults.Basis> basis = ReviewBasis.resolve(ctx(),
                List.of("[TC1]", "tc1", "QC1", "TC2", "TC9", "Điều 5", "TC3", "QC1"));

        assertThat(basis).extracting(ReviewResults.Basis::ref).containsExactly("TC1", "QC1", "TC2", "TC3");
        ReviewResults.Basis uptime = basis.get(0);
        assertThat(uptime.kind()).isEqualTo(ReviewBasis.CRITERIA);
        assertThat(uptime.excerpt()).isEqualTo("Điều 5. Thời gian hoạt động của hệ thống không thấp hơn 99,5% mỗi tháng.");
        assertThat(uptime.source()).isEqualTo("Quy chế vận hành IT › Chương II");
        assertThat(uptime.verified()).isTrue();

        ReviewResults.Basis regulation = basis.get(1);
        assertThat(regulation.kind()).isEqualTo(ReviewBasis.REGULATION);
        assertThat(regulation.source()).isEqualTo("Sổ tay vận hành");
        assertThat(regulation.excerpt()).isEqualTo("Sự cố mức 1 phải báo trong 2 giờ.");

        // Dòng không có đoạn gốc: hiện mô tả đã chuẩn hoá, và KHÔNG được coi là đã khớp tài liệu.
        ReviewResults.Basis noSource = basis.get(2);
        assertThat(noSource.excerpt()).isEqualTo("Gửi trong 24 giờ");
        assertThat(noSource.verified()).isFalse();
    }

    @Test
    @DisplayName("không có bộ tiêu chí / quy chế, hoặc mô hình không chọn mã → không có căn cứ")
    void emptyWhenNothingToCite() {
        assertThat(ReviewBasis.resolve(ReviewFixtures.context(), List.of("TC1", "QC1"))).isEmpty();
        assertThat(ReviewBasis.resolve(ctx(), null)).isEmpty();
        assertThat(ReviewBasis.toJson(List.of())).isNull();
    }

    @Test
    @DisplayName("mã căn cứ lọt vào câu -> tên điều khoản («…»), không để chữ treo; chữ thường không bị đụng")
    void humanizesRefsInProse() {
        ReviewContext ctx = ctx();
        assertThat(ReviewBasis.humanizeRefs("Cần cung cấp PR link cho tất cả 8 API (đáp ứng TC1).", ctx))
                .isEqualTo("Cần cung cấp PR link cho tất cả 8 API (đáp ứng «Uptime hệ thống»).");
        // Hai câu thật lấy từ kết quả tự soi trong DB dev (29/09) — trước đây thành "…cần bổ sung để." / "…để và."
        assertThat(ReviewBasis.humanizeRefs("Không có bằng chứng giám sát, cần bổ sung để đáp ứng TC2.", ctx))
                .isEqualTo("Không có bằng chứng giám sát, cần bổ sung để đáp ứng «Báo cáo sự cố».");
        assertThat(ReviewBasis.humanizeRefs("Chưa ghi nhận thay đổi yêu cầu, cần tài liệu ghi nhận để đáp ứng TC1 và TC2.", ctx))
                .isEqualTo("Chưa ghi nhận thay đổi yêu cầu, cần tài liệu ghi nhận để đáp ứng «Uptime hệ thống» và «Báo cáo sự cố».");
        assertThat(ReviewBasis.humanizeRefs("Sự cố mức 1 phải báo trong 2 giờ [QC1]", ctx))
                .isEqualTo("Sự cố mức 1 phải báo trong 2 giờ «Mục 2 › Sự cố»");
        assertThat(ReviewBasis.humanizeRefs("Hoàn thành 12 task (3 task khó)", ctx)).isEqualTo("Hoàn thành 12 task (3 task khó)");
    }

    @Test
    @DisplayName("mã không tra được (mô hình bịa / không có bộ tiêu chí) -> bỏ cùng cụm nối, không chữ treo")
    void dropsUnknownRefsWithTheirConnector() {
        ReviewContext none = ReviewFixtures.context();
        assertThat(ReviewBasis.humanizeRefs("Cần bổ sung số liệu lỗi để đáp ứng TC3.", none))
                .isEqualTo("Cần bổ sung số liệu lỗi.");
        assertThat(ReviewBasis.humanizeRefs("Không có bằng chứng bảo mật (kiểm tra OWASP) theo tiêu chí TC5.", none))
                .isEqualTo("Không có bằng chứng bảo mật (kiểm tra OWASP).");
        assertThat(ReviewBasis.humanizeRefs("Thiếu log hệ thống (TC9).", none)).isEqualTo("Thiếu log hệ thống.");
        assertThat(ReviewBasis.humanizeRefs("Theo TC1, cần đính kèm PR.", none)).isEqualTo("Cần đính kèm PR.");
        assertThat(ReviewBasis.humanizeRefs("(TC1)", none)).isNull();
    }

    @Test
    @DisplayName("lưu JSON rồi đọc lại ra đúng căn cứ (cột basis_citations)")
    void jsonRoundTrip() {
        List<ReviewResults.Basis> basis = ReviewBasis.resolve(ctx(), List.of("TC1", "QC1"));
        var back = com.kpitracking.mapper.AiSubmissionReviewMapper.basisOf(ReviewBasis.toJson(basis));
        assertThat(back).hasSize(2);
        assertThat(back.get(0).excerpt()).startsWith("Điều 5.");
        assertThat(back.get(0).verified()).isTrue();
        assertThat(back.get(1).kind()).isEqualTo(ReviewBasis.REGULATION);
    }
}
