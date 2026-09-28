package com.kpitracking.service.feedback360;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.dto.response.feedback360.F360MyReportResponse;
import com.kpitracking.dto.response.feedback360.F360ReportResponse;
import com.kpitracking.dto.response.feedback360.F360ResultSnapshot;
import com.kpitracking.entity.*;
import com.kpitracking.enums.*;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.Terms;
import com.kpitracking.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Tính + chụp kết quả lúc đóng chiến dịch, dựng báo cáo, ẩn nhận xét vi phạm.
 *
 * <p>Điểm đọc từ bản chụp; nhận xét đọc LIVE (lọc {@code hidden_at}) để "Ẩn nhận xét" có hiệu lực
 * ngay mà không phải tính lại (§6.4). Nhận xét cũng chịu cùng luật nhóm với điểm: nhóm bị ẩn vì
 * dưới ngưỡng thì nhận xét của nhóm đó cũng không hiện.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class F360ReportService {

    private final F360SubjectRepository subjectRepository;
    private final F360AssignmentRepository assignmentRepository;
    private final F360AnswerRepository answerRepository;
    private final F360CampaignQuestionRepository campaignQuestionRepository;
    private final F360EventRepository eventRepository;
    private final F360AccessPolicy access;
    private final ObjectMapper objectMapper;
    private final org.springframework.context.ApplicationEventPublisher events;
    private final F360AnalyticsService analyticsService;

    // ============================================================
    // TÍNH + CHỤP (gọi lúc đóng chiến dịch)
    // ============================================================

    /** Tính kết quả cho mọi người trong chiến dịch và chụp vào f360_subjects. */
    @Transactional
    public void computeAndSnapshot(F360Campaign campaign) {
        List<F360Subject> subjects = subjectRepository.findByCampaignIdWithUser(campaign.getId());
        if (subjects.isEmpty()) return;

        List<F360CampaignQuestion> questions = campaignQuestionRepository.findByCampaignId(campaign.getId());
        List<F360ScoreCalculator.QuestionDef> ratingDefs = questions.stream()
                .filter(q -> q.getQuestionType() == F360QuestionType.RATING)
                .map(q -> new F360ScoreCalculator.QuestionDef(q.getId(), q.getCompetencyKey(), q.getCompetencyName(),
                        q.getCompetencyWeight(), q.getCompetencyPosition(), q.getText(), q.getPosition()))
                .toList();

        Map<UUID, List<F360Assignment>> assignmentsBySubject = assignmentRepository.findByCampaignId(campaign.getId())
                .stream().collect(Collectors.groupingBy(a -> a.getSubject().getId()));
        Map<UUID, List<F360Answer>> answersBySubject = answerRepository
                .findSubmittedBySubjectIds(subjects.stream().map(F360Subject::getId).toList())
                .stream().collect(Collectors.groupingBy(a -> a.getSubject().getId()));

        Map<F360Relationship, Double> weights = F360Settings.weights(campaign);
        F360Settings.ReportSettings report = F360Settings.reportSettings(campaign);

        for (F360Subject s : subjects) {
            Map<F360Relationship, Integer> submitted = new EnumMap<>(F360Relationship.class);
            for (F360Assignment a : assignmentsBySubject.getOrDefault(s.getId(), List.of())) {
                if (a.getStatus() == F360AssignmentStatus.SUBMITTED) submitted.merge(a.getRelationship(), 1, Integer::sum);
            }
            List<F360ScoreCalculator.Answer> answers = answersBySubject.getOrDefault(s.getId(), List.of()).stream()
                    .filter(a -> a.getQuestion().getQuestionType() == F360QuestionType.RATING)
                    .map(a -> new F360ScoreCalculator.Answer(a.getRelationship(), a.getQuestion().getId(),
                            Boolean.TRUE.equals(a.getIsNa()) ? null : a.getScore()))
                    .toList();

            F360ResultSnapshot result = F360ScoreCalculator.compute(new F360ScoreCalculator.Input(
                    ratingDefs, answers, submitted, campaign.getScaleMax(), campaign.getAnonymityThreshold(),
                    Boolean.TRUE.equals(campaign.getManagerAnonymous()), weights,
                    report.blindSpotGap(), report.dispersionFlag()));

            s.setOverallScore(result.getOverallScore());
            s.setSelfScore(result.getSelfScore());
            s.setResponseCount(result.getResponseCount());
            s.setResultSnapshot(write(result));
            s.setStatus(Boolean.TRUE.equals(result.getInsufficient())
                    ? F360SubjectStatus.INSUFFICIENT : F360SubjectStatus.COMPLETED);
        }
        subjectRepository.saveAll(subjects);
    }

    // ============================================================
    // XEM BÁO CÁO
    // ============================================================

    @Transactional(readOnly = true)
    public F360ReportResponse getReport(UUID subjectId) {
        User me = access.currentUser();
        F360Subject subject = requireSubject(subjectId);
        access.requireReportAccess(me, subject);

        F360Campaign campaign = subject.getCampaign();
        boolean self = access.isSelf(me, subject);
        boolean canHide = !self && access.canManage(me, campaign.getOrganization().getId());
        F360ResultSnapshot result = read(subject.getResultSnapshot());

        return F360ReportResponse.builder()
                .subjectId(subject.getId())
                .userId(subject.getUser().getId())
                .fullName(subject.getUser().getFullName())
                .avatarUrl(subject.getUser().getAvatarUrl())
                .orgUnitName(subject.getOrgUnit() != null ? subject.getOrgUnit().getName() : null)
                .campaignId(campaign.getId())
                .campaignName(campaign.getName())
                .campaignStatus(campaign.getStatus())
                .subjectStatus(subject.getStatus())
                .closedAt(campaign.getClosedAt())
                .releasedAt(campaign.getReleasedAt())
                .result(result)
                .comments(comments(subject, result, canHide))
                .aiSummary(subject.getAiSummary())
                .canHideComments(canHide)
                .selfView(self)
                .comparison(self ? null : comparison(subject))
                .build();
    }

    /** Các báo cáo đã công bố của chính người dùng (xem xu hướng qua các chiến dịch). */
    @Transactional(readOnly = true)
    public List<F360MyReportResponse> myReports() {
        User me = access.currentUser();
        return subjectRepository.findByUserIdAndCampaignStatusIn(me.getId(), List.of(F360CampaignStatus.RELEASED))
                .stream()
                .filter(s -> Boolean.TRUE.equals(s.getCampaign().getReleaseToSubject()))
                .filter(s -> Boolean.TRUE.equals(s.getCampaign().getOrganization().getEnableFeedback360()))
                .map(s -> F360MyReportResponse.builder()
                        .subjectId(s.getId())
                        .campaignId(s.getCampaign().getId())
                        .campaignName(s.getCampaign().getName())
                        .releasedAt(s.getCampaign().getReleasedAt())
                        .overallScore(s.getOverallScore())
                        .selfScore(s.getSelfScore())
                        .scaleMax(s.getCampaign().getScaleMax())
                        .responseCount(s.getResponseCount())
                        .build())
                .toList();
    }

    /**
     * Ẩn một nhận xét vi phạm. Nhận xét đọc live nên ẩn có hiệu lực ngay; tóm tắt AI bị xoá cùng
     * transaction vì nó có thể đã hấp thụ nội dung vi phạm (§6.4).
     */
    @Transactional
    public void hideAnswer(UUID answerId, String reason) {
        User me = access.currentUser();
        F360Answer answer = answerRepository.findById(answerId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.comment"), "id", answerId));
        F360Subject subject = answer.getSubject();
        F360Campaign campaign = subject.getCampaign();
        access.requireManage(me, campaign.getOrganization());
        access.assertNotSelfTarget(me, subject);
        if (answer.getComment() == null || answer.getComment().isBlank()) {
            throw new BusinessException(ErrorCode.ANSWER_NO_COMMENT);
        }
        if (answer.getHiddenAt() != null) return;

        answer.setHiddenAt(Instant.now());
        answer.setHiddenBy(me);
        answer.setHiddenReason(reason);
        answerRepository.save(answer);

        subject.setAiSummary(null);
        subjectRepository.save(subject);
        // Tạo lại trên bộ nhận xét đã lọc (sau commit, bất đồng bộ).
        events.publishEvent(new com.kpitracking.event.F360Events.SummaryRequestedEvent(
                campaign.getId(), subject.getId(), me.getEmail()));

        eventRepository.save(F360Event.builder()
                .campaign(campaign).subject(subject).actor(me).action("HIDE_COMMENT")
                .detail(F360Settings.write(Map.of("reason", reason)))
                .build());
    }

    // ============================================================
    // NỘI BỘ
    // ============================================================

    private List<F360ReportResponse.CommentBlock> comments(F360Subject subject, F360ResultSnapshot result,
                                                           boolean includeHidden) {
        // Nhóm nào được hiện thì lấy từ chính bản chụp — nhận xét theo đúng luật nhóm của điểm.
        Map<String, F360ResultSnapshot.Group> groupOfRelationship = new HashMap<>();
        if (result != null) {
            for (F360ResultSnapshot.Group g : result.getGroups()) {
                g.getRelationships().forEach(r -> groupOfRelationship.put(r, g));
            }
        }

        Map<UUID, F360ReportResponse.CommentBlock> blocks = new LinkedHashMap<>();
        List<F360Answer> answers = answerRepository.findSubmittedBySubjectIds(List.of(subject.getId())).stream()
                .filter(a -> a.getQuestion().getQuestionType() == F360QuestionType.TEXT)
                .filter(a -> a.getComment() != null && !a.getComment().isBlank())
                .filter(a -> includeHidden || a.getHiddenAt() == null)
                .sorted(Comparator.comparing((F360Answer a) -> a.getQuestion().getPosition())
                        // Id là UUID ngẫu nhiên: thứ tự ổn định giữa các lần tải nhưng không lộ thứ tự nộp.
                        .thenComparing(a -> a.getId().toString()))
                .toList();

        for (F360Answer a : answers) {
            F360ResultSnapshot.Group g = groupOfRelationship.get(a.getRelationship().name());
            if (g == null || !Boolean.TRUE.equals(g.getVisible())) continue;
            F360CampaignQuestion q = a.getQuestion();
            blocks.computeIfAbsent(q.getId(), x -> F360ReportResponse.CommentBlock.builder()
                    .questionId(q.getId()).question(q.getText()).items(new ArrayList<>()).build())
                    .getItems().add(F360ReportResponse.Comment.builder()
                            .id(a.getId())
                            .text(a.getComment())
                            .groupLabel(g.getLabel())
                            .hidden(a.getHiddenAt() != null)
                            .build());
        }
        return new ArrayList<>(blocks.values());
    }

    /**
     * Nhận xét được phép đưa cho AI tóm tắt: đúng những nhận xét báo cáo hiện ra (nhóm qua ngưỡng,
     * chưa bị ẩn), KHÔNG kèm nhãn nhóm, dạng "câu hỏi: nhận xét".
     */
    List<String> visibleCommentsForSummary(F360Subject subject) {
        F360ResultSnapshot result = read(subject.getResultSnapshot());
        List<String> out = new ArrayList<>();
        for (F360ReportResponse.CommentBlock b : comments(subject, result, false)) {
            b.getItems().forEach(i -> out.add(b.getQuestion() + ": " + i.getText()));
        }
        Collections.shuffle(out);
        return out;
    }

    private F360ReportResponse.Comparison comparison(F360Subject subject) {
        F360AnalyticsService.Comparison c = analyticsService.unitComparison(subject);
        if (c == null) return null;
        return F360ReportResponse.Comparison.builder()
                .label(c.label()).subjectCount(c.subjectCount()).overall(c.overall())
                .byCompetency(c.byCompetencyKey()).build();
    }

    private F360Subject requireSubject(UUID subjectId) {
        return subjectRepository.findById(subjectId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.reviewee"), "id", subjectId));
    }

    private String write(F360ResultSnapshot result) {
        try {
            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            throw new IllegalStateException("Không ghi được kết quả 360", e);
        }
    }

    private F360ResultSnapshot read(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, F360ResultSnapshot.class);
        } catch (Exception e) {
            log.warn("Không đọc được bản chụp kết quả 360: {}", e.getMessage());
            return null;
        }
    }
}
