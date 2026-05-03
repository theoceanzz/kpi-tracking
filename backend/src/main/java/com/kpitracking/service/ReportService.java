package com.kpitracking.service;

import com.kpitracking.dto.request.report.*;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.report.*;
import com.kpitracking.entity.*;
import com.kpitracking.enums.ReportStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;
    private final ReportDatasourceRepository reportDatasourceRepository;
    private final ReportWidgetRepository reportWidgetRepository;
    private final DatasourceRepository datasourceRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
    }

    // ============================================================
    // REPORT CRUD
    // ============================================================

    @Transactional
    public ReportResponse createReport(CreateReportRequest request) {
        User currentUser = getCurrentUser();

        OrgUnit orgUnit;
        if (request.getOrgUnitId() != null) {
            orgUnit = orgUnitRepository.findById(request.getOrgUnitId())
                    .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", request.getOrgUnitId()));
        } else {
            var assignments = userRoleOrgUnitRepository.findByUserId(currentUser.getId());
            if (!assignments.isEmpty()) {
                orgUnit = assignments.get(0).getOrgUnit();
            } else {
                throw new BusinessException("Người dùng phải thuộc ít nhất một đơn vị");
            }
        }

        Report report = Report.builder()
                .orgUnit(orgUnit)
                .name(request.getName())
                .description(request.getDescription())
                .createdBy(currentUser)
                .build();

        report = reportRepository.save(report);
        return toResponse(report);
    }

    @Transactional(readOnly = true)
    public PageResponse<ReportResponse> getReports(int page, int size, UUID orgUnitId) {
        User currentUser = getCurrentUser();
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        Page<Report> reportPage;
        if (orgUnitId != null) {
            reportPage = reportRepository.findAccessibleReports(orgUnitId, currentUser.getId(), pageable);
        } else {
            reportPage = reportRepository.findByCreatedById(currentUser.getId(), pageable);
        }

        return PageResponse.<ReportResponse>builder()
                .content(reportPage.getContent().stream().map(this::toResponse).toList())
                .page(reportPage.getNumber())
                .size(reportPage.getSize())
                .totalElements(reportPage.getTotalElements())
                .totalPages(reportPage.getTotalPages())
                .last(reportPage.isLast())
                .build();
    }

    @Transactional(readOnly = true)
    public ReportResponse getReportById(UUID id) {
        Report report = reportRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Báo cáo", "id", id));
        return toResponse(report);
    }

    @Transactional
    public ReportResponse updateReport(UUID id, UpdateReportRequest request) {
        Report report = reportRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Báo cáo", "id", id));

        if (request.getName() != null) report.setName(request.getName());
        if (request.getDescription() != null) report.setDescription(request.getDescription());
        if (request.getStatus() != null) report.setStatus(ReportStatus.valueOf(request.getStatus()));
        report.setUpdatedBy(getCurrentUser());

        // Sync Widgets
        if (request.getWidgets() != null) {
            // 1. Remove widgets not in request
            var requestIds = request.getWidgets().stream()
                    .map(UpsertWidgetRequest::getId)
                    .filter(java.util.Objects::nonNull)
                    .toList();
            report.getWidgets().removeIf(w -> !requestIds.contains(w.getId()));

            // 2. Update or Add
            for (var wReq : request.getWidgets()) {
                if (wReq.getId() != null) {
                    // Update existing
                    report.getWidgets().stream()
                            .filter(w -> w.getId().equals(wReq.getId()))
                            .findFirst()
                            .ifPresent(w -> updateWidgetFromRequest(w, wReq));
                } else {
                    // Add new
                    ReportWidget newWidget = ReportWidget.builder()
                            .report(report)
                            .build();
                    updateWidgetFromRequest(newWidget, wReq);
                    report.getWidgets().add(newWidget);
                }
            }
        }

        report = reportRepository.save(report);
        return toResponse(report);
    }

    private void updateWidgetFromRequest(ReportWidget widget, UpsertWidgetRequest request) {
        if (request.getReportDatasourceId() != null) {
            ReportDatasource rd = reportDatasourceRepository.findById(request.getReportDatasourceId())
                    .orElseThrow(() -> new ResourceNotFoundException("Report-Datasource link", "id", request.getReportDatasourceId()));
            widget.setReportDatasource(rd);
        } else {
            widget.setReportDatasource(null);
        }
        if (request.getWidgetType() != null) widget.setWidgetType(request.getWidgetType());
        if (request.getTitle() != null) widget.setTitle(request.getTitle());
        if (request.getDescription() != null) widget.setDescription(request.getDescription());
        if (request.getChartConfig() != null) widget.setChartConfig(request.getChartConfig());
        if (request.getPosition() != null) widget.setPosition(request.getPosition());
        if (request.getWidgetOrder() != null) widget.setWidgetOrder(request.getWidgetOrder());
    }

    @Transactional
    public void deleteReport(UUID id) {
        Report report = reportRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Báo cáo", "id", id));
        report.setDeletedAt(Instant.now());
        reportRepository.save(report);
    }

    // ============================================================
    // REPORT DATASOURCES
    // ============================================================

    @Transactional
    public ReportDatasourceResponse addDatasource(UUID reportId, AddReportDatasourceRequest request) {
        Report report = reportRepository.findById(reportId)
                .orElseThrow(() -> new ResourceNotFoundException("Báo cáo", "id", reportId));

        Datasource ds = datasourceRepository.findById(request.getDatasourceId())
                .orElseThrow(() -> new ResourceNotFoundException("Datasource", "id", request.getDatasourceId()));

        // Check not already linked
        if (reportDatasourceRepository.findByReportIdAndDatasourceId(reportId, request.getDatasourceId()).isPresent()) {
            throw new BusinessException("Datasource này đã được kết nối với báo cáo");
        }

        ReportDatasource rd = ReportDatasource.builder()
                .report(report)
                .datasource(ds)
                .alias(request.getAlias())
                .build();

        rd = reportDatasourceRepository.save(rd);
        return toRdResponse(rd);
    }

    @Transactional
    public void removeDatasource(UUID reportDatasourceId) {
        if (!reportDatasourceRepository.existsById(reportDatasourceId)) {
            throw new ResourceNotFoundException("Report-Datasource link", "id", reportDatasourceId);
        }
        reportDatasourceRepository.deleteById(reportDatasourceId);
    }

    // ============================================================
    // WIDGETS
    // ============================================================

    @Transactional
    public ReportWidgetResponse addWidget(UUID reportId, UpsertWidgetRequest request) {
        Report report = reportRepository.findById(reportId)
                .orElseThrow(() -> new ResourceNotFoundException("Báo cáo", "id", reportId));

        ReportDatasource rd = reportDatasourceRepository.findById(request.getReportDatasourceId())
                .orElseThrow(() -> new ResourceNotFoundException("Report-Datasource link", "id", request.getReportDatasourceId()));

        ReportWidget widget = ReportWidget.builder()
                .report(report)
                .reportDatasource(rd)
                .widgetType(request.getWidgetType())
                .title(request.getTitle())
                .description(request.getDescription())
                .chartConfig(request.getChartConfig())
                .position(request.getPosition() != null ? request.getPosition() : "{\"x\":0,\"y\":0,\"w\":6,\"h\":4}")
                .widgetOrder(request.getWidgetOrder() != null ? request.getWidgetOrder() : 0)
                .build();

        widget = reportWidgetRepository.save(widget);
        return toWidgetResponse(widget);
    }

    @Transactional
    public ReportWidgetResponse updateWidget(UUID widgetId, UpsertWidgetRequest request) {
        ReportWidget widget = reportWidgetRepository.findById(widgetId)
                .orElseThrow(() -> new ResourceNotFoundException("Widget", "id", widgetId));

        if (request.getReportDatasourceId() != null) {
            ReportDatasource rd = reportDatasourceRepository.findById(request.getReportDatasourceId())
                    .orElseThrow(() -> new ResourceNotFoundException("Report-Datasource link", "id", request.getReportDatasourceId()));
            widget.setReportDatasource(rd);
        }
        if (request.getWidgetType() != null) widget.setWidgetType(request.getWidgetType());
        if (request.getTitle() != null) widget.setTitle(request.getTitle());
        if (request.getDescription() != null) widget.setDescription(request.getDescription());
        if (request.getChartConfig() != null) widget.setChartConfig(request.getChartConfig());
        if (request.getPosition() != null) widget.setPosition(request.getPosition());
        if (request.getWidgetOrder() != null) widget.setWidgetOrder(request.getWidgetOrder());

        widget = reportWidgetRepository.save(widget);
        return toWidgetResponse(widget);
    }

    @Transactional
    public void deleteWidget(UUID widgetId) {
        if (!reportWidgetRepository.existsById(widgetId)) {
            throw new ResourceNotFoundException("Widget", "id", widgetId);
        }
        reportWidgetRepository.deleteById(widgetId);
    }

    @Transactional(readOnly = true)
    public List<ReportWidgetResponse> getPinnedWidgets() {
        User currentUser = getCurrentUser();
        return reportWidgetRepository.findByIsPinnedAndReportCreatedById(true, currentUser.getId())
                .stream()
                .map(this::toWidgetResponse)
                .toList();
    }

    @Transactional
    public ReportWidgetResponse togglePinWidget(UUID widgetId) {
        ReportWidget widget = reportWidgetRepository.findById(widgetId)
                .orElseThrow(() -> new ResourceNotFoundException("Widget", "id", widgetId));

        User currentUser = getCurrentUser();
        if (!widget.getReport().getCreatedBy().getId().equals(currentUser.getId())) {
            throw new BusinessException("Bạn không có quyền ghim biểu đồ này");
        }

        widget.setPinned(!widget.isPinned());
        widget = reportWidgetRepository.save(widget);
        return toWidgetResponse(widget);
    }

    // ============================================================
    // MAPPERS
    // ============================================================

    private ReportResponse toResponse(Report report) {
        List<ReportDatasourceResponse> dsList = report.getReportDatasources() != null
                ? report.getReportDatasources().stream()
                    .filter(rd -> rd.getDatasource() != null)
                    .map(this::toRdResponse).toList()
                : List.of();

        List<ReportWidgetResponse> widgetList = report.getWidgets() != null
                ? report.getWidgets().stream()
                    .map(this::toWidgetResponse).toList()
                : List.of();

        return ReportResponse.builder()
                .id(report.getId())
                .name(report.getName())
                .description(report.getDescription())
                .status(report.getStatus())
                .orgUnitId(report.getOrgUnit().getId())
                .orgUnitName(report.getOrgUnit().getName())
                .createdById(report.getCreatedBy().getId())
                .createdByName(report.getCreatedBy().getFullName())
                .datasources(dsList)
                .widgets(widgetList)
                .createdAt(report.getCreatedAt())
                .updatedAt(report.getUpdatedAt())
                .build();
    }

    private ReportDatasourceResponse toRdResponse(ReportDatasource rd) {
        return ReportDatasourceResponse.builder()
                .id(rd.getId())
                .datasourceId(rd.getDatasource().getId())
                .datasourceName(rd.getDatasource().getName())
                .alias(rd.getAlias())
                .build();
    }

    private ReportWidgetResponse toWidgetResponse(ReportWidget widget) {
        var builder = ReportWidgetResponse.builder()
                .id(widget.getId())
                .widgetType(widget.getWidgetType())
                .title(widget.getTitle())
                .description(widget.getDescription())
                .chartConfig(widget.getChartConfig())
                .position(widget.getPosition())
                .widgetOrder(widget.getWidgetOrder())
                .isPinned(widget.isPinned());

        if (widget.getReportDatasource() != null) {
            builder.reportDatasourceId(widget.getReportDatasource().getId());
            if (widget.getReportDatasource().getDatasource() != null) {
                builder.datasourceName(widget.getReportDatasource().getDatasource().getName());
            }
        }

        return builder.build();
    }
}
