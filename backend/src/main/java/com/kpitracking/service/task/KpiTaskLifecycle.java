package com.kpitracking.service.task;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.event.TaskEvents;
import com.kpitracking.repository.KpiTaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/**
 * Công việc phản ứng với vòng đời KPI (gọi từ {@code KpiCollabHooks}, trong transaction của thao tác KPI):
 * <ul>
 *   <li>KPI bị xoá ⇒ task GIỮ LẠI, chụp tên KPI vào {@code kpi_name_snapshot} để vẫn đọc được "KPI đã xoá: …";</li>
 *   <li>KPI bị thay ⇒ không tự chuyển task; báo người còn việc dở để họ tự chọn chuyển sang KPI mới.</li>
 * </ul>
 * KPI bị từ chối / đang sửa: không làm gì — task vẫn giữ nguyên.
 */
@Component
@RequiredArgsConstructor
public class KpiTaskLifecycle {

    private final KpiTaskRepository taskRepository;
    private final ApplicationEventPublisher events;

    public void onKpiDeleted(KpiCriteria kpi) {
        taskRepository.snapshotKpiName(kpi.getId(), kpi.getName());
    }

    public void onKpiReplaced(KpiCriteria oldKpi, KpiCriteria newKpi) {
        events.publishEvent(new TaskEvents.KpiReplaced(oldKpi.getId(), newKpi.getId()));
    }
}
