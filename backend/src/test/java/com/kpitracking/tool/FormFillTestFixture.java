package com.kpitracking.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.repository.ConversationMessageRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.OrgHierarchyLevelRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.QualitativeLevelRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.service.ai.form.FormFieldValidator;
import com.kpitracking.service.ai.form.FormFillSupport;

import static org.mockito.Mockito.mock;

/**
 * Dựng {@link FormFillSupport} thật cho test, với repository giả.
 *
 * <p>Gom vào một chỗ vì danh sách phụ thuộc của {@code FormFillSupport} còn dài ra khi thêm form —
 * đã hai lần làm gãy hàng loạt test chỉ vì thêm một tham số. Giờ thêm phụ thuộc chỉ phải sửa ở đây.
 */
final class FormFillTestFixture {

    private FormFillTestFixture() {}

    /** Các bean giả mà test cần dặn hành vi. */
    record Deps(OrgUnitStatisticService service,
                QualitativeLevelRepository qualitativeLevels,
                OrgHierarchyLevelRepository hierarchyLevels,
                KpiCriteriaRepository kpiCriteria,
                ToolSupport support,
                FormFillSupport fill) {}

    static Deps create() {
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
