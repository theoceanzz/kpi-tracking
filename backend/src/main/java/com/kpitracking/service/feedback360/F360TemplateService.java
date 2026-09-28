package com.kpitracking.service.feedback360;

import com.kpitracking.dto.request.feedback360.F360TemplateRequest;
import com.kpitracking.dto.response.feedback360.F360TemplateResponse;
import com.kpitracking.entity.*;
import com.kpitracking.enums.F360QuestionType;
import com.kpitracking.enums.F360Relationship;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.Terms;
import com.kpitracking.mapper.F360Mapper;
import com.kpitracking.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/**
 * Bộ câu hỏi 360: CRUD, bộ mặc định và bộ mẫu sẵn (§9.6).
 *
 * Sửa bộ câu hỏi an toàn với chiến dịch đang chạy: chiến dịch chụp câu hỏi lúc launch, nên câu
 * cũ bị XOÁ MỀM chứ không đụng tới phiếu đã phát.
 */
@Service
@RequiredArgsConstructor
public class F360TemplateService {

    private static final double WEIGHT_TOLERANCE = 0.01;

    private final F360TemplateRepository templateRepository;
    private final F360CompetencyRepository competencyRepository;
    private final F360QuestionRepository questionRepository;
    private final OrganizationRepository organizationRepository;
    private final F360AccessPolicy access;
    private final F360Mapper mapper;

    // ============================================================
    // ĐỌC
    // ============================================================

    @Transactional(readOnly = true)
    public List<F360TemplateResponse> list(UUID organizationId) {
        User me = access.currentUser();
        Organization org = requireOrg(organizationId);
        access.requireMember(me, organizationId);
        access.requireEnabled(org);
        return templateRepository.findByOrganizationIdAndCampaignIdIsNullOrderByCreatedAtAsc(organizationId).stream()
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public F360TemplateResponse get(UUID organizationId, UUID templateId) {
        User me = access.currentUser();
        access.requireMember(me, organizationId);
        return toResponse(requireTemplate(organizationId, templateId));
    }

    // ============================================================
    // GHI
    // ============================================================

    @Transactional
    public F360TemplateResponse create(UUID organizationId, F360TemplateRequest request) {
        User me = access.currentUser();
        Organization org = requireOrg(organizationId);
        access.requireManage(me, org);

        List<F360Template> existing = templateRepository.findByOrganizationIdOrderByCreatedAtAsc(organizationId);
        F360Template source = null;
        if (request.getCopyFromId() != null) {
            source = requireTemplate(organizationId, request.getCopyFromId());
        } else if (isEmptyContent(request)) {
            source = existing.stream().filter(t -> Boolean.TRUE.equals(t.getIsDefault())).findFirst().orElse(null);
        }

        F360Template template = templateRepository.save(F360Template.builder()
                .organization(org)
                .name(uniqueName(existing, request.getName(), null))
                .description(request.getDescription())
                .scaleMax(request.getScaleMax() != null ? request.getScaleMax()
                        : source != null ? source.getScaleMax() : 5)
                // Bộ đầu tiên của tổ chức phải là mặc định, nếu không chiến dịch mới không có bộ nào để dùng.
                .isDefault(existing.isEmpty())
                .createdBy(me)
                .build());

        if (source != null) {
            copyContent(source, template);
        } else {
            replaceContent(template, request);
        }
        return toResponse(template);
    }

    @Transactional
    public F360TemplateResponse update(UUID organizationId, UUID templateId, F360TemplateRequest request) {
        User me = access.currentUser();
        Organization org = requireOrg(organizationId);
        access.requireManage(me, org);
        F360Template template = requireTemplate(organizationId, templateId);

        List<F360Template> existing = templateRepository.findByOrganizationIdOrderByCreatedAtAsc(organizationId);
        if (request.getName() != null && !request.getName().isBlank()) {
            template.setName(uniqueName(existing, request.getName(), template.getId()));
        }
        template.setDescription(request.getDescription());
        if (request.getScaleMax() != null) template.setScaleMax(request.getScaleMax());
        templateRepository.save(template);

        if (request.getCompetencies() != null || request.getOpenQuestions() != null) {
            replaceContent(template, request);
        }
        return toResponse(template);
    }

    @Transactional
    public void delete(UUID organizationId, UUID templateId) {
        User me = access.currentUser();
        Organization org = requireOrg(organizationId);
        access.requireManage(me, org);
        F360Template template = requireTemplate(organizationId, templateId);
        if (Boolean.TRUE.equals(template.getIsDefault())) {
            throw new BusinessException(ErrorCode.DEFAULT_SET_CANNOT_DELETED);
        }
        // Chiến dịch đã launch dùng bản chụp nên xoá mềm bộ gốc là an toàn; chiến dịch nháp đang
        // trỏ tới bộ này sẽ phải chọn bộ khác trước khi khởi động.
        template.setDeletedAt(Instant.now());
        templateRepository.save(template);
    }

    @Transactional
    public F360TemplateResponse markDefault(UUID organizationId, UUID templateId) {
        User me = access.currentUser();
        Organization org = requireOrg(organizationId);
        access.requireManage(me, org);
        F360Template target = requireTemplate(organizationId, templateId);
        List<F360Template> all = templateRepository.findByOrganizationIdOrderByCreatedAtAsc(organizationId);
        // Hạ bộ cũ trước rồi flush: unique index "một bộ mặc định mỗi tổ chức" kiểm tra theo từng câu lệnh.
        all.stream().filter(t -> Boolean.TRUE.equals(t.getIsDefault()) && !t.getId().equals(templateId))
                .forEach(t -> t.setIsDefault(false));
        templateRepository.saveAllAndFlush(all);
        target.setIsDefault(true);
        templateRepository.save(target);
        return toResponse(target);
    }

    /**
     * Gọi khi tổ chức BẬT 360: chưa có bộ nào thì dựng bộ mẫu để HR tạo được chiến dịch ngay.
     * Tắt rồi bật lại không ghi đè bộ đã tuỳ chỉnh.
     */
    @Transactional
    public void ensureDefaultTemplate(Organization org) {
        if (!templateRepository.findByOrganizationIdAndCampaignIdIsNullOrderByCreatedAtAsc(org.getId()).isEmpty()) return;
        F360Template template = templateRepository.save(F360Template.builder()
                .organization(org)
                .name("Bộ câu hỏi 360 mặc định")
                .description("5 năng lực cốt lõi và 3 câu nhận xét theo khung Tiếp tục – Bắt đầu – Dừng lại.")
                .scaleMax(5)
                .isDefault(true)
                .build());
        replaceContent(template, presetRequest());
    }

    /**
     * Bộ câu hỏi RIÊNG của một chiến dịch, soạn thẳng trong form chiến dịch (như hạng mục nằm trong bộ
     * tiêu chí BSC). Chiến dịch chưa có bộ riêng — mới tạo, hoặc đang trỏ vào bộ mẫu dùng chung — thì
     * tạo bộ mới gắn với nó; đã có thì thay nội dung tại chỗ. Bộ mẫu dùng chung không bao giờ bị sửa
     * qua đường này, nên chiến dịch khác chép từ nó không bị ảnh hưởng.
     */
    @Transactional
    public F360Template upsertOwned(F360Campaign campaign, F360TemplateRequest content, User actor) {
        F360Template current = campaign.getTemplate() == null ? null
                : templateRepository.findById(campaign.getTemplate().getId()).orElse(null);
        F360Template owned = current != null && campaign.getId().equals(current.getCampaignId()) ? current : null;
        if (owned == null) {
            owned = templateRepository.save(F360Template.builder()
                    .organization(campaign.getOrganization())
                    .campaignId(campaign.getId())
                    .name(uniqueName(templateRepository.findByOrganizationIdOrderByCreatedAtAsc(campaign.getOrganization().getId()),
                            "Câu hỏi: " + campaign.getName(), null))
                    .isDefault(false)
                    .createdBy(actor)
                    .build());
        }
        if (content.getScaleMax() != null) owned.setScaleMax(content.getScaleMax());
        owned.setDescription(content.getDescription());
        templateRepository.save(owned);
        replaceContent(owned, content);
        return owned;
    }

    /** Nạp bộ câu hỏi (kèm năng lực) — dùng khi chụp câu hỏi cho chiến dịch. */
    @Transactional(readOnly = true)
    public List<F360Question> loadQuestions(UUID templateId) {
        return questionRepository.findByTemplateIdWithCompetency(templateId);
    }

    // ============================================================
    // NỘI BỘ
    // ============================================================

    private boolean isEmptyContent(F360TemplateRequest r) {
        return (r.getCompetencies() == null || r.getCompetencies().isEmpty())
                && (r.getOpenQuestions() == null || r.getOpenQuestions().isEmpty());
    }

    /**
     * Thay TOÀN BỘ năng lực + câu hỏi. Tổng trọng số phải bằng 100 — kiểm ở đây chứ không để
     * giao diện tự lo, vì số này quyết định điểm tổng của mọi báo cáo dùng bộ này.
     */
    private void replaceContent(F360Template template, F360TemplateRequest request) {
        List<F360TemplateRequest.Competency> comps = Optional.ofNullable(request.getCompetencies()).orElse(List.of());
        List<F360TemplateRequest.Question> open = Optional.ofNullable(request.getOpenQuestions()).orElse(List.of());
        if (comps.isEmpty()) {
            throw new BusinessException(ErrorCode.QUESTION_SET_NEEDS_LEAST_ONE_COMPETENCY);
        }
        double total = comps.stream().mapToDouble(c -> c.getWeight() == null ? 0 : c.getWeight()).sum();
        if (Math.abs(total - 100.0) > WEIGHT_TOLERANCE) {
            throw new BusinessException(ErrorCode.TOTAL_COMPETENCY_WEIGHT_MUST_100_PERCENT, String.valueOf(Math.round(total * 100.0) / 100.0));
        }
        for (F360TemplateRequest.Competency c : comps) {
            if (c.getQuestions() == null || c.getQuestions().isEmpty()) {
                throw new BusinessException(ErrorCode.COMPETENCY_NO_QUESTIONS, c.getName());
            }
        }

        Instant now = Instant.now();
        questionRepository.findByTemplateIdWithCompetency(template.getId()).forEach(q -> q.setDeletedAt(now));
        competencyRepository.findByTemplateIdOrderByPositionAsc(template.getId()).forEach(c -> c.setDeletedAt(now));

        int qPos = 1;
        for (int i = 0; i < comps.size(); i++) {
            F360TemplateRequest.Competency c = comps.get(i);
            F360Competency saved = competencyRepository.save(F360Competency.builder()
                    .template(template)
                    .name(c.getName().trim())
                    .description(c.getDescription())
                    .weight(c.getWeight())
                    .position(i + 1)
                    .build());
            for (F360TemplateRequest.Question q : c.getQuestions()) {
                questionRepository.save(toQuestion(template, saved, q, F360QuestionType.RATING, qPos++));
            }
        }
        for (F360TemplateRequest.Question q : open) {
            questionRepository.save(toQuestion(template, null, q, F360QuestionType.TEXT, qPos++));
        }
    }

    private F360Question toQuestion(F360Template template, F360Competency competency,
                                    F360TemplateRequest.Question q, F360QuestionType type, int position) {
        return F360Question.builder()
                .template(template)
                .competency(competency)
                .questionType(type)
                .text(q.getText().trim())
                .relationships(com.kpitracking.util.F360Relationships.join(q.getRelationships()))
                // Câu mở mặc định KHÔNG bắt buộc: ép viết nhận xét thì người ta viết cho có.
                .required(q.getRequired() != null ? q.getRequired() : type == F360QuestionType.RATING)
                .allowNa(q.getAllowNa() != null ? q.getAllowNa() : true)
                .position(position)
                .build();
    }

    private void copyContent(F360Template source, F360Template target) {
        F360TemplateResponse src = toResponse(source);
        F360TemplateRequest req = F360TemplateRequest.builder()
                .competencies(src.getCompetencies().stream().map(c -> F360TemplateRequest.Competency.builder()
                        .name(c.getName()).description(c.getDescription()).weight(c.getWeight())
                        .questions(c.getQuestions().stream().map(this::toQuestionRequest).toList())
                        .build()).toList())
                .openQuestions(src.getOpenQuestions().stream().map(this::toQuestionRequest).toList())
                .build();
        replaceContent(target, req);
    }

    private F360TemplateRequest.Question toQuestionRequest(F360TemplateResponse.Question q) {
        return F360TemplateRequest.Question.builder()
                .text(q.getText()).relationships(q.getRelationships())
                .required(q.getRequired()).allowNa(q.getAllowNa()).build();
    }

    F360TemplateResponse toResponse(F360Template template) {
        F360TemplateResponse res = mapper.toTemplateResponse(template);
        List<F360Competency> comps = competencyRepository.findByTemplateIdOrderByPositionAsc(template.getId());
        List<F360Question> questions = questionRepository.findByTemplateIdWithCompetency(template.getId());

        Map<UUID, List<F360TemplateResponse.Question>> byComp = new HashMap<>();
        List<F360TemplateResponse.Question> open = new ArrayList<>();
        for (F360Question q : questions) {
            F360TemplateResponse.Question dto = mapper.toQuestionResponse(q);
            if (q.getCompetency() == null) open.add(dto);
            else byComp.computeIfAbsent(q.getCompetency().getId(), x -> new ArrayList<>()).add(dto);
        }
        res.setCompetencies(comps.stream().map(c -> {
            F360TemplateResponse.Competency dto = mapper.toCompetencyResponse(c);
            dto.setQuestions(byComp.getOrDefault(c.getId(), List.of()));
            return dto;
        }).toList());
        res.setOpenQuestions(open);
        res.setTotalWeight(Math.round(comps.stream().mapToDouble(F360Competency::getWeight).sum() * 100.0) / 100.0);
        return res;
    }

    private String uniqueName(List<F360Template> existing, String raw, UUID selfId) {
        String base = raw == null || raw.isBlank() ? "Bộ câu hỏi 360" : raw.trim();
        Set<String> taken = new HashSet<>();
        existing.stream().filter(t -> !t.getId().equals(selfId)).forEach(t -> taken.add(t.getName().toLowerCase()));
        String name = base;
        for (int i = 2; taken.contains(name.toLowerCase()); i++) name = base + " (" + i + ")";
        return name;
    }

    private Organization requireOrg(UUID organizationId) {
        return organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.organization"), "id", organizationId));
    }

    F360Template requireTemplate(UUID organizationId, UUID templateId) {
        return templateRepository.findByIdAndOrganizationId(templateId, organizationId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.f360QuestionSet"), "id", templateId));
    }

    /**
     * Bộ mẫu (§9.6). Năng lực "Lãnh đạo" chỉ hỏi CẤP DƯỚI — nhờ vậy nó chỉ xuất hiện với người có
     * cấp dưới; phiếu tự đánh giá cũng chỉ hỏi những câu mà người khác sẽ trả lời (xem
     * F360ResponseService), nên nhân viên không bị hỏi về năng lực lãnh đạo của chính mình.
     */
    private static F360TemplateRequest presetRequest() {
        List<F360Relationship> reportsOnly = List.of(F360Relationship.DIRECT_REPORT);
        return F360TemplateRequest.builder()
                .competencies(List.of(
                        competency("Giao tiếp", 20,
                                q("Truyền đạt rõ ràng, đúng trọng tâm, dễ hiểu", null),
                                q("Lắng nghe và phản hồi ý kiến của người khác một cách tôn trọng", null)),
                        competency("Hợp tác & làm việc nhóm", 20,
                                q("Sẵn sàng hỗ trợ đồng nghiệp khi cần", null),
                                q("Chia sẻ thông tin, kiến thức kịp thời cho những người liên quan", null)),
                        competency("Trách nhiệm & chủ động", 20,
                                q("Giữ đúng cam kết về chất lượng và thời hạn", null),
                                q("Chủ động phát hiện vấn đề và đề xuất giải pháp", null)),
                        competency("Chuyên môn", 20,
                                q("Có kiến thức, kỹ năng vững cho công việc được giao", null),
                                q("Liên tục học hỏi và cải tiến cách làm", null)),
                        competency("Lãnh đạo", 20,
                                q("Đặt định hướng và mục tiêu rõ ràng cho đội ngũ", reportsOnly),
                                q("Ghi nhận, phản hồi và giúp cấp dưới phát triển", reportsOnly))))
                .openQuestions(List.of(
                        open("Người này nên TIẾP TỤC làm gì?"),
                        open("Người này nên BẮT ĐẦU làm gì?"),
                        open("Người này nên DỪNG làm gì?")))
                .build();
    }

    private static F360TemplateRequest.Competency competency(String name, double weight,
                                                             F360TemplateRequest.Question... qs) {
        return F360TemplateRequest.Competency.builder().name(name).weight(weight).questions(List.of(qs)).build();
    }

    private static F360TemplateRequest.Question q(String text, List<F360Relationship> rels) {
        return F360TemplateRequest.Question.builder().text(text).relationships(rels).required(true).allowNa(true).build();
    }

    private static F360TemplateRequest.Question open(String text) {
        return F360TemplateRequest.Question.builder().text(text).required(false).allowNa(true).build();
    }
}
