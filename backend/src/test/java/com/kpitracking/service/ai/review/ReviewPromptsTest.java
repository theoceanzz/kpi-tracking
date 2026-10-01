package com.kpitracking.service.ai.review;

import com.kpitracking.service.ai.review.evidence.EvidenceText;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Khối dữ liệu gửi cho agent: mọi nguồn GĐ2–3 phải có mặt VÀ mang đúng nhãn — chữ chép từ ảnh "có thể sai",
 * tệp không đọc được "không được giả định", quy chế / bộ tiêu chí là căn cứ chứ không phải bài nộp.
 */
class ReviewPromptsTest {

    private static final Instant AT = Instant.parse("2026-09-10T00:00:00Z");

    private static ReviewContext.Criterion criterionWithFiles() {
        ReviewContext.Submission sub = new ReviewContext.Submission(UUID.randomUUID(), "đã xong module thanh toán", 12.0,
                null, "PENDING", AT,
                List.of(new ReviewContext.Attachment("bao-cao.docx", "u1"), new ReviewContext.Attachment("anh.png", "u2"),
                        new ReviewContext.Attachment("video.mp4", "u3")),
                List.of(EvidenceText.read("bao-cao.docx", "Hoàn thành 14 đầu việc", EvidenceText.Source.TEXT, false),
                        EvidenceText.read("anh.png", "Biên bản nghiệm thu số 07", EvidenceText.Source.IMAGE, false),
                        EvidenceText.unreadable("video.mp4", "định dạng .mp4 chưa hỗ trợ đọc")));
        return new ReviewContext.Criterion(UUID.randomUUID(), "Số task hoàn thành", null, false, "task", 10.0, null,
                false, 40, null, 1.2, List.of(sub),
                List.of(new ReviewContext.HistoryEntry("Tháng 8/2026", 36.0, "Tốt", "Ổn định")));
    }

    @Test
    @DisplayName("khối chỉ tiêu: nội dung tệp, nhãn chữ-từ-ảnh, tệp không đọc được, bộ tiêu chí, quy chế, lịch sử")
    void criterionBlockCarriesPhase2And3Sources() {
        ReviewContext.Criterion c = criterionWithFiles();
        ReviewContext ctx = new ReviewContext(UUID.randomUUID(), UUID.randomUUID(), "Tháng 9/2026", UUID.randomUUID(),
                "An", List.of(c), ReviewScoreCalculator.DEFAULT_SCALE, List.of(), ReviewFixtures.W,
                List.of(new ReviewContext.Excerpt("Quy chế 2026", "Điều 3", "Sản phẩm phải có minh chứng")),
                new ReviewContext.CriteriaSet(UUID.randomUUID(), 2, "Quy chế mẫu",
                        List.of(new ReviewContext.CriteriaRow("Chất lượng sản phẩm", null, 30.0, "Tốt\nĐạt", null))),
                List.of());

        String block = ReviewPrompts.criterionBlock(ctx, c);

        assertThat(block)
                .contains("Hoàn thành 14 đầu việc")
                .contains("CHÉP TỪ ẢNH").contains("Biên bản nghiệm thu số 07")
                .contains("video.mp4").contains("không được giả định")
                .contains("phiên bản 2").contains("· Tốt")
                .contains("Sản phẩm phải có minh chứng")
                .contains("Tháng 8/2026").contains("điểm quản lý 36");
    }

    @Test
    @DisplayName("khối tự soi: bài đang soạn + căn cứ, KHÔNG có thang chất lượng hay lịch sử chấm của quản lý")
    void selfCheckBlockHasNoScaleNorHistory() {
        ReviewContext.Criterion c = criterionWithFiles();
        ReviewContext ctx = new ReviewContext(UUID.randomUUID(), UUID.randomUUID(), "Tháng 9/2026", UUID.randomUUID(),
                "An", List.of(c), ReviewScoreCalculator.DEFAULT_SCALE, List.of(), ReviewFixtures.W,
                List.of(new ReviewContext.Excerpt("Quy chế 2026", "Điều 3", "Sản phẩm phải có minh chứng")),
                null, List.of());

        String block = ReviewPrompts.selfCheckBlock(ctx, c);

        assertThat(block)
                .contains("BÀI ĐANG SOẠN").contains("đã xong module thanh toán").contains("Hoàn thành 14 đầu việc")
                .contains("Tệp minh chứng đã đính kèm (3): bao-cao.docx, anh.png, video.mp4")
                .contains("[QC1]").contains("Sản phẩm phải có minh chứng")
                .doesNotContain("THANG CHẤT LƯỢNG").doesNotContain("LỊCH SỬ CHẤM").doesNotContain("điểm quản lý");
    }

    @Test
    @DisplayName("tệp đã lược bớt: prompt ghi rõ phần lược vẫn có trong tệp (không coi là bài thiếu)")
    void labelsCondensedEvidence() {
        ReviewContext.Submission sub = new ReviewContext.Submission(UUID.randomUUID(), null, null, null, "DRAFT", null,
                List.of(new ReviewContext.Attachment("bao-cao.docx", null)),
                List.of(EvidenceText.read("bao-cao.docx", "Nguyên nhân: …\n[… bảng còn 12 dòng, đã lược]",
                        EvidenceText.Source.TEXT, true)));
        ReviewContext.Criterion c = new ReviewContext.Criterion(UUID.randomUUID(), "Tính năng mới", null, false, "cái",
                10.0, 5.0, false, 25, null, null, List.of(sub));

        assertThat(ReviewPrompts.selfCheckBlock(ReviewFixtures.context(c), c))
                .contains("«bao-cao.docx» (bóc từ tệp) (tệp dài — đã lược bớt bảng / đoạn giữa; phần lược có thể còn nội dung)");
    }

    @Test
    @DisplayName("khối tổng hợp: có tiêu chí hạnh kiểm khi tổ chức bật; không bật thì không có mục đó")
    void summaryDigestCarriesConductOnlyWhenEnabled() {
        ReviewContext.Criterion c = criterionWithFiles();
        ReviewContext base = ReviewFixtures.context(c);
        ReviewContext withConduct = new ReviewContext(base.organizationId(), base.kpiPeriodId(), base.periodName(),
                base.userId(), base.userName(), base.criteria(), base.scale(), List.of(), base.weights(), List.of(), null,
                List.of(new ReviewContext.ConductRow("Tuân thủ thời hạn", "Nộp báo cáo đúng hạn", 20.0)));

        assertThat(ReviewPrompts.summaryDigest(withConduct, List.of()))
                .contains("TIÊU CHÍ HẠNH KIỂM").contains("Tuân thủ thời hạn: Nộp báo cáo đúng hạn");
        assertThat(ReviewPrompts.summaryDigest(base, List.of())).doesNotContain("HẠNH KIỂM");
    }
}
