package com.kpitracking.service;

import com.kpitracking.dto.response.submission.AttachmentResponse;
import com.kpitracking.entity.EvidenceAttachment;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.EvidenceTargetType;
import com.kpitracking.enums.StorageProvider;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.EvidenceAttachmentMapper;
import com.kpitracking.repository.EvidenceAttachmentRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.PermissionChecker;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Tệp minh chứng của một lượt chấm (đợt / kỳ / hạnh kiểm). Khác {@link SubmissionAttachmentService}
 * ở chỗ tệp không trỏ vào một bản ghi có sẵn mà vào KHOÁ ĐÍCH "<...>:<userId>" — người chấm đính
 * kèm được ngay lúc đang soạn, trước cả khi bản ghi điểm sinh ra.
 *
 * <p>Quyền: người được chấm (userId trong khoá) và người có quyền chấm/xem lượt đó trên đơn vị của
 * người được chấm. Xoá: chính người tải lên, hoặc quản trị toàn cục của đơn vị đó.
 */
@Service
@RequiredArgsConstructor
public class EvidenceAttachmentService {

    private static final String[] PERIOD_PERMS = { "EVALUATION:CREATE", "EVALUATION:VIEW", "SUBMISSION:REVIEW", "SUBMISSION:REVIEW_KPI" };
    private static final String[] CYCLE_PERMS = { "CYCLE_EVAL:FINALIZE", "CYCLE_EVAL:VIEW", "EVALUATION:VIEW" };
    private static final String[] CONDUCT_PERMS = { "EVALUATION:CREATE", "EVALUATION:VIEW" };

    private final EvidenceAttachmentRepository repository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final CloudinaryStorageService cloudinaryStorageService;
    private final AttachmentPolicy attachmentPolicy;
    private final PermissionChecker permissionChecker;
    private final EvidenceAttachmentMapper mapper;

    /** Người được chấm + đơn vị (đầu tiên) của họ, rút từ khoá đích. */
    private record Target(UUID subjectId, OrgUnit unit, UUID organizationId) {}

    @Transactional(readOnly = true)
    public List<AttachmentResponse> list(EvidenceTargetType type, String key) {
        User me = currentUser();
        Target t = resolve(type, key);
        requireCanView(me, type, t);
        return mapper.toResponseList(repository
                .findByOrganizationIdAndTargetTypeAndTargetKeyOrderByCreatedAtAsc(t.organizationId(), type, key));
    }

    @Transactional
    public List<AttachmentResponse> upload(EvidenceTargetType type, String key, MultipartFile[] files, String note)
            throws IOException {
        User me = currentUser();
        Target t = resolve(type, key);
        requireCanView(me, type, t);

        // Cùng chính sách với bài nộp: kiểm cả lô trước khi đụng Cloudinary, đếm cả tệp đang có.
        attachmentPolicy.validate(files, repository.countByOrganizationIdAndTargetTypeAndTargetKey(t.organizationId(), type, key));

        String folder = "evidence/" + type.name().toLowerCase() + "/" + key.replace(':', '_');
        List<AttachmentResponse> out = new ArrayList<>();
        for (MultipartFile file : files) {
            Map<String, String> info = cloudinaryStorageService.uploadFile(file, folder);
            EvidenceAttachment saved = repository.save(EvidenceAttachment.builder()
                    .organization(t.unit().getOrgHierarchyLevel().getOrganization())
                    .targetType(type)
                    .targetKey(key)
                    .fileName(attachmentPolicy.safeFileName(file.getOriginalFilename()))
                    .fileUrl(info.get("url"))
                    .fileSize(file.getSize())
                    .contentType(file.getContentType())
                    .storageProvider(StorageProvider.CLOUDINARY)
                    .storageKey(info.get("public_id"))
                    .note(note == null || note.isBlank() ? null : note.trim())
                    .uploadedBy(me)
                    .build());
            out.add(mapper.toResponse(saved));
        }
        return out;
    }

    @Transactional
    public void delete(UUID id) {
        User me = currentUser();
        EvidenceAttachment a = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("EvidenceAttachment", "id", id));
        Target t = resolve(a.getTargetType(), a.getTargetKey());
        boolean owner = a.getUploadedBy().getId().equals(me.getId());
        if (!owner && !permissionChecker.isGlobalAdminIn(me.getId(), t.unit().getId())) {
            throw new ForbiddenException("Chỉ người tải lên mới xoá được tệp minh chứng này");
        }
        if (a.getStorageKey() != null) cloudinaryStorageService.deleteFile(a.getStorageKey());
        repository.delete(a);
    }

    // ── Khoá đích ───────────────────────────────────────────────────────────

    /** Khoá phải đúng dạng của loại và userId cuối khoá phải là người thật có đơn vị. */
    private Target resolve(EvidenceTargetType type, String key) {
        String[] parts = key == null ? new String[0] : key.split(":");
        int expected = switch (type) {
            case PERIOD_EVALUATION, CYCLE_EVALUATION -> 2;
            case CONDUCT_EVALUATION -> 3;
        };
        if (parts.length != expected) throw new BusinessException("Khoá minh chứng không hợp lệ");
        UUID subjectId;
        try {
            for (int i = 0; i < parts.length; i++) if (i != 0 || type != EvidenceTargetType.CONDUCT_EVALUATION) UUID.fromString(parts[i]);
            subjectId = UUID.fromString(parts[parts.length - 1]);
        } catch (IllegalArgumentException e) {
            throw new BusinessException("Khoá minh chứng không hợp lệ");
        }
        List<UserRoleOrgUnit> memberships = userRoleOrgUnitRepository.findByUserId(subjectId);
        if (memberships.isEmpty()) throw new ResourceNotFoundException("User", "id", subjectId);
        OrgUnit unit = memberships.get(0).getOrgUnit();
        return new Target(subjectId, unit, unit.getOrgHierarchyLevel().getOrganization().getId());
    }

    private void requireCanView(User me, EvidenceTargetType type, Target t) {
        if (me.getId().equals(t.subjectId())) return;
        String[] perms = switch (type) {
            case PERIOD_EVALUATION -> PERIOD_PERMS;
            case CYCLE_EVALUATION -> CYCLE_PERMS;
            case CONDUCT_EVALUATION -> CONDUCT_PERMS;
        };
        UUID unitId = t.unit().getId();
        if (permissionChecker.hasAnyPermissionInOrgUnit(me.getId(), unitId, perms)
                || permissionChecker.isGlobalAdminIn(me.getId(), unitId)) return;
        throw new ForbiddenException("Bạn không có quyền xem minh chứng của lượt chấm này");
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }
}
