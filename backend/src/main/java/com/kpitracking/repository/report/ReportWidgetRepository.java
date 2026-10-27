package com.kpitracking.repository.report;

import com.kpitracking.entity.report.ReportWidget;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ReportWidgetRepository extends JpaRepository<ReportWidget, UUID> {

    List<ReportWidget> findByReportIdOrderByWidgetOrderAsc(UUID reportId);

    List<ReportWidget> findByIsPinnedAndReportCreatedById(boolean isPinned, UUID createdById);

    void deleteByReportId(UUID reportId);
}
