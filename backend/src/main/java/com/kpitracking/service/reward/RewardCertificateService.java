package com.kpitracking.service.reward;

import com.kpitracking.dto.request.reward.CertificateTemplateRequest;
import com.kpitracking.dto.response.reward.CertificateCatalogResponse;
import com.kpitracking.dto.response.reward.CertificateTemplateResponse;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.RewardCertificateTemplate;
import com.kpitracking.entity.User;
import com.kpitracking.enums.CertificateOrientation;
import com.kpitracking.enums.CertificateTemplateStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.RewardCertificateTemplateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Mẫu chứng nhận khen thưởng của tổ chức.
 *
 * <p>Tổ chức chưa soạn mẫu nào vẫn in được chứng nhận: frontend có sẵn một bộ thiết kế
 * dựng sẵn dùng được ngay. Bảng này chỉ chứa những mẫu công ty đã tự chỉnh và muốn dùng
 * lại — vì thế danh sách rỗng là trạng thái BÌNH THƯỜNG, không phải thiếu dữ liệu khởi tạo.
 */
@Service
@RequiredArgsConstructor
public class RewardCertificateService {

    private final RewardCertificateTemplateRepository templateRepository;
    private final OrganizationRepository organizationRepository;
    private final RewardContext context;

    /** Cho người đi in: chỉ mẫu đang bật, kèm nhận diện của tổ chức để vẽ. */
    @Transactional(readOnly = true)
    public CertificateCatalogResponse getCatalog() {
        UUID orgId = context.getCurrentOrgId();
        List<RewardCertificateTemplate> templates = templateRepository
                .findByOrganizationIdAndStatusOrderByDisplayOrderAscNameAsc(
                        orgId, CertificateTemplateStatus.ACTIVE);
        return toCatalog(orgId, templates);
    }

    /** Cho màn hình quản trị: lấy cả mẫu đang tắt. */
    @Transactional(readOnly = true)
    public CertificateCatalogResponse getCatalogForManage() {
        UUID orgId = context.getCurrentOrgId();
        return toCatalog(orgId,
                templateRepository.findByOrganizationIdOrderByDisplayOrderAscNameAsc(orgId));
    }

    @Transactional
    public CertificateTemplateResponse create(CertificateTemplateRequest request) {
        User me = context.getCurrentUser();
        UUID orgId = context.getOrgIdOf(me.getId());
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", orgId));

        String name = request.getName().trim();
        if (templateRepository.existsByOrganizationIdAndNameIgnoreCase(orgId, name)) {
            throw new BusinessException("Đã có mẫu tên " + quote(name) + " trong tổ chức. "
                    + "Hãy đặt tên khác để còn phân biệt được khi chọn mẫu lúc in.");
        }

        RewardCertificateTemplate template = RewardCertificateTemplate.builder()
                .organization(org)
                .createdBy(me)
                .name(name)
                .preset(request.getPreset().trim())
                .orientation(request.getOrientation() != null
                        ? request.getOrientation() : CertificateOrientation.LANDSCAPE)
                .status(request.getStatus() != null
                        ? request.getStatus() : CertificateTemplateStatus.ACTIVE)
                .displayOrder(request.getDisplayOrder() != null ? request.getDisplayOrder() : 0)
                .isDefault(false)
                .build();
        applyContent(template, request);

        RewardCertificateTemplate saved = templateRepository.save(template);
        applyDefaultFlag(saved, request.getIsDefault(), orgId);

        return toResponse(saved);
    }

    @Transactional
    public CertificateTemplateResponse update(UUID id, CertificateTemplateRequest request) {
        UUID orgId = context.getCurrentOrgId();
        RewardCertificateTemplate template = load(id, orgId);

        String name = request.getName().trim();
        if (templateRepository.existsByOrganizationIdAndNameIgnoreCaseAndIdNot(orgId, name, id)) {
            throw new BusinessException("Đã có mẫu tên " + quote(name) + " trong tổ chức. "
                    + "Hãy đặt tên khác để còn phân biệt được khi chọn mẫu lúc in.");
        }

        template.setName(name);
        template.setPreset(request.getPreset().trim());
        if (request.getOrientation() != null) template.setOrientation(request.getOrientation());
        if (request.getStatus() != null) template.setStatus(request.getStatus());
        if (request.getDisplayOrder() != null) template.setDisplayOrder(request.getDisplayOrder());
        applyContent(template, request);

        RewardCertificateTemplate saved = templateRepository.save(template);
        applyDefaultFlag(saved, request.getIsDefault(), orgId);

        return toResponse(saved);
    }

    /**
     * Xoá mẫu. Không có ràng buộc lịch sử nào phải giữ ở đây: chứng nhận đã in là một
     * tệp nằm trong máy người dùng, hệ thống không lưu bản đã phát — nên xoá mẫu không
     * làm hỏng thứ gì đã trao đi.
     */
    @Transactional
    public void delete(UUID id) {
        RewardCertificateTemplate template = load(id, context.getCurrentOrgId());
        template.setDeletedAt(Instant.now());
        template.setIsDefault(false);
        templateRepository.save(template);
    }

    // ── Nội bộ ───────────────────────────────────────────────────

    private void applyContent(RewardCertificateTemplate t, CertificateTemplateRequest r) {
        t.setEyebrow(trimToNull(r.getEyebrow()));
        t.setTitle(r.getTitle().trim());
        t.setSubtitle(trimToNull(r.getSubtitle()));
        t.setBody(trimToNull(r.getBody()));
        t.setFootnote(trimToNull(r.getFootnote()));
        t.setSignerName(trimToNull(r.getSignerName()));
        t.setSignerTitle(trimToNull(r.getSignerTitle()));
        t.setSignatureUrl(trimToNull(r.getSignatureUrl()));
        t.setLogoUrl(trimToNull(r.getLogoUrl()));
        t.setBackgroundUrl(trimToNull(r.getBackgroundUrl()));
        // Chuẩn hoá về chữ hoa: cùng một màu viết hoa và viết thường sẽ hiện ra như hai
        // màu khác nhau ở mọi chỗ giao diện so sánh chuỗi.
        t.setAccentColor(upperOrNull(r.getAccentColor()));
        t.setInkColor(upperOrNull(r.getInkColor()));
        t.setSurfaceColor(upperOrNull(r.getSurfaceColor()));
        if (r.getShowLogo() != null) t.setShowLogo(r.getShowLogo());
        if (r.getShowPoints() != null) t.setShowPoints(r.getShowPoints());
        if (r.getShowReason() != null) t.setShowReason(r.getShowReason());
    }

    /**
     * Dựng hoặc hạ cờ mặc định, sau khi mẫu đã có id.
     *
     * <p>Hạ cờ của các mẫu khác TRƯỚC rồi mới dựng cờ cho mẫu này — làm ngược lại sẽ đụng
     * unique index "mỗi tổ chức nhiều nhất một mẫu mặc định" ngay tại câu insert.
     */
    private void applyDefaultFlag(RewardCertificateTemplate template, Boolean wanted, UUID orgId) {
        if (wanted == null) return;

        if (wanted) {
            templateRepository.clearDefaultFlag(orgId, template.getId());
            if (!Boolean.TRUE.equals(template.getIsDefault())) {
                template.setIsDefault(true);
                templateRepository.save(template);
            }
        } else if (Boolean.TRUE.equals(template.getIsDefault())) {
            template.setIsDefault(false);
            templateRepository.save(template);
        }
    }

    private CertificateCatalogResponse toCatalog(UUID orgId, List<RewardCertificateTemplate> templates) {
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", orgId));
        return CertificateCatalogResponse.builder()
                .organizationName(org.getName())
                .organizationLogoUrl(org.getLogoUrl())
                .templates(templates.stream().map(this::toResponse).toList())
                .build();
    }

    private RewardCertificateTemplate load(UUID id, UUID orgId) {
        return templateRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Mẫu chứng nhận", "id", id));
    }

    private CertificateTemplateResponse toResponse(RewardCertificateTemplate t) {
        return CertificateTemplateResponse.builder()
                .id(t.getId())
                .name(t.getName())
                .preset(t.getPreset())
                .orientation(t.getOrientation())
                .eyebrow(t.getEyebrow())
                .title(t.getTitle())
                .subtitle(t.getSubtitle())
                .body(t.getBody())
                .footnote(t.getFootnote())
                .signerName(t.getSignerName())
                .signerTitle(t.getSignerTitle())
                .signatureUrl(t.getSignatureUrl())
                .logoUrl(t.getLogoUrl())
                .backgroundUrl(t.getBackgroundUrl())
                .accentColor(t.getAccentColor())
                .inkColor(t.getInkColor())
                .surfaceColor(t.getSurfaceColor())
                .showLogo(t.getShowLogo())
                .showPoints(t.getShowPoints())
                .showReason(t.getShowReason())
                .isDefault(t.getIsDefault())
                .status(t.getStatus())
                .displayOrder(t.getDisplayOrder())
                .createdByName(t.getCreatedBy() != null ? t.getCreatedBy().getFullName() : null)
                .createdAt(t.getCreatedAt())
                .updatedAt(t.getUpdatedAt())
                .build();
    }

    private static String quote(String value) {
        return "\"" + value + "\"";
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String upperOrNull(String value) {
        String trimmed = trimToNull(value);
        return trimmed == null ? null : trimmed.toUpperCase();
    }
}
