package com.kpitracking.ai.review;

import com.kpitracking.ai.agent.CriterionReviewAgent;
import com.kpitracking.ai.agent.ReviewSummaryAgent;
import com.kpitracking.entity.AiTokenUsage;
import com.kpitracking.service.AiTokenUsageRecorder;
import com.kpitracking.service.ai.review.ReviewContext;
import com.kpitracking.service.ai.review.ReviewContextBuilder;
import com.kpitracking.service.ai.review.ReviewPrompts;
import com.kpitracking.service.ai.review.ReviewResultParser;
import com.kpitracking.service.ai.review.ReviewResultValidator;
import com.kpitracking.service.ai.review.ReviewResults;
import com.kpitracking.service.ai.review.ReviewDocumentSource;
import com.kpitracking.service.ai.review.evidence.EvidenceReader;
import com.kpitracking.service.ai.review.evidence.EvidenceText;
import dev.langchain4j.agentic.scope.AgenticScope;
import dev.langchain4j.model.output.TokenUsage;
import dev.langchain4j.service.Result;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.concurrent.DelegatingSecurityContextCallable;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/**
 * Các bước code thuần của {@link SubmissionReviewWorkflow} — vai trò như {@code TurnSteps} của khung chat.
 *
 * <p>Thứ tự: {@code context} (đọc + cắt gọn) → {@code measure} (số do mã nguồn tính; chỉ tiêu chưa nộp
 * xong luôn, không gọi mô hình) → {@code criteria} (agent chấm chất lượng, song song có trần) →
 * {@code summary} (agent tổng hợp) → {@code validate} (mức tin cậy cuối). Lưu kết quả là việc của
 * {@code SubmissionReviewService}, ngoài đồ thị, để trạng thái DONE/FAILED ghi cùng một chỗ.
 */
@Component
@Slf4j
public class ReviewSteps {

    /** Khoá của {@link ReviewRun} trong scope. */
    public static final String RUN = "reviewRun";

    private final ReviewContextBuilder contextBuilder;
    private final ReviewResultValidator validator;
    private final CriterionReviewAgent criterionAgent;
    private final ReviewSummaryAgent summaryAgent;
    private final EvidenceReader evidenceReader;
    private final ReviewDocumentSource documentSource;
    private final int timeoutSeconds;
    private final ExecutorService pool;

    public ReviewSteps(ReviewContextBuilder contextBuilder, ReviewResultValidator validator,
                       CriterionReviewAgent criterionAgent, ReviewSummaryAgent summaryAgent,
                       EvidenceReader evidenceReader, ReviewDocumentSource documentSource,
                       @Value("${app.ai.review.max-parallel:4}") int maxParallel,
                       @Value("${app.ai.review.timeout-seconds:90}") int timeoutSeconds) {
        this.contextBuilder = contextBuilder;
        this.validator = validator;
        this.criterionAgent = criterionAgent;
        this.summaryAgent = summaryAgent;
        this.evidenceReader = evidenceReader;
        this.documentSource = documentSource;
        this.timeoutSeconds = timeoutSeconds;
        // Trần luồng: mỗi chỉ tiêu một lời gọi mô hình; mười chỉ tiêu mà bắn cùng lúc là đụng giới hạn
        // tốc độ của nhà cung cấp và cả hạn mức token/phút.
        this.pool = Executors.newFixedThreadPool(Math.max(1, maxParallel), r -> {
            Thread t = new Thread(r, "kg-ai-review");
            t.setDaemon(true);
            return t;
        });
    }

    @PreDestroy
    void shutdown() {
        pool.shutdownNow();
    }

    public static ReviewRun runOf(AgenticScope scope) {
        Object r = scope.readState(RUN);
        if (!(r instanceof ReviewRun run)) throw new IllegalStateException("Scope không có ReviewRun");
        return run;
    }

    // ── ① ngữ cảnh ──────────────────────────────────────────────────────────

    public void context(AgenticScope scope) {
        ReviewRun run = runOf(scope);
        run.setContext(contextBuilder.build(run.getOrganizationId(), run.getKpiPeriodId(), run.getUserId(),
                run.getOrganization()));
        log.info("AI đánh giá bài nộp {}: {} chỉ tiêu, {} tệp chưa đọc", run.getReviewId(),
                run.getContext().criteria().size(), run.getContext().unreadableFiles().size());
    }

    // ── ①b đọc minh chứng (GĐ2: Word/Excel/PDF; GĐ3: ảnh, PDF scan) ─────────

    /**
     * Tải và đọc mọi tệp minh chứng, song song trên pool của luồng. Tệp nào không đọc được vẫn có mặt
     * trong {@code unreadableFiles} kèm lý do — luật "không im lặng". Đọc ảnh gọi mô hình thị giác nên
     * cũng mang SecurityContext và nhãn tính năng (sổ token) như bước chấm chất lượng.
     */
    public void evidence(AgenticScope scope) {
        ReviewRun run = runOf(scope);
        ReviewContext ctx = run.getContext();
        SecurityContext security = SecurityContextHolder.getContext();

        record Job(UUID submissionId, ReviewContext.Attachment file, Future<EvidenceText> future) {}
        List<Job> jobs = new ArrayList<>();
        for (ReviewContext.Criterion c : ctx.criteria()) {
            for (ReviewContext.Submission s : c.submissions()) {
                for (ReviewContext.Attachment a : s.attachments()) {
                    Callable<EvidenceText> job = () -> {
                        AiTokenUsageRecorder.setFeature(AiTokenUsage.AiFeature.SUBMISSION_REVIEW);
                        try {
                            return a.url() == null ? EvidenceText.unreadable(a.fileName(), "thiếu địa chỉ tệp")
                                    : evidenceReader.read(a.fileName(), a.url());
                        } finally {
                            AiTokenUsageRecorder.clearFeature();
                        }
                    };
                    jobs.add(new Job(s.id(), a, pool.submit(DelegatingSecurityContextCallable.create(job, security))));
                }
            }
        }
        if (jobs.isEmpty()) return;

        Map<UUID, List<EvidenceText>> bySubmission = new HashMap<>();
        List<String> unreadable = new ArrayList<>();
        for (Job j : jobs) {
            EvidenceText t;
            try {
                t = j.future().get(timeoutSeconds, TimeUnit.SECONDS);
                if (t == null) t = EvidenceText.unreadable(j.file().fileName(), "không đọc được nội dung");
            } catch (Exception e) {
                j.future().cancel(true);
                t = EvidenceText.unreadable(j.file().fileName(), "đọc tệp quá lâu");
            }
            bySubmission.computeIfAbsent(j.submissionId(), k -> new ArrayList<>()).add(t);
            if (!t.readable()) unreadable.add(t.fileName() + ": " + t.unreadableReason());
        }
        run.setContext(ctx.withEvidence(bySubmission, unreadable));
        int[] counts = run.getContext().fileCounts();
        log.info("Lượt {}: đọc được {}/{} tệp minh chứng", run.getReviewId(), counts[0], counts[1]);
    }

    // ── ①c trích đoạn quy chế / mô tả công việc (GĐ2) ──────────────────────

    /** Vài đoạn quy chế / mô tả công việc liên quan tới các chỉ tiêu đang chấm. Kho trống thì bỏ qua. */
    public void regulations(AgenticScope scope) {
        ReviewRun run = runOf(scope);
        ReviewContext ctx = run.getContext();
        List<String> queries = new ArrayList<>();
        queries.add("tiêu chí đánh giá, cách chấm điểm và xếp loại kết quả công việc");
        for (ReviewContext.Criterion c : ctx.criteria()) {
            if (c.hasSubmission()) queries.add(c.name() + (c.description() == null ? "" : " — " + c.description()));
        }
        UUID chosenSet = ctx.criteriaSet() == null ? null : ctx.criteriaSet().id();
        run.setContext(ctx.withExcerpts(documentSource.excerptsFor(ctx.organizationId(), queries, chosenSet)));
    }

    // ── ② số do mã nguồn tính ───────────────────────────────────────────────

    /**
     * Chỉ tiêu CHƯA có bài nộp: xong ngay bằng số mã nguồn, không tốn lời gọi mô hình nào. Chỉ tiêu có bài
     * nộp chuyển sang bước chấm chất lượng.
     */
    public void measure(AgenticScope scope) {
        ReviewRun run = runOf(scope);
        List<ReviewContext.Criterion> pending = new ArrayList<>();
        for (ReviewContext.Criterion c : run.getContext().criteria()) {
            if (c.hasSubmission()) pending.add(c);
            else run.getResults().add(validator.noSubmission(run.getContext(), c));
        }
        run.setPending(pending);
    }

    // ── ③ agent chấm chất lượng, song song ─────────────────────────────────

    /**
     * Mỗi chỉ tiêu một lời gọi {@link CriterionReviewAgent}. Một chỉ tiêu lỗi (mô hình lỗi, quá giờ, JSON
     * hỏng) chỉ làm hỏng CHỈ TIÊU đó — lượt vẫn xong với số của mã nguồn và dòng lỗi.
     *
     * <p>Luồng của pool không có SecurityContext lẫn nhãn tính năng (ThreadLocal) — mà sổ token đọc danh
     * tính từ đó. Bọc từng việc bằng ngữ cảnh của luồng gọi và đặt/xoá nhãn trong chính việc đó.
     */
    public void criteria(AgenticScope scope) {
        ReviewRun run = runOf(scope);
        ReviewContext ctx = run.getContext();
        SecurityContext security = SecurityContextHolder.getContext();

        List<Future<ReviewResults.CriterionResult>> futures = new ArrayList<>();
        for (ReviewContext.Criterion c : run.getPending()) {
            Callable<ReviewResults.CriterionResult> job = () -> reviewOne(run, ctx, c);
            futures.add(pool.submit(DelegatingSecurityContextCallable.create(job, security)));
        }
        for (int i = 0; i < futures.size(); i++) {
            ReviewContext.Criterion c = run.getPending().get(i);
            try {
                run.getResults().add(futures.get(i).get(timeoutSeconds, TimeUnit.SECONDS));
            } catch (Exception e) {
                futures.get(i).cancel(true);
                log.warn("Chỉ tiêu {} của lượt {} lỗi: {}", c.kpiCriteriaId(), run.getReviewId(), e.toString());
                run.getResults().add(validator.failed(ctx, c, "AI không phân tích được chỉ tiêu này (quá giờ hoặc lỗi)."));
            }
        }
    }

    ReviewResults.CriterionResult reviewOne(ReviewRun run, ReviewContext ctx, ReviewContext.Criterion c) {
        AiTokenUsageRecorder.setFeature(AiTokenUsage.AiFeature.SUBMISSION_REVIEW);
        try {
            Result<String> res = criterionAgent.review(ReviewPrompts.criterionBlock(ctx, c));
            addTokens(run, res);
            ReviewResults.CriterionAssessment a = ReviewResultParser.criterion(res == null ? null : res.content());
            if (a == null) return validator.failed(ctx, c, "AI trả kết quả sai định dạng cho chỉ tiêu này.");
            return validator.validate(ctx, c, a);
        } catch (Exception e) {
            log.warn("Gọi mô hình cho chỉ tiêu {} lỗi: {}", c.kpiCriteriaId(), e.toString());
            return validator.failed(ctx, c, "AI không phân tích được chỉ tiêu này.");
        } finally {
            AiTokenUsageRecorder.clearFeature();
        }
    }

    // ── ④ agent tổng hợp ───────────────────────────────────────────────────

    public void summary(AgenticScope scope) {
        ReviewRun run = runOf(scope);
        // Không có bài nộp nào thì không có gì để tổng hợp — nói thẳng, khỏi tốn lời gọi.
        if (run.getPending().isEmpty()) {
            run.setSummary("Nhân viên chưa có bài nộp nào trong đợt này, nên chưa có nội dung để AI đọc.");
            run.setMissingData(List.of("Bài nộp của các chỉ tiêu trong đợt"));
            return;
        }
        AiTokenUsageRecorder.setFeature(AiTokenUsage.AiFeature.SUBMISSION_REVIEW);
        try {
            Result<String> res = summaryAgent.summarize(ReviewPrompts.summaryDigest(run.getContext(), run.getResults()));
            addTokens(run, res);
            ReviewResults.Summary s = ReviewResultParser.summary(res == null ? null : res.content());
            if (s != null) {
                run.setSummary(s.tomTat());
                run.setConfidence(s.mucTinCay());
                run.setMissingData(s.thieuDuLieu() == null ? List.of() : s.thieuDuLieu().stream()
                        .filter(x -> x != null && !x.isBlank()).limit(5).toList());
            }
        } catch (Exception e) {
            // Tóm tắt là phần thêm: hỏng thì kết quả từng chỉ tiêu vẫn dùng được.
            log.warn("Tổng hợp của lượt {} lỗi: {}", run.getReviewId(), e.toString());
        } finally {
            AiTokenUsageRecorder.clearFeature();
        }
    }

    // ── ⑤ chốt ─────────────────────────────────────────────────────────────

    public void validate(AgenticScope scope) {
        ReviewRun run = runOf(scope);
        run.setConfidence(validator.confidence(run.getConfidence(), run.getContext(), run.getResults()));
    }

    private static void addTokens(ReviewRun run, Result<String> res) {
        if (res == null) return;
        TokenUsage u = res.tokenUsage();
        if (u != null) run.addTokens(u.inputTokenCount(), u.outputTokenCount());
    }
}
