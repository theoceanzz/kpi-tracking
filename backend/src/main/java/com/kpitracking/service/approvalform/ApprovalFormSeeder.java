package com.kpitracking.service.approvalform;

import com.kpitracking.entity.ApprovalForm;
import com.kpitracking.entity.ApprovalFormGroup;
import com.kpitracking.entity.Organization;
import com.kpitracking.i18n.SupportedLanguages;
import com.kpitracking.repository.ApprovalFormGroupRepository;
import com.kpitracking.repository.ApprovalFormRepository;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.service.approvalprocess.ProcessGraphCodec;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Dựng sẵn các nhóm + đơn mẫu ({@code preinstalled} của thư viện) cho một tổ chức, đúng MỘT lần — lần đầu có người mở
 * mục Đơn từ. Cờ {@code organizations.approval_forms_seeded_at} chặn chạy trùng (hai request cùng lúc chỉ một bên
 * dựng) và chặn dựng lại khi quản trị đã xoá hết. Chữ trên form theo ngôn ngữ mặc định của tổ chức.
 */
@Component
@RequiredArgsConstructor
public class ApprovalFormSeeder {

    private final ApprovalFormGroupRepository groupRepository;
    private final ApprovalFormRepository formRepository;
    private final OrganizationRepository organizationRepository;
    private final ApprovalFormLibrary library;
    private final ProcessGraphCodec codec;

    /** Tổ chức đã chắc chắn dựng xong trong tiến trình này — khỏi mở transaction ghi mỗi lần đọc danh sách. */
    private final Set<UUID> seeded = ConcurrentHashMap.newKeySet();

    /** Transaction riêng: gọi được từ phía đọc, và dựng xong là lưu luôn dù phía gọi lỗi sau đó. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void ensureSeeded(UUID orgId) {
        if (orgId == null || seeded.contains(orgId)) return;
        if (groupRepository.markSeeded(orgId) == 1) seed(orgId);
        seeded.add(orgId);
    }

    private void seed(UUID orgId) {
        String language = organizationRepository.findById(orgId).map(Organization::getDefaultLanguage)
                .filter(SupportedLanguages::isSupported).orElse(SupportedLanguages.DEFAULT);
        int groupOrder = 0;
        for (ApprovalFormLibrary.Preinstalled p : library.preinstalled()) {
            ApprovalFormGroup group = groupRepository.save(ApprovalFormGroup.builder()
                    .organizationId(orgId)
                    .name(new LinkedHashMap<>(p.name()))
                    .sortOrder(groupOrder++)
                    .code(p.code())
                    .build());
            int formOrder = 0;
            for (String code : p.templates()) {
                ApprovalFormLibrary.Template t = library.template(code)
                        .orElseThrow(() -> new IllegalStateException("Unknown approval form template " + code));
                formRepository.save(ApprovalForm.builder()
                        .organizationId(orgId)
                        .groupId(group.getId())
                        .templateCode(code)
                        .icon(t.icon())
                        .color(t.color())
                        .name(new LinkedHashMap<>(t.name()))
                        .description(new LinkedHashMap<>(t.description()))
                        .formSchema(library.schema(t, language))
                        .processDefinition(codec.write(library.process(t, language)))
                        .sortOrder(formOrder++)
                        .build());
            }
        }
    }
}
