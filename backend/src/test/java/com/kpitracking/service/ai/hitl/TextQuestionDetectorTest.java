package com.kpitracking.service.ai.hitl;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Nhận ra câu trả lời chỉ là một câu hỏi. Cố ý bảo thủ: nhận nhầm một câu trả lời thật thành câu hỏi
 * là người dùng mất câu trả lời, nên các ca "KHÔNG nhận" quan trọng ngang các ca "nhận".
 */
class TextQuestionDetectorTest {

    @Test
    @DisplayName("câu hỏi + gạch đầu dòng -> lựa chọn (bỏ **đậm**)")
    void questionWithBulletOptions() {
        PendingQuestion.Item item = TextQuestionDetector.detect(
                "Bạn muốn đặt mục tiêu tối thiểu là bao nhiêu?\n\n- **99.0%**\n- **99.5%**\n- **98.0%**");

        assertThat(item).isNotNull();
        assertThat(item.question()).isEqualTo("Bạn muốn đặt mục tiêu tối thiểu là bao nhiêu?");
        assertThat(item.options()).extracting(PendingQuestion.Option::value).containsExactly("99.0%", "99.5%", "98.0%");
        assertThat(item.multiSelect()).isFalse();
    }

    @Test
    @DisplayName("câu hỏi mở, không danh sách -> hỏi mở")
    void openQuestion() {
        PendingQuestion.Item item = TextQuestionDetector.detect("Bạn muốn xem hiệu suất theo kỳ nào?");

        assertThat(item).isNotNull();
        assertThat(item.options()).isEmpty();
    }

    @Test
    @DisplayName("'chọn một hoặc nhiều' -> chọn nhiều; danh sách đánh số cũng là lựa chọn; câu dẫn kết thúc bằng ':'")
    void numberedListAndMultiSelect() {
        PendingQuestion.Item item = TextQuestionDetector.detect(
                "Bạn có thể chọn một hoặc nhiều đơn vị để so sánh:\n1. Team Backend\n2. Team Design");

        assertThat(item).isNotNull();
        assertThat(item.multiSelect()).isTrue();
        assertThat(item.options()).hasSize(2);
    }

    @Test
    @DisplayName("bảng LỰA CHỌN thuần (đo ở D03: '| Lựa chọn | Tên nhóm |') -> các dòng thành lựa chọn")
    void pureChoiceTable() {
        PendingQuestion.Item item = TextQuestionDetector.detect(
                "**Bạn muốn biết số lượng nhân sự của nhóm nào?**\n\n| Lựa chọn | Tên nhóm |\n|---|---|\n"
                        + "| 1 | Team Backend |\n| 2 | Team Frontend |\n| 3 | Team Design |");

        assertThat(item).isNotNull();
        assertThat(item.options()).extracting(PendingQuestion.Option::value)
                .containsExactly("Team Backend", "Team Frontend", "Team Design");
    }

    @Test
    @DisplayName("KHÔNG nhận: có bảng số liệu, lời mời xem thêm, lời từ chối, câu khẳng định")
    void rejectsRealAnswers() {
        assertThat(TextQuestionDetector.detect("| Đơn vị | Số người |\n|---|---|\n| Phòng IT | 5 |\n\nBạn muốn xem theo kỳ nào?")).isNull();
        assertThat(TextQuestionDetector.detect("Phòng IT có 5 người. Bạn có muốn xem danh sách chi tiết không?")).isNull();
        assertThat(TextQuestionDetector.detect("Xin lỗi, đơn vị này nằm ngoài phạm vi của bạn. Bạn muốn xem đơn vị nào khác?")).isNull();
        assertThat(TextQuestionDetector.detect("Phòng IT có 5 người.")).isNull();
    }

    @Test
    @DisplayName("KHÔNG nhận: danh sách giữa bài (nội dung) hoặc quá 5 mục")
    void rejectsContentLists() {
        assertThat(TextQuestionDetector.detect("- A: 5 người\n- B: 3 người\nTổng 8.\n\nBạn muốn xem kỳ nào?\n- Q1\n- Q2")).isNull();
        assertThat(TextQuestionDetector.detect("Chọn đơn vị?\n- A\n- B\n- C\n- D\n- E\n- F")).isNull();
    }

    @Test
    @DisplayName("lời nhắc ngắn SAU danh sách (đo ở H02/H05) -> vẫn là câu hỏi; 'một hoặc nhiều' ở lời nhắc -> chọn nhiều")
    void trailingHintAfterOptions() {
        PendingQuestion.Item item = TextQuestionDetector.detect(
                "**Bạn muốn so sánh hiệu suất của những team nào?**\n\n- **Team Backend**\n- **Team Frontend**\n- **Team Design**\n\n"
                        + "*(Bạn có thể chọn một hoặc nhiều team)*");

        assertThat(item).isNotNull();
        assertThat(item.question()).isEqualTo("Bạn muốn so sánh hiệu suất của những team nào?");
        assertThat(item.options()).hasSize(3);
        assertThat(item.multiSelect()).isTrue();
    }

    @Test
    @DisplayName("lời nhắc trong ngoặc ngay sau câu hỏi (đo ở H05) -> vẫn là câu hỏi, chọn nhiều")
    void parentheticalHintRightAfterTheQuestion() {
        PendingQuestion.Item item = TextQuestionDetector.detect(
                "**Bạn muốn so sánh hiệu suất của những team nào?** (Bạn có thể chọn nhiều team)\n- Team Backend\n- Team Frontend");

        assertThat(item).isNotNull();
        assertThat(item.question()).isEqualTo("Bạn muốn so sánh hiệu suất của những team nào?");
        assertThat(item.multiSelect()).isTrue();
    }

    @Test
    @DisplayName("câu hỏi nằm ở lời nhắc sau danh sách -> ghép phần dẫn + câu hỏi")
    void questionInTheTail() {
        PendingQuestion.Item item = TextQuestionDetector.detect("Các KPI của Phòng IT:\n- Uptime\n- Số bug\nBạn muốn xem KPI nào?");

        assertThat(item).isNotNull();
        assertThat(item.question()).isEqualTo("Các KPI của Phòng IT: Bạn muốn xem KPI nào?");
        assertThat(item.options()).hasSize(2);
    }
}
