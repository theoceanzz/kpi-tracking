package com.kpitracking.ai.core.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.repository.ai.ConversationMessageRepository;
import com.kpitracking.repository.kpi.KpiCriteriaRepository;
import com.kpitracking.repository.organization.OrgHierarchyLevelRepository;
import com.kpitracking.repository.organization.OrgUnitRepository;
import com.kpitracking.repository.kpi.QualitativeLevelRepository;
import com.kpitracking.repository.user.UserRepository;
import com.kpitracking.repository.user.UserRoleOrgUnitRepository;
import com.kpitracking.service.analytics.OrgUnitStatisticService;
import com.kpitracking.ai.core.form.FormFieldValidator;
import com.kpitracking.ai.core.form.FormFillSupport;

import static org.mockito.Mockito.mock;

/**
 * Dựng {@link FormFillSupport} thật cho test, với repository giả.
 *
 * <p>Gom vào một chỗ vì danh sách phụ thuộc của {@code FormFillSupport} còn dài ra khi thêm form —
 * đã hai lần làm gãy hàng loạt test chỉ vì thêm một tham số. Giờ thêm phụ thuộc chỉ phải sửa ở đây.
 */
public final class FormFillTestFixture {

    private FormFillTestFixture() {}

    /** Các bean giả mà test cần dặn hành vi. */
    public record Deps(OrgUnitStatisticService service,
                QualitativeLevelRepository qualitativeLevels,
                OrgHierarchyLevelRepository hierarchyLevels,
                KpiCriteriaRepository kpiCriteria,
                ToolSupport support,
                FormFillSupport fill) {}

    public static Deps create() {
        OrgUnitStatisticService service = mock(OrgUnitStatisticService.class);
        QualitativeLevelRepository qualitativeLevels = mock(QualitativeLevelRepository.class);
        OrgHierarchyLevelRepository hierarchyLevels = mock(OrgHierarchyLevelRepository.class);
        // FormFillSupport tra loại chỉ tiêu qua kho này để chặn đề xuất lệch loại KPI.
        KpiCriteriaRepository kpiCriteria = mock(KpiCriteriaRepository.class);

        ToolSupport support = new ToolSupport(
                mock(OrgUnitRepository.class),
                mock(UserRoleOrgUnitRepository.class),
                mock(UserRepository.class),
                mock(KpiCriteriaRepository.class),
                mock(ConversationMessageRepository.class),
                service,
                mock(FollowupContextStore.class),
                new ObjectMapper());
        support.initToolMapper();

        FormFillSupport fill = new FormFillSupport(
                new FormFieldValidator(), service, qualitativeLevels, hierarchyLevels,
                kpiCriteria, support);

        return new Deps(service, qualitativeLevels, hierarchyLevels, kpiCriteria, support, fill);
    }
}
