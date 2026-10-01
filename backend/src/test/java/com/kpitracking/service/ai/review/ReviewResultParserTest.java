package com.kpitracking.service.ai.review;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Mô hình hiếm khi trả JSON sạch — bóc được, và hỏng thì trả null chứ không ném. */
class ReviewResultParserTest {

    @Test
    @DisplayName("có rào ```json và lời dẫn -> vẫn bóc được")
    void fencedWithPreamble() {
        String raw = "Dưới đây là kết quả:\n```json\n{\"tomTat\":\"Đã hoàn thành 12 task\","
                + "\"chatLuong\":{\"muc\":\"TỐT\",\"nhanXet\":\"Rõ ràng\",\"trichDan\":[\"hoàn thành 12 task\"]},"
                + "\"diemManh\":[\"Có số liệu\"]}\n```";

        ReviewResults.CriterionAssessment a = ReviewResultParser.criterion(raw);

        assertThat(a).isNotNull();
        assertThat(a.chatLuong().muc()).isEqualTo("TỐT");
        assertThat(a.chatLuong().trichDan()).containsExactly("hoàn thành 12 task");
    }

    @Test
    @DisplayName("thiếu trường, thừa trường lạ -> bóc được, trường thiếu là null")
    void missingAndUnknownFields() {
        ReviewResults.CriterionAssessment a = ReviewResultParser.criterion("{\"tomTat\":\"x\",\"laLa\":1}");

        assertThat(a).isNotNull();
        assertThat(a.chatLuong()).isNull();
        assertThat(a.diemManh()).isNull();
    }

    @Test
    @DisplayName("một chuỗi thay vì mảng ở danh sách -> chấp nhận như mảng một phần tử")
    void singleValueAsArray() {
        ReviewResults.CriterionAssessment a = ReviewResultParser.criterion("{\"diemManh\":\"Có số liệu\"}");

        assertThat(a.diemManh()).containsExactly("Có số liệu");
    }

    @Test
    @DisplayName("không phải JSON / rỗng -> null, không ném")
    void garbage() {
        assertThat(ReviewResultParser.criterion("xin lỗi, tôi không làm được")).isNull();
        assertThat(ReviewResultParser.criterion("{ hỏng")).isNull();
        assertThat(ReviewResultParser.summary(null)).isNull();
    }

    @Test
    @DisplayName("bóc phần tổng hợp")
    void summary() {
        ReviewResults.Summary s = ReviewResultParser.summary("{\"tomTat\":\"Ổn\",\"mucTinCay\":\"CAO\",\"thieuDuLieu\":[\"a\"]}");

        assertThat(s.mucTinCay()).isEqualTo("CAO");
        assertThat(s.thieuDuLieu()).containsExactly("a");
    }
}
