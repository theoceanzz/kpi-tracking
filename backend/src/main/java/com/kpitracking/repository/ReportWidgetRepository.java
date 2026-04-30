package com.kpitracking.repository;

import com.kpitracking.entity.ReportWidget;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ReportWidgetRepository extends JpaRepository<ReportWidget, UUID> {

    List<ReportWidget> findByReportIdOrderByWidgetOrderAsc(UUID reportId);

    void deleteByReportId(UUID reportId);
}
