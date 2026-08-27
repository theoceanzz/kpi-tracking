package com.kpitracking.service.ai.form;

import com.kpitracking.service.ai.form.FormSpec.Field;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Test cho phép kiểm giá trị model đề xuất.
 *
 * <p>Hai điều phải đúng: giá trị hỏng thì bị CHẶN (không lọt vào form của người dùng), và thông báo
 * lỗi phải nói rõ sai ở đâu — vì model đọc chính thông báo đó để tự sửa trong cùng lượt.
 */
class FormFieldValidatorTest {

    private final FormFieldValidator validator = new FormFieldValidator();

    @Nested
    @DisplayName("ô ENUM")
    class Enums {
        private final Field frequency = Field.enumOf("frequency", "Tần suất",
                new java.util.LinkedHashMap<>(java.util.Map.of("MONTHLY", "Hàng tháng", "YEARLY", "Hàng năm")));

        @Test
        @DisplayName("nhận NHÃN TIẾNG VIỆT người dùng nhìn thấy, không bắt model nhớ hằng số")
        void acceptsVietnameseLabels() {
            // Đo được: model trả "Hàng tháng", bị từ chối, rồi BỎ CUỘC thay vì sửa lại.
            assertThat(validator.check(frequency, "Hàng tháng").value()).isEqualTo("MONTHLY");
            assertThat(validator.check(frequency, "hang thang").value())
                    .as("bỏ dấu vẫn phải khớp").isEqualTo("MONTHLY");
            assertThat(validator.check(frequency, "HÀNG NĂM").value()).isEqualTo("YEARLY");
        }

        @Test
        @DisplayName("nhận đúng giá trị trong danh sách, không phân biệt hoa thường")
        void acceptsAllowed() {
            assertThat(validator.check(frequency, "MONTHLY").value()).isEqualTo("MONTHLY");
            assertThat(validator.check(frequency, "monthly").value())
                    .as("chuẩn hoá về đúng hằng số form dùng").isEqualTo("MONTHLY");
        }

        @Test
        @DisplayName("giá trị lạ bị chặn, và thông báo LIỆT KÊ giá trị hợp lệ cho model tự sửa")
        void rejectsUnknownAndListsOptions() {
            // "hai tuần một lần" không phải hằng số cũng không phải nhãn nào có thật.
            assertThatThrownBy(() -> validator.check(frequency, "hai tuần một lần"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("MONTHLY")
                    .hasMessageContaining("YEARLY");
        }
    }

    @Nested
    @DisplayName("ô SỐ")
    class Numbers {
        private final Field weight = Field.number("weight", "Trọng số", 0d, 100d);

        @Test
        @DisplayName("chặn giá trị ngoài khoảng — trọng số 150% là form từ chối")
        void rejectsOutOfRange() {
            assertThatThrownBy(() -> validator.check(weight, 150))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("100");
            assertThatThrownBy(() -> validator.check(weight, -1))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("đọc được cách viết số của người Việt mà model hay trả về")
        void parsesVietnameseNumberFormats() {
            assertThat(validator.check(weight, "80%").value()).isEqualTo(80L);
            assertThat(validator.check(Field.number("targetValue", "Mục tiêu", 0d, null), "1.000").value())
                    .as("dấu chấm là phân cách nghìn trong cách viết Việt Nam").isEqualTo(1000L);
        }

        @Test
        @DisplayName("số nguyên giữ nguyên dạng nguyên — form không được hiện '5.0'")
        void keepsIntegersIntegral() {
            assertThat(validator.check(weight, 5.0).value()).isEqualTo(5L);
            assertThat(validator.check(weight, 5.5).value()).isEqualTo(5.5);
        }

        @Test
        @DisplayName("chữ không phải số thì chặn")
        void rejectsNonNumeric() {
            assertThatThrownBy(() -> validator.check(weight, "cao"))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    @DisplayName("ô NGÀY")
    class Dates {
        private final Field deadline = Field.date("deadline", "Hạn chót");

        @Test
        @DisplayName("nhận cả dd/MM/yyyy lẫn ISO, luôn trả ISO cho input type=date")
        void acceptsBothFormats() {
            assertThat(validator.check(deadline, "30/06/2026").value()).isEqualTo("2026-06-30");
            assertThat(validator.check(deadline, "2026-06-30").value()).isEqualTo("2026-06-30");
        }

        @Test
        @DisplayName("bản hiển thị theo cách đọc của người Việt")
        void displaysVietnameseFormat() {
            assertThat(validator.check(deadline, "2026-06-30").display()).isEqualTo("30/06/2026");
        }

        @Test
        @DisplayName("ngày vô nghĩa bị chặn chứ không lặng lẽ thành ngày khác")
        void rejectsGarbage() {
            assertThatThrownBy(() -> validator.check(deadline, "cuối tháng sau"))
                    .isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> validator.check(deadline, "32/13/2026"))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test
    @DisplayName("ô BOOLEAN nhận cả true/false lẫn có/không")
    void booleans() {
        Field f = Field.bool("isBonusKpi", "Chỉ tiêu thưởng");
        assertThat(validator.check(f, true).value()).isEqualTo(true);
        assertThat(validator.check(f, "có").value()).isEqualTo(true);
        assertThat(validator.check(f, "false").value()).isEqualTo(false);
        assertThatThrownBy(() -> validator.check(f, "chắc vậy"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("ô CHỮ rỗng hoặc null bị chặn — đề xuất điền ô trống là vô nghĩa")
    void blankTextIsRejected() {
        Field name = Field.text("name", "Tên");
        assertThatThrownBy(() -> validator.check(name, "   ")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> validator.check(name, null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("chặn model nhồi cả đoạn văn vào ô một dòng")
    void rejectsOverlongText() {
        assertThatThrownBy(() -> validator.check(Field.text("name", "Tên"), "x".repeat(2001)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("2000");
    }
}
