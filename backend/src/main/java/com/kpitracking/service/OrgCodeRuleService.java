package com.kpitracking.service;

import com.kpitracking.dto.request.organization.OrgCodeRuleRequest;
import com.kpitracking.dto.response.organization.CodePreviewResponse;
import com.kpitracking.dto.response.organization.OrgCodeRuleResponse;
import com.kpitracking.entity.OrgCodeRule;
import com.kpitracking.entity.Organization;
import com.kpitracking.enums.CodeType;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.BscPerspectiveRepository;
import com.kpitracking.repository.KeyResultRepository;
import com.kpitracking.repository.ObjectiveRepository;
import com.kpitracking.repository.OrgCodeRuleRepository;
import com.kpitracking.repository.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Quy tắc sinh mã theo tổ chức: đọc/ghi cấu hình, và cấp mã khi tạo mới Mục tiêu, Kết quả
 * then chốt, Hạng mục BSC.
 *
 * Số thứ tự KHÔNG có bộ đếm riêng: mỗi lần cấp mã, service dựng tiền tố từ mẫu rồi tìm số
 * lớn nhất trong các mã đã có cùng tiền tố, cộng 1. Cách này chịu được mọi thứ hay xảy ra
 * thật — sửa mẫu giữa kỳ, nhập Excel mã đặt tay, xoá bản ghi — mà không sinh ra hai nguồn
 * sự thật về "đã cấp tới số nào". Đổi lại mã có thể nhảy số khi xoá bản ghi cuối, và hai
 * giao dịch tạo song song có thể chọn cùng số; vòng thử lại bên dưới cùng phép kiểm trùng
 * ở service gọi đến sẽ chặn trường hợp đó.
 */
@Service
@RequiredArgsConstructor
public class OrgCodeRuleService {

    /** Ô số thứ tự trong mẫu: số dấu # là số chữ số, {###} thành 007. */
    private static final Pattern SEQ_TOKEN = Pattern.compile("\\{(#+)}");
    /** Ký tự phân cách được dọn khi token nội suy ra chuỗi rỗng. */
    private static final String SEPARATOR_CLASS = "[-_./]";
    private static final int MAX_CODE_LENGTH = 50;
    private static final int MAX_ATTEMPTS = 500;
    /** Mã đơn vị giả lập khi xem trước — lúc đó chưa biết mục tiêu sẽ giao cho đơn vị nào. */
    private static final String SAMPLE_UNIT_CODE = "DV01";

    private final OrgCodeRuleRepository ruleRepository;
    private final OrganizationRepository organizationRepository;
    private final ObjectiveRepository objectiveRepository;
    private final KeyResultRepository keyResultRepository;
    private final BscPerspectiveRepository perspectiveRepository;

    // ============================================================
    // Cấu hình
    // ============================================================

    @Transactional(readOnly = true)
    public List<OrgCodeRuleResponse> getRules(UUID organizationId) {
        Organization organization = loadOrganization(organizationId);
        List<OrgCodeRuleResponse> result = new ArrayList<>();
        for (CodeType type : CodeType.values()) {
            result.add(toResponse(organization, effectiveRule(organization, type)));
        }
        return result;
    }

    @Transactional
    public List<OrgCodeRuleResponse> updateRules(UUID organizationId, List<OrgCodeRuleRequest> requests) {
        Organization organization = loadOrganization(organizationId);
        if (requests == null || requests.isEmpty()) {
            throw new BusinessException("Không có quy tắc nào được gửi lên");
        }

        for (OrgCodeRuleRequest request : requests) {
            if (request.getCodeType() == null) throw new BusinessException("Thiếu loại mã");
            CodeType type = request.getCodeType();

            OrgCodeRule rule = ruleRepository.findByOrganizationIdAndCodeType(organizationId, type)
                    .orElseGet(() -> OrgCodeRule.builder()
                            .organization(organization)
                            .codeType(type)
                            .pattern(type.getDefaultPattern())
                            .build());

            String pattern = trimToNull(request.getPattern());
            if (pattern != null) {
                validatePattern(type, pattern);
                rule.setPattern(pattern);
            }
            if (request.getAutoGenerate() != null) rule.setAutoGenerate(request.getAutoGenerate());
            if (request.getAllowManualOverride() != null) rule.setAllowManualOverride(request.getAllowManualOverride());

            ruleRepository.save(rule);
        }

        return getRules(organizationId);
    }

    /**
     * Mã sẽ sinh ra nếu tạo mới ngay lúc này. Tham số pattern để trống thì dùng mẫu đang
     * lưu; có giá trị thì thử mẫu người dùng đang gõ mà chưa lưu.
     */
    @Transactional(readOnly = true)
    public CodePreviewResponse preview(UUID organizationId, CodeType type, String pattern) {
        Organization organization = loadOrganization(organizationId);
        String typed = trimToNull(pattern);
        String effective = typed != null ? typed : effectiveRule(organization, type).getPattern();
        validatePattern(type, effective);
        return CodePreviewResponse.builder()
                .codeType(type)
                .pattern(effective)
                .code(build(organization, type, effective, sampleParentCode(organization, type), SAMPLE_UNIT_CODE))
                .build();
    }

    // ============================================================
    // Cấp mã
    // ============================================================

    /**
     * Mã dùng khi TẠO MỚI: sinh theo mẫu, hoặc lấy mã người dùng nhập nếu tổ chức cho phép.
     *
     * @param requestedCode mã người dùng gửi lên, có thể null/rỗng
     * @param parentCode    mã đối tượng cha cho token {PARENT} (KR thì là mã Objective)
     * @param unitCode      mã đơn vị cho token {UNIT}
     */
    @Transactional
    public String resolveOnCreate(Organization organization, CodeType type, String requestedCode,
                                  String parentCode, String unitCode) {
        OrgCodeRule rule = effectiveRule(organization, type);
        String requested = trimToNull(requestedCode);

        if (Boolean.TRUE.equals(rule.getAutoGenerate())) {
            if (requested != null && Boolean.TRUE.equals(rule.getAllowManualOverride())) return requested;
            return build(organization, type, rule.getPattern(), parentCode, unitCode);
        }

        if (requested == null) {
            throw new BusinessException("Vui lòng nhập mã " + type.getLabel()
                    + " (tổ chức đang tắt sinh mã tự động cho loại này)");
        }
        return requested;
    }

    /**
     * Mã dùng khi CẬP NHẬT. Mã sinh tự động và không cho ghi đè thì giữ nguyên mã cũ: nó đã
     * nằm trong báo cáo, phiếu chấm, tệp xuất Excel — đổi giữa kỳ là mất dấu đối chiếu.
     */
    @Transactional(readOnly = true)
    public String resolveOnUpdate(UUID organizationId, CodeType type, String requestedCode, String currentCode) {
        Organization organization = loadOrganization(organizationId);
        OrgCodeRule rule = effectiveRule(organization, type);
        String requested = trimToNull(requestedCode);

        if (isCodeLocked(rule)) return currentCode;
        if (requested == null) return currentCode;
        return requested;
    }

    private boolean isCodeLocked(OrgCodeRule rule) {
        return Boolean.TRUE.equals(rule.getAutoGenerate())
                && !Boolean.TRUE.equals(rule.getAllowManualOverride());
    }

    // ============================================================
    // Dựng mã
    // ============================================================

    private String build(Organization organization, CodeType type, String pattern,
                         String parentCode, String unitCode) {
        String rendered = renderTokens(pattern, organization, parentCode, unitCode);
        List<String> existing = existingCodes(organization.getId(), type);
        Set<String> taken = new HashSet<>();
        for (String code : existing) {
            if (code != null && !code.isBlank()) taken.add(code.trim().toLowerCase(Locale.ROOT));
        }

        Matcher matcher = SEQ_TOKEN.matcher(rendered);
        if (!matcher.find()) {
            // Mẫu không có ô số — chỉ gặp với dữ liệu cũ, validate đã chặn từ lúc lưu.
            if (taken.contains(rendered.toLowerCase(Locale.ROOT))) {
                throw new BusinessException("Mã " + rendered + " đã tồn tại mà mẫu mã không có ô số thứ tự");
            }
            return checkLength(rendered, type);
        }

        String prefix = rendered.substring(0, matcher.start());
        String suffix = rendered.substring(matcher.end());
        int width = matcher.group(1).length();
        int next = nextNumber(prefix, suffix, width, existing);

        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            String candidate = prefix + pad(next + attempt, width) + suffix;
            if (!taken.contains(candidate.toLowerCase(Locale.ROOT))) return checkLength(candidate, type);
        }
        throw new BusinessException("Không cấp được mã mới cho " + type.getLabel()
                + " theo mẫu " + pattern + " — mẫu đã dùng hết số thứ tự");
    }

    /** Số lớn nhất đã dùng trong các mã cùng tiền tố/hậu tố, cộng 1. Chưa có mã nào thì là 1. */
    private int nextNumber(String prefix, String suffix, int width, List<String> codes) {
        Pattern shape = Pattern.compile(
                "^" + Pattern.quote(prefix) + "(\\d{" + width + ",})" + Pattern.quote(suffix) + "$",
                Pattern.CASE_INSENSITIVE);
        int max = 0;
        for (String code : codes) {
            if (code == null || code.isBlank()) continue;
            Matcher m = shape.matcher(code.trim());
            if (!m.matches()) continue;
            try {
                max = Math.max(max, Integer.parseInt(m.group(1)));
            } catch (NumberFormatException ignored) {
                // Số dài quá sức int: bỏ qua, coi như không tham gia đánh số.
            }
        }
        return max + 1;
    }

    private String renderTokens(String pattern, Organization organization, String parentCode, String unitCode) {
        LocalDate today = LocalDate.now();
        String rendered = pattern
                .replace("{YYYY}", String.valueOf(today.getYear()))
                .replace("{YY}", String.format("%02d", today.getYear() % 100))
                .replace("{MM}", String.format("%02d", today.getMonthValue()))
                .replace("{ORG}", nullToEmpty(organization.getCode()))
                .replace("{UNIT}", nullToEmpty(unitCode))
                .replace("{PARENT}", nullToEmpty(parentCode));
        return collapseSeparators(rendered);
    }

    /**
     * Token nội suy ra chuỗi rỗng (mục tiêu chưa giao đơn vị nào, tổ chức chưa có mã) để lại
     * dấu phân cách chơ vơ: {UNIT}-OBJ-{###} thành -OBJ-{###}. Dọn cho mã còn đọc được.
     */
    private String collapseSeparators(String value) {
        String out = value.replaceAll("(" + SEPARATOR_CLASS + ")" + SEPARATOR_CLASS + "+", "$1");
        out = out.replaceAll("^" + SEPARATOR_CLASS + "+", "");
        out = out.replaceAll(SEPARATOR_CLASS + "+$", "");
        return out;
    }

    private String pad(int number, int width) {
        return String.format("%0" + width + "d", number);
    }

    private String checkLength(String code, CodeType type) {
        if (code.length() > MAX_CODE_LENGTH) {
            throw new BusinessException("Mã sinh ra cho " + type.getLabel() + " dài " + code.length()
                    + " ký tự, vượt giới hạn " + MAX_CODE_LENGTH + " — hãy rút ngắn mẫu mã");
        }
        return code;
    }

    private List<String> existingCodes(UUID organizationId, CodeType type) {
        return switch (type) {
            case OBJECTIVE -> objectiveRepository.findCodesByOrganizationId(organizationId);
            case KEY_RESULT -> keyResultRepository.findCodesByOrganizationId(organizationId);
            case BSC_PERSPECTIVE -> perspectiveRepository.findCodesByOrganizationId(organizationId);
        };
    }

    // ============================================================
    // Kiểm tra mẫu
    // ============================================================

    private void validatePattern(CodeType type, String pattern) {
        String value = trimToNull(pattern);
        if (value == null) {
            throw new BusinessException("Mẫu mã của " + type.getLabel() + " không được để trống");
        }
        if (value.length() > 100) {
            throw new BusinessException("Mẫu mã của " + type.getLabel() + " tối đa 100 ký tự");
        }

        Matcher seq = SEQ_TOKEN.matcher(value);
        int count = 0;
        int width = 0;
        while (seq.find()) {
            count++;
            width = seq.group(1).length();
        }
        if (count == 0) {
            throw new BusinessException("Mẫu mã của " + type.getLabel()
                    + " phải có ô số thứ tự, ví dụ {###} cho số 3 chữ số");
        }
        if (count > 1) {
            throw new BusinessException("Mẫu mã của " + type.getLabel() + " chỉ được có MỘT ô số thứ tự");
        }
        if (width > 8) {
            throw new BusinessException("Ô số thứ tự tối đa 8 chữ số");
        }

        String literal = SEQ_TOKEN.matcher(value).replaceAll("");
        for (String token : type.getTokens()) literal = literal.replace(token, "");
        if (literal.contains("{") || literal.contains("}")) {
            throw new BusinessException("Mẫu mã của " + type.getLabel() + " chứa token không hỗ trợ. "
                    + "Token dùng được: " + String.join(", ", type.getTokens()) + ", {###}");
        }
        if (!literal.matches(type.getLiteralRegex())) {
            boolean underscoreOnly = "^[A-Za-z0-9_]*$".equals(type.getLiteralRegex());
            throw new BusinessException("Phần chữ trong mẫu mã của " + type.getLabel() + " chỉ gồm chữ, số"
                    + (underscoreOnly ? " và dấu gạch dưới" : " và các dấu - _ . /"));
        }
    }

    // ============================================================
    // Nội bộ
    // ============================================================

    /** Quy tắc đang lưu, hoặc bản mặc định (chưa ghi DB) để tổ chức nào cũng có mã tự sinh. */
    private OrgCodeRule effectiveRule(Organization organization, CodeType type) {
        return ruleRepository.findByOrganizationIdAndCodeType(organization.getId(), type)
                .orElseGet(() -> OrgCodeRule.builder()
                        .organization(organization)
                        .codeType(type)
                        .pattern(type.getDefaultPattern())
                        .autoGenerate(true)
                        .allowManualOverride(false)
                        .build());
    }

    private OrgCodeRuleResponse toResponse(Organization organization, OrgCodeRule rule) {
        String preview = null;
        String previewError = null;
        try {
            validatePattern(rule.getCodeType(), rule.getPattern());
            preview = build(organization, rule.getCodeType(), rule.getPattern(),
                    sampleParentCode(organization, rule.getCodeType()), SAMPLE_UNIT_CODE);
        } catch (BusinessException e) {
            previewError = e.getMessage();
        }

        return OrgCodeRuleResponse.builder()
                .codeType(rule.getCodeType())
                .label(rule.getCodeType().getLabel())
                .pattern(rule.getPattern())
                .autoGenerate(rule.getAutoGenerate())
                .allowManualOverride(rule.getAllowManualOverride())
                .supportedTokens(rule.getCodeType().getTokens())
                .preview(preview)
                .previewError(previewError)
                .build();
    }

    /** Mã cha giả lập khi xem trước mã KR: chính là mã Objective sẽ sinh ra tiếp theo. */
    private String sampleParentCode(Organization organization, CodeType type) {
        if (type != CodeType.KEY_RESULT) return null;
        OrgCodeRule objectiveRule = effectiveRule(organization, CodeType.OBJECTIVE);
        try {
            return build(organization, CodeType.OBJECTIVE, objectiveRule.getPattern(), null, SAMPLE_UNIT_CODE);
        } catch (BusinessException e) {
            return "OBJ";
        }
    }

    private Organization loadOrganization(UUID organizationId) {
        return organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization not found"));
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
