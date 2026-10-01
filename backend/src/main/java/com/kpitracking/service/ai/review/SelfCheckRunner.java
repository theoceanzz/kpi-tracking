package com.kpitracking.service.ai.review;

import com.kpitracking.ai.agent.AiLanguage;
import com.kpitracking.ai.agent.SubmissionSelfCheckAgent;
import com.kpitracking.ai.document.model.FileRef;
import com.kpitracking.entity.AiSelfCheck;
import com.kpitracking.entity.AiTokenUsage;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.User;
import com.kpitracking.event.AiSelfCheckEvents;
import com.kpitracking.i18n.UserLanguageResolver;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.service.AiTokenUsageRecorder;
import com.kpitracking.service.ai.review.evidence.EvidenceReader;
import com.kpitracking.service.ai.review.evidence.EvidenceText;
import dev.langchain4j.model.output.TokenUsage;
import dev.langchain4j.service.Result;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.concurrent.DelegatingSecurityContextCallable;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/**
 * Nửa chạy nền của luồng nhân viên tự soi bài: đọc tệp → trích quy chế → một lời gọi
 * {@link SubmissionSelfCheckAgent} → kiểm → ghi. Một chỉ tiêu, nên không cần đồ thị agentic như
 * {@code SubmissionReviewWorkflow}; các khối dùng chung (ngữ cảnh, đọc minh chứng, trích quy chế, prompt, bộ kiểm,
 * căn cứ) là của luồng quản lý.
 *
 * <p>Tên chỉ tiêu và lời bài không bao giờ vào điểm: agent này không có mức, không có số.
 */
@Component
@Slf4j
public class SelfCheckRunner {

    private final SelfCheckRecorder recorder;
    private final ReviewContextBuilder contextBuilder;
    private final EvidenceReader evidenceReader;
    private final ReviewDocumentSource documentSource;
    private final SubmissionSelfCheckAgent agent;
    private final ReviewResultValidator validator;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final UserLanguageResolver languageResolver;
    private final int timeoutSeconds;
    private final ExecutorService pool;

    @Value("${app.ai.model.name:}")
    String modelName = "";

    public SelfCheckRunner(SelfCheckRecorder recorder, ReviewContextBuilder contextBuilder,
                           EvidenceReader evidenceReader, ReviewDocumentSource documentSource,
                           SubmissionSelfCheckAgent agent, ReviewResultValidator validator,
                           OrganizationRepository organizationRepository, UserRepository userRepository,
                           UserLanguageResolver languageResolver,
                           @Value("${app.ai.review.timeout-seconds:90}") int timeoutSeconds) {
        this.recorder = recorder;
        this.contextBuilder = contextBuilder;
        this.evidenceReader = evidenceReader;
        this.documentSource = documentSource;
        this.agent = agent;
        this.validator = validator;
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
        this.languageResolver = languageResolver;
        this.timeoutSeconds = timeoutSeconds;
        // Đọc ảnh gọi mô hình thị giác, vài giây mỗi tệp — đọc song song trong trần nhỏ (tối đa 5 tệp một lần soi).
        this.pool = Executors.newFixedThreadPool(3, r -> {
            Thread t = new Thread(r, "kg-ai-self-check");
            t.setDaemon(true);
            return t;
        });
    }

    @PreDestroy
    void shutdown() {
        pool.shutdownNow();
    }

    public void execute(AiSelfCheckEvents.Requested e) {
        Instant startedAt = Instant.now();
        AiSelfCheck check = recorder.markRunning(e.checkId());
        if (check == null) return;   // đã có luồng khác nhận

        SecurityContext previous = SecurityContextHolder.getContext();
        // Luồng @Async không có SecurityContext, mà sổ token đọc danh tính từ đó: token tính cho chính người nộp.
        SecurityContextHolder.setContext(new SecurityContextImpl(
                new UsernamePasswordAuthenticationToken(e.requesterEmail(), null, List.of())));
        try {
            Organization org = organizationRepository.findById(check.getOrganizationId()).orElseThrow();
            List<ReviewContext.Attachment> names = new ArrayList<>();
            e.files().forEach(f -> names.add(new ReviewContext.Attachment(f.name(), null)));
            e.storedFiles().forEach(f -> names.add(new ReviewContext.Attachment(f.fileName(), f.url())));
            ReviewContext.Submission draft = new ReviewContext.Submission(check.getId(), e.note(), e.actualValue(),
                    e.qualitativeLevel(), "DRAFT", null, names, List.of());

            ReviewContext ctx = contextBuilder.buildDraft(org, check.getUserId(), check.getKpiCriteriaId(), draft);
            ctx = readEvidence(ctx, check.getId(), e);
            ReviewContext.Criterion c = ctx.criteria().get(0);
            UUID chosenSet = ctx.criteriaSet() == null ? null : ctx.criteriaSet().id();
            ctx = ctx.withExcerpts(documentSource.excerptsFor(org.getId(), List.of(
                    "tiêu chí đánh giá, cách chấm điểm và yêu cầu minh chứng kết quả công việc",
                    c.name() + (c.description() == null ? "" : " — " + c.description())), chosenSet));
            c = ctx.criteria().get(0);

            User user = userRepository.findById(check.getUserId()).orElse(null);
            String language = user == null ? null : languageResolver.effectiveLanguage(user);

            AiTokenUsageRecorder.setFeature(AiTokenUsage.AiFeature.SUBMISSION_SELF_CHECK);
            Result<String> res;
            try {
                res = agent.check(AiLanguage.prefix(language) + ReviewPrompts.selfCheckBlock(ctx, c));
            } finally {
                AiTokenUsageRecorder.clearFeature();
            }
            ReviewResults.SelfCheckAssessment a = ReviewResultParser.selfCheck(res == null ? null : res.content());
            if (a == null) {
                recorder.fail(check.getId(), "Mô hình trả sai định dạng", startedAt);
                return;
            }
            TokenUsage u = res.tokenUsage();
            recorder.complete(check.getId(), validator.validateSelfCheck(ctx, c, a), ctx,
                    u == null || u.inputTokenCount() == null ? 0 : u.inputTokenCount(),
                    u == null || u.outputTokenCount() == null ? 0 : u.outputTokenCount(),
                    modelName, startedAt);
            log.info("AI tự soi {} xong trong {} ms", check.getId(), java.time.Duration.between(startedAt, Instant.now()).toMillis());
        } catch (Exception ex) {
            log.error("AI tự soi {} lỗi", check.getId(), ex);
            recorder.fail(check.getId(), ex.toString(), startedAt);
        } finally {
            SecurityContextHolder.setContext(previous);
        }
    }

    /** Đọc song song tệp vừa chọn (byte có sẵn) và tệp đã tải của bản nháp (tải về); tệp lỗi vẫn có mặt kèm lý do. */
    private ReviewContext readEvidence(ReviewContext ctx, UUID submissionKey, AiSelfCheckEvents.Requested e) {
        if (e.files().isEmpty() && e.storedFiles().isEmpty()) return ctx;
        SecurityContext security = SecurityContextHolder.getContext();

        record Job(String fileName, Future<EvidenceText> future) {}
        List<Job> jobs = new ArrayList<>();
        for (FileRef f : e.files()) {
            jobs.add(new Job(f.name(), pool.submit(labelled(() -> evidenceReader.readBytes(f.name(), f.bytes()), security))));
        }
        for (AiSelfCheckEvents.StoredFile f : e.storedFiles()) {
            jobs.add(new Job(f.fileName(), pool.submit(labelled(() -> f.url() == null
                    ? EvidenceText.unreadable(f.fileName(), "thiếu địa chỉ tệp")
                    : evidenceReader.read(f.fileName(), f.url()), security))));
        }

        List<EvidenceText> texts = new ArrayList<>();
        List<String> unreadable = new ArrayList<>();
        for (Job j : jobs) {
            EvidenceText t;
            try {
                t = j.future().get(timeoutSeconds, TimeUnit.SECONDS);
                if (t == null) t = EvidenceText.unreadable(j.fileName(), "không đọc được nội dung");
            } catch (Exception ex) {
                j.future().cancel(true);
                t = EvidenceText.unreadable(j.fileName(), "đọc tệp quá lâu");
            }
            texts.add(t);
            if (!t.readable()) unreadable.add(t.fileName() + ": " + t.unreadableReason());
        }
        return ctx.withEvidence(Map.of(submissionKey, texts), unreadable);
    }

    /** Luồng của pool không có SecurityContext lẫn nhãn tính năng (ThreadLocal) — sổ token cần cả hai. */
    private static Callable<EvidenceText> labelled(Callable<EvidenceText> job, SecurityContext security) {
        Callable<EvidenceText> withFeature = () -> {
            AiTokenUsageRecorder.setFeature(AiTokenUsage.AiFeature.SUBMISSION_SELF_CHECK);
            try {
                return job.call();
            } finally {
                AiTokenUsageRecorder.clearFeature();
            }
        };
        return DelegatingSecurityContextCallable.create(withFeature, security);
    }
}
