package com.kpitracking.workflow;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.entity.KpiWorkflowConfig;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.KpiWorkflowConfigRepository;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.workflow.def.WorkflowConfig;
import com.kpitracking.workflow.def.WorkflowConfigValidator;
import com.kpitracking.workflow.def.WorkflowDefinition;
import com.kpitracking.workflow.def.WorkflowDefinitionFactory;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Nạp, lưu và đặt lại cấu hình luồng KPI của tổ chức.
 *
 * <p>Có cache trong tiến trình vì {@code definitionFor()} nằm trên đường nóng: mọi phép chuyển
 * trạng thái đều gọi tới nó. Cache xoá theo tổ chức ngay khi ghi, nên đọc luôn thấy bản mới nhất
 * trong cùng một tiến trình. Chạy nhiều tiến trình thì mỗi tiến trình tự nạp lại sau lần ghi của
 * chính nó; cấu hình luồng đổi rất thưa nên đó là đánh đổi chấp nhận được, và cũng là mức nhất
 * quán mà phần còn lại của hệ thống đang dùng.
 */
@Service
@RequiredArgsConstructor
public class KpiWorkflowConfigService {

    private final KpiWorkflowConfigRepository repository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final WorkflowDefinitionFactory factory;
    private final WorkflowConfigValidator validator;
    private final ObjectMapper objectMapper;

    private final Map<UUID, WorkflowDefinition> cache = new ConcurrentHashMap<>();

    // ---- Đọc ----

    /**
     * Luồng đang hiệu lực của một tổ chức. {@code null} organizationId (người dùng chưa gắn đơn vị
     * nào) vẫn trả luồng mặc định thay vì ném, để trang cấu hình và thanh tiến trình không vỡ.
     */
    @Transactional(readOnly = true)
    public WorkflowDefinition definitionFor(UUID organizationId) {
        if (organizationId == null) return factory.buildDefault();
        return cache.computeIfAbsent(organizationId, id ->
                factory.build(repository.findByOrganizationId(id).map(this::read).orElse(null)));
    }

    /** Luồng đang hiệu lực của người đang đăng nhập. */
    @Transactional(readOnly = true)
    public WorkflowDefinition currentDefinition() {
        return definitionFor(currentOrganizationId());
    }

    /** Dạng lưu (đã trộn với mặc định) của người đang đăng nhập — dùng cho màn hình cấu hình. */
    @Transactional(readOnly = true)
    public WorkflowConfig currentConfig() {
        return currentDefinition().config();
    }

    // ---- Ghi ----

    @Transactional
    public WorkflowConfig save(WorkflowConfig incoming) {
        UUID organizationId = currentOrganizationId();
        if (organizationId == null) {
            throw new BusinessException("Tài khoản chưa thuộc tổ chức nào nên không cấu hình được luồng KPI");
        }

        // Trộn trước rồi mới kiểm: người dùng chỉ gửi phần họ đổi, mà luật phụ thuộc giữa các bước
        // chỉ đánh giá đúng trên cấu hình ĐẦY ĐỦ.
        WorkflowConfig merged = factory.merge(incoming);
        validator.validateOrThrow(merged);

        User actor = currentUser();
        KpiWorkflowConfig entity = repository.findByOrganizationId(organizationId)
                .orElseGet(() -> {
                    Organization org = organizationRepository.findById(organizationId)
                            .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", organizationId));
                    return KpiWorkflowConfig.builder().organization(org).build();
                });

        entity.setDefinition(write(merged));
        entity.setVersion(merged.getSchemaVersion());
        entity.setUpdatedBy(actor);
        repository.save(entity);

        cache.remove(organizationId);
        return merged;
    }

    /** Xoá cấu hình riêng của tổ chức để quay về luồng mặc định. */
    @Transactional
    public WorkflowConfig reset() {
        UUID organizationId = currentOrganizationId();
        if (organizationId == null) {
            throw new BusinessException("Tài khoản chưa thuộc tổ chức nào nên không cấu hình được luồng KPI");
        }
        repository.findByOrganizationId(organizationId).ifPresent(e -> {
            e.setDeletedAt(java.time.Instant.now());
            repository.save(e);
        });
        cache.remove(organizationId);
        return factory.defaultConfig();
    }

    /** Kiểm thử một cấu hình mà không lưu — để giao diện hiện cảnh báo tại chỗ. */
    public List<String> dryRun(WorkflowConfig incoming) {
        return validator.validate(factory.merge(incoming));
    }

    // ---- Tiện ích ----

    public User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
    }

    /**
     * Tổ chức của người đang đăng nhập, suy từ phân công vai trò.
     *
     * <p>Cố ý KHÔNG nhận organizationId từ client: {@code SidebarSettingController} nhận id trên
     * đường dẫn và không gác quyền, nên bất kỳ ai đăng nhập cũng đọc/ghi được cấu hình của tổ chức
     * khác. Không lặp lại lỗi đó ở đây.
     */
    public UUID currentOrganizationId() {
        return organizationIdOf(currentUser().getId());
    }

    public UUID organizationIdOf(UUID userId) {
        List<UserRoleOrgUnit> roles = userRoleOrgUnitRepository.findByUserId(userId);
        if (roles.isEmpty()) return null;
        return roles.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
    }

    /** Xoá cache của một tổ chức — dùng khi cấu hình bị đổi ngoài luồng ghi thường. */
    public void evict(UUID organizationId) {
        if (organizationId == null) cache.clear();
        else cache.remove(organizationId);
    }

    private WorkflowConfig read(KpiWorkflowConfig entity) {
        String json = entity.getDefinition();
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, WorkflowConfig.class);
        } catch (JsonProcessingException e) {
            // Cấu hình hỏng không được làm sập luồng KPI của cả tổ chức — lui về mặc định.
            return null;
        }
    }

    private String write(WorkflowConfig config) {
        try {
            return objectMapper.writeValueAsString(config);
        } catch (JsonProcessingException e) {
            throw new BusinessException("Không chuyển được cấu hình luồng KPI sang JSON");
        }
    }
}
