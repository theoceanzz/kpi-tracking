package com.kpitracking.service.feedback360;

import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.dto.request.feedback360.F360AnswersRequest;
import com.kpitracking.dto.response.feedback360.F360FormResponse;
import com.kpitracking.dto.response.feedback360.F360TaskResponse;
import com.kpitracking.entity.*;
import com.kpitracking.enums.*;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.Terms;
import com.kpitracking.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Phía NGƯỜI CHẤM: hộp "Cần đánh giá", mở phiếu, lưu nháp, nộp, từ chối.
 *
 * <p>Không cần quyền riêng — ai là {@code rater} của phiếu thì chấm được phiếu đó, kiểm ở đây.
 * Không ghi nhật ký cho việc nộp phiếu: dòng "X nộp lúc 10:02" cạnh câu trả lời là đủ để lần ra
 * ai chấm gì.
 */
@Service
@RequiredArgsConstructor
public class F360ResponseService {

    private static final int MAX_COMMENT_LENGTH = 2000;

    private final F360AssignmentRepository assignmentRepository;
    private final F360AnswerRepository answerRepository;
    private final F360CampaignQuestionRepository campaignQuestionRepository;
    private final F360AccessPolicy access;
    private final org.springframework.context.ApplicationEventPublisher events;

    @Transactional(readOnly = true)
    public List<F360TaskResponse> myTasks() {
        User me = access.currentUser();
        return assignmentRepository.findRaterTasks(me.getId(),
                        List.of(F360CampaignStatus.OPEN),
                        List.of(F360AssignmentStatus.PENDING, F360AssignmentStatus.IN_PROGRESS,
                                F360AssignmentStatus.SUBMITTED, F360AssignmentStatus.DECLINED))
                .stream()
                .filter(a -> Boolean.TRUE.equals(a.getSubject().getCampaign().getOrganization().getEnableFeedback360()))
                // Tự đánh giá lên đầu, rồi phiếu còn dở trước phiếu đã xong.
                .sorted(Comparator.comparing((F360Assignment a) -> a.getRelationship() != F360Relationship.SELF)
                        .thenComparing(a -> !a.getStatus().open())
                        .thenComparing(a -> a.getSubject().getUser().getFullName() == null ? "" : a.getSubject().getUser().getFullName()))
                .map(a -> {
                    F360Campaign c = a.getSubject().getCampaign();
                    return F360TaskResponse.builder()
                            .assignmentId(a.getId())
                            .campaignId(c.getId())
                            .campaignName(c.getName())
                            .dueAt(c.getDueAt())
                            .subjectUserId(a.getSubject().getUser().getId())
                            .subjectName(a.getSubject().getUser().getFullName())
                            .subjectAvatarUrl(a.getSubject().getUser().getAvatarUrl())
                            .relationship(a.getRelationship())
                            .status(a.getStatus())
                            .anonymous(F360AnonymityGuard.isAnonymousRelationship(
                                    a.getRelationship(), Boolean.TRUE.equals(c.getManagerAnonymous())))
                            .submittedAt(a.getSubmittedAt())
                            .build();
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public F360FormResponse getForm(UUID assignmentId) {
        User me = access.currentUser();
        F360Assignment a = requireOwn(me, assignmentId);
        return toForm(a, answerRepository.findByAssignmentId(a.getId()));
    }

    @Transactional
    public F360FormResponse saveDraft(UUID assignmentId, F360AnswersRequest request) {
        User me = access.currentUser();
        F360Assignment a = requireEditable(me, assignmentId);
        List<F360Answer> answers = upsert(a, request);
        if (a.getStatus() == F360AssignmentStatus.PENDING) {
            a.setStatus(F360AssignmentStatus.IN_PROGRESS);
            a.setStartedAt(Instant.now());
            assignmentRepository.save(a);
        }
        return toForm(a, answers);
    }

    @Transactional
    public F360FormResponse submit(UUID assignmentId, F360AnswersRequest request) {
        User me = access.currentUser();
        F360Assignment a = requireEditable(me, assignmentId);
        List<F360Answer> answers = upsert(a, request);

        Map<UUID, F360Answer> byQuestion = answers.stream()
                .collect(Collectors.toMap(x -> x.getQuestion().getId(), x -> x, (x, y) -> x));
        List<String> missing = new ArrayList<>();
        for (F360CampaignQuestion q : applicableQuestions(a)) {
            if (!Boolean.TRUE.equals(q.getRequired())) continue;
            F360Answer ans = byQuestion.get(q.getId());
            boolean ok = q.getQuestionType() == F360QuestionType.RATING
                    ? ans != null && (ans.getScore() != null || Boolean.TRUE.equals(ans.getIsNa()))
                    : ans != null && ans.getComment() != null && !ans.getComment().isBlank();
            if (!ok) missing.add(q.getText());
        }
        if (!missing.isEmpty()) {
            throw new BusinessException(ErrorCode.REQUIRED_QUESTIONS_UNANSWERED, String.valueOf(missing.size()), String.join("; ",
                    missing.stream().limit(3).toList()), String.valueOf((missing.size() > 3 ? "…" : "")));
        }
        if (a.getStartedAt() == null) a.setStartedAt(Instant.now());
        a.setStatus(F360AssignmentStatus.SUBMITTED);
        a.setSubmittedAt(Instant.now());
        assignmentRepository.save(a);
        return toForm(a, answers);
    }

    /** Từ chối chấm (vd "không làm việc cùng"). Tự đánh giá không từ chối được. */
    @Transactional
    public void decline(UUID assignmentId, String reason) {
        User me = access.currentUser();
        F360Assignment a = requireEditable(me, assignmentId);
        if (a.getRelationship() == F360Relationship.SELF) {
            throw new BusinessException(ErrorCode.SELF_ASSESSMENT_CANNOT_DECLINED);
        }
        answerRepository.deleteByAssignmentId(a.getId());
        a.setStatus(F360AssignmentStatus.DECLINED);
        a.setDeclineReason(reason);
        assignmentRepository.save(a);
        events.publishEvent(new com.kpitracking.event.F360Events.AssignmentDeclinedEvent(a.getId()));
    }

    // ============================================================
    // NỘI BỘ
    // ============================================================

    private F360Assignment requireOwn(User me, UUID assignmentId) {
        F360Assignment a = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.evaluationForm"), "id", assignmentId));
        // Không phải phiếu của mình thì trả như không tồn tại — không xác nhận phiếu đó có thật.
        if (!a.getRater().getId().equals(me.getId())) {
            throw new ResourceNotFoundException(Terms.of("resource.evaluationForm"), "id", assignmentId);
        }
        F360Campaign c = a.getSubject().getCampaign();
        access.requireEnabled(c.getOrganization());
        if (a.getStatus() == F360AssignmentStatus.REMOVED || a.getSubject().getDeletedAt() != null
                || c.getStatus() == F360CampaignStatus.DRAFT) {
            throw new ForbiddenException(ErrorCode.FORM_NO_LONGER_VALID);
        }
        return a;
    }

    private F360Assignment requireEditable(User me, UUID assignmentId) {
        F360Assignment a = requireOwn(me, assignmentId);
        if (a.getSubject().getCampaign().getStatus() != F360CampaignStatus.OPEN) {
            throw new BusinessException(ErrorCode.CAMPAIGN_CLOSED_FORM_CANNOT_EDITED);
        }
        if (!a.getStatus().open()) {
            throw new BusinessException(a.getStatus() == F360AssignmentStatus.SUBMITTED ? ErrorCode.FORM_SUBMITTED_CANNOT_EDITED : ErrorCode.FORM_NO_LONGER_OPEN_EDITING);
        }
        return a;
    }

    /**
     * Câu hỏi áp cho phiếu này. Câu chỉ hỏi một số nhóm thì người ngoài nhóm không thấy. Riêng tự
     * đánh giá: chỉ hỏi những câu mà ÍT NHẤT MỘT người chấm khác của mình sẽ trả lời — nhờ vậy
     * nhân viên không bị hỏi về năng lực lãnh đạo khi không ai chấm họ ở năng lực đó, còn trưởng
     * đơn vị thì có điểm tự đánh giá để so với cấp dưới.
     */
    List<F360CampaignQuestion> applicableQuestions(F360Assignment a) {
        List<F360CampaignQuestion> all = campaignQuestionRepository.findByCampaignId(a.getSubject().getCampaign().getId());
        Set<F360Relationship> othersPresent = a.getRelationship() == F360Relationship.SELF
                ? assignmentRepository.findBySubjectId(a.getSubject().getId()).stream()
                        .filter(x -> x.getStatus() != F360AssignmentStatus.REMOVED
                                && x.getRelationship() != F360Relationship.SELF)
                        .map(F360Assignment::getRelationship).collect(Collectors.toSet())
                : Set.of();
        return all.stream().filter(q -> {
            List<F360Relationship> rels = com.kpitracking.util.F360Relationships.parse(q.getRelationships());
            if (rels.isEmpty()) return true;
            if (a.getRelationship() == F360Relationship.SELF) {
                return rels.contains(F360Relationship.SELF) || rels.stream().anyMatch(othersPresent::contains);
            }
            return rels.contains(a.getRelationship());
        }).sorted(Comparator
                .comparing((F360CampaignQuestion q) -> q.getQuestionType() == F360QuestionType.TEXT)
                .thenComparing(q -> q.getCompetencyPosition() == null ? Integer.MAX_VALUE : q.getCompetencyPosition())
                .thenComparing(F360CampaignQuestion::getPosition)).toList();
    }

    private List<F360Answer> upsert(F360Assignment a, F360AnswersRequest request) {
        Map<UUID, F360CampaignQuestion> questions = applicableQuestions(a).stream()
                .collect(Collectors.toMap(F360CampaignQuestion::getId, q -> q));
        Map<UUID, F360Answer> existing = answerRepository.findByAssignmentId(a.getId()).stream()
                .collect(Collectors.toMap(x -> x.getQuestion().getId(), x -> x, (x, y) -> x, LinkedHashMap::new));
        int scaleMax = a.getSubject().getCampaign().getScaleMax();

        List<F360AnswersRequest.Item> items = request != null && request.getAnswers() != null ? request.getAnswers() : List.of();
        List<F360Answer> toSave = new ArrayList<>();
        for (F360AnswersRequest.Item item : items) {
            F360CampaignQuestion q = questions.get(item.getQuestionId());
            if (q == null) throw new BusinessException(ErrorCode.QUESTION_OUTSIDE_FORM);

            F360Answer ans = existing.get(q.getId());
            if (ans == null) {
                ans = F360Answer.builder()
                        .assignment(a).subject(a.getSubject()).relationship(a.getRelationship()).question(q)
                        .build();
                existing.put(q.getId(), ans);
            }
            if (q.getQuestionType() == F360QuestionType.RATING) {
                boolean na = Boolean.TRUE.equals(item.getNa());
                if (na && !Boolean.TRUE.equals(q.getAllowNa())) {
                    throw new BusinessException(ErrorCode.QUESTION_DOES_NOT_ALLOW_CHOOSING_CANNOT_ASSESS, String.valueOf(q.getText()));
                }
                Double score = na ? null : item.getScore();
                if (score != null && (score < 1 || score > scaleMax || score % 1 != 0)) {
                    throw new BusinessException(ErrorCode.SCORE_MUST_INTEGER_1, String.valueOf(scaleMax));
                }
                ans.setIsNa(na);
                ans.setScore(score);
            } else {
                String comment = item.getComment() == null ? null : item.getComment().trim();
                if (comment != null && comment.length() > MAX_COMMENT_LENGTH) {
                    throw new BusinessException(ErrorCode.COMMENTS_CAN_MOST_CHARACTERS, String.valueOf(MAX_COMMENT_LENGTH));
                }
                ans.setComment(comment == null || comment.isEmpty() ? null : comment);
            }
            toSave.add(ans);
        }
        answerRepository.saveAll(toSave);
        return new ArrayList<>(existing.values());
    }

    private F360FormResponse toForm(F360Assignment a, List<F360Answer> answers) {
        F360Campaign c = a.getSubject().getCampaign();
        Map<UUID, F360Answer> byQuestion = answers.stream()
                .collect(Collectors.toMap(x -> x.getQuestion().getId(), x -> x, (x, y) -> x));

        Map<String, F360FormResponse.Section> sections = new LinkedHashMap<>();
        for (F360CampaignQuestion q : applicableQuestions(a)) {
            boolean open = q.getQuestionType() == F360QuestionType.TEXT || q.getCompetencyKey() == null;
            String key = open ? "__open__" : q.getCompetencyKey().toString();
            F360FormResponse.Section section = sections.computeIfAbsent(key, x -> F360FormResponse.Section.builder()
                    .competencyKey(open ? null : q.getCompetencyKey())
                    .title(open ? ErrorMessages.text("f360.generalComment", "") : q.getCompetencyName())
                    .questions(new ArrayList<>())
                    .build());
            F360Answer ans = byQuestion.get(q.getId());
            section.getQuestions().add(F360FormResponse.Question.builder()
                    .id(q.getId())
                    .questionType(q.getQuestionType())
                    .text(q.getText())
                    .required(q.getRequired())
                    .allowNa(q.getAllowNa())
                    .score(ans != null ? ans.getScore() : null)
                    .na(ans != null && Boolean.TRUE.equals(ans.getIsNa()))
                    .comment(ans != null ? ans.getComment() : null)
                    .build());
        }

        boolean editable = c.getStatus() == F360CampaignStatus.OPEN && a.getStatus().open();
        User subject = a.getSubject().getUser();
        return F360FormResponse.builder()
                .assignmentId(a.getId())
                .campaignId(c.getId())
                .campaignName(c.getName())
                .dueAt(c.getDueAt())
                .subjectName(subject.getFullName())
                .subjectAvatarUrl(subject.getAvatarUrl())
                .subjectOrgUnitName(a.getSubject().getOrgUnit() != null ? a.getSubject().getOrgUnit().getName() : null)
                .relationship(a.getRelationship())
                .status(a.getStatus())
                .editable(editable)
                .anonymous(F360AnonymityGuard.isAnonymousRelationship(a.getRelationship(),
                        Boolean.TRUE.equals(c.getManagerAnonymous())))
                .strictAnonymity(c.getStrictAnonymity())
                .anonymityThreshold(c.getAnonymityThreshold())
                .scaleMax(c.getScaleMax())
                .sections(new ArrayList<>(sections.values()))
                .build();
    }
}
