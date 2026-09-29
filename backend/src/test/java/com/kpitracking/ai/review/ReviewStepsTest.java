package com.kpitracking.ai.review;

import com.kpitracking.ai.agent.CriterionReviewAgent;
import com.kpitracking.ai.agent.ReviewSummaryAgent;
import com.kpitracking.entity.Organization;
import com.kpitracking.service.ai.review.ReviewContext;
import com.kpitracking.service.ai.review.ReviewContextBuilder;
import com.kpitracking.service.ai.review.ReviewDocumentSource;
import com.kpitracking.service.ai.review.evidence.EvidenceReader;
import com.kpitracking.service.ai.review.evidence.EvidenceText;
import com.kpitracking.service.ai.review.ReviewResultValidator;
import com.kpitracking.service.ai.review.ReviewResults;
import com.kpitracking.service.ai.review.ReviewScoreCalculator;
import dev.langchain4j.agentic.scope.AgenticScope;
import dev.langchain4j.model.output.TokenUsage;
import dev.langchain4j.service.Result;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Các bước của luồng AI đánh giá: chỉ tiêu chưa nộp không tốn lời gọi mô hình, và một chỉ tiêu lỗi không
 * kéo hỏng cả lượt.
 */
class ReviewStepsTest {

    private CriterionReviewAgent criterionAgent;
    private ReviewSummaryAgent summaryAgent;
    private ReviewContextBuilder contextBuilder;
    private ReviewSteps steps;
    private EvidenceReader evidenceReader;
    private ReviewDocumentSource documentSource;
    private ReviewRun run;
    private AgenticScope scope;

    private static final Instant AT = Instant.parse("2026-09-10T00:00:00Z");

    private static ReviewContext.Criterion criterion(String name, String note) {
        List<ReviewContext.Submission> subs = note == null ? List.of()
                : List.of(new ReviewContext.Submission(UUID.randomUUID(), note, 10.0, null, "PENDING", AT, List.of()));
        return new ReviewContext.Criterion(UUID.randomUUID(), name, null, false, "task", 10.0, null, false,
                20, null, note == null ? 0.0 : 1.0, subs);
    }

    private static Result<String> result(String json) {
        return Result.<String>builder().content(json).tokenUsage(new TokenUsage(100, 20)).build();
    }

    @BeforeEach
    void setUp() {
        criterionAgent = mock(CriterionReviewAgent.class);
        summaryAgent = mock(ReviewSummaryAgent.class);
        contextBuilder = mock(ReviewContextBuilder.class);
        evidenceReader = mock(EvidenceReader.class);
        documentSource = mock(ReviewDocumentSource.class);
        steps = new ReviewSteps(contextBuilder, new ReviewResultValidator(new ReviewScoreCalculator()),
                criterionAgent, summaryAgent, evidenceReader, documentSource, 2, 10);

        Organization org = new Organization();
        org.setId(UUID.randomUUID());
        run = new ReviewRun(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), org);
        scope = mock(AgenticScope.class);
        when(scope.readState(ReviewSteps.RUN)).thenReturn(run);
    }

    @AfterEach
    void tearDown() {
        steps.shutdown();
    }

    private void withCriteria(ReviewContext.Criterion... cs) {
        run.setContext(new ReviewContext(run.getOrganizationId(), run.getKpiPeriodId(), "Tháng 9", run.getUserId(),
                "An", List.of(cs), ReviewScoreCalculator.DEFAULT_SCALE, List.of(), new ReviewContext.Weights(60, 30, 10)));
    }

    @Test
    @DisplayName("chỉ tiêu chưa nộp -> xong ngay bằng số, không gọi mô hình")
    void noSubmissionSkipsTheModel() {
        withCriteria(criterion("A", null));

        steps.measure(scope);
        steps.criteria(scope);

        assertThat(run.getResults()).hasSize(1);
        assertThat(run.getResults().get(0).gaps()).containsExactly("Chưa có bài nộp");
        verify(criterionAgent, never()).review(anyString());
    }

    @Test
    @DisplayName("một chỉ tiêu lỗi -> chỉ chỉ tiêu đó mang lỗi, chỉ tiêu kia vẫn có kết quả; token được cộng")
    void oneFailingCriterionDoesNotSinkTheRun() {
        withCriteria(criterion("Tốt", "đã hoàn thành 10 task"), criterion("Lỗi", "làm được vài việc"));
        when(criterionAgent.review(contains("Tốt"))).thenReturn(result(
                "{\"tomTat\":\"x\",\"chatLuong\":{\"muc\":\"TỐT\",\"nhanXet\":\"ok\",\"trichDan\":[\"đã hoàn thành 10 task\"]}}"));
        when(criterionAgent.review(contains("Lỗi"))).thenThrow(new RuntimeException("mô hình sập"));

        steps.measure(scope);
        steps.criteria(scope);

        assertThat(run.getResults()).hasSize(2);
        ReviewResults.CriterionResult ok = run.getResults().stream().filter(r -> r.error() == null).findFirst().orElseThrow();
        ReviewResults.CriterionResult bad = run.getResults().stream().filter(r -> r.error() != null).findFirst().orElseThrow();
        assertThat(ok.qualityLevel()).isEqualTo("TỐT");
        assertThat(bad.achievementPercent()).isNotNull();   // vẫn có số của mã nguồn
        assertThat(run.getPromptTokens().get()).isEqualTo(100);
    }

    @Test
    @DisplayName("mô hình trả không phải JSON -> chỉ tiêu ghi lỗi định dạng")
    void badJsonBecomesAnItemError() {
        withCriteria(criterion("A", "đã làm"));
        when(criterionAgent.review(anyString())).thenReturn(result("xin lỗi tôi không biết"));

        steps.measure(scope);
        steps.criteria(scope);

        assertThat(run.getResults().get(0).error()).contains("sai định dạng");
    }

    @Test
    @DisplayName("không có bài nộp nào -> tổng hợp nói thẳng, không gọi agent tổng hợp")
    void summaryWithoutSubmissions() {
        withCriteria(criterion("A", null));

        steps.measure(scope);
        steps.summary(scope);
        steps.validate(scope);

        assertThat(run.getSummary()).contains("chưa có bài nộp");
        assertThat(run.getConfidence()).isEqualTo(ReviewResultValidator.CONFIDENCE_LOW);
        verify(summaryAgent, never()).summarize(any());
    }

    @Test
    @DisplayName("đọc minh chứng: tệp đọc được gắn vào bài nộp; tệp lỗi / thiếu địa chỉ có mặt trong danh sách kèm lý do")
    void evidenceIsReadAndFailuresAreListed() {
        UUID subId = UUID.randomUUID();
        ReviewContext.Submission sub = new ReviewContext.Submission(subId, "đã nộp", 10.0, null, "PENDING", AT,
                List.of(new ReviewContext.Attachment("bao-cao.docx", "https://x/bao-cao.docx"),
                        new ReviewContext.Attachment("anh-mo.png", "https://x/anh-mo.png"),
                        new ReviewContext.Attachment("mat-link.pdf", null)),
                List.of());
        withCriteria(new ReviewContext.Criterion(UUID.randomUUID(), "A", null, false, "task", 10.0, null, false,
                20, null, 1.0, List.of(sub)));
        when(evidenceReader.read("bao-cao.docx", "https://x/bao-cao.docx"))
                .thenReturn(EvidenceText.read("bao-cao.docx", "Doanh thu quý 3 đạt 1,2 tỷ", EvidenceText.Source.TEXT, false));
        when(evidenceReader.read("anh-mo.png", "https://x/anh-mo.png"))
                .thenReturn(EvidenceText.unreadable("anh-mo.png", "ảnh không rõ chữ"));

        steps.evidence(scope);

        ReviewContext ctx = run.getContext();
        assertThat(ctx.criteria().get(0).submissions().get(0).evidence()).hasSize(3);
        assertThat(ctx.unreadableFiles()).containsExactlyInAnyOrder(
                "anh-mo.png: ảnh không rõ chữ", "mat-link.pdf: thiếu địa chỉ tệp");
        assertThat(ctx.fileCounts()).containsExactly(1, 3);
        assertThat(ctx.criteria().get(0).allNotes()).contains("Doanh thu quý 3 đạt 1,2 tỷ");
    }

    @Test
    @DisplayName("không có tệp nào -> bước đọc minh chứng không đổi ngữ cảnh, không gọi bộ đọc")
    void noFilesNoReading() {
        withCriteria(criterion("A", "đã làm"));
        ReviewContext before = run.getContext();

        steps.evidence(scope);

        assertThat(run.getContext()).isSameAs(before);
        verify(evidenceReader, never()).read(anyString(), anyString());
    }
}
