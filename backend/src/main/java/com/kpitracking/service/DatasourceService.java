package com.kpitracking.service;

import com.kpitracking.dto.request.datasource.*;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.datasource.*;
import com.kpitracking.entity.*;
import com.kpitracking.enums.DatasourceStatus;
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
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DatasourceService {

    private final DatasourceRepository datasourceRepository;
    private final DsColumnRepository dsColumnRepository;
    private final DsRowRepository dsRowRepository;
    private final DsCellRepository dsCellRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final ReportDatasourceRepository reportDatasourceRepository;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
    }

    // ============================================================
    // DATASOURCE CRUD
    // ============================================================

    @Transactional
    public DatasourceResponse createDatasource(CreateDatasourceRequest request) {
        User currentUser = getCurrentUser();

        OrgUnit orgUnit;
        if (request.getOrgUnitId() != null) {
            orgUnit = orgUnitRepository.findById(request.getOrgUnitId())
                    .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", request.getOrgUnitId()));
        } else {
            List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(currentUser.getId());
            if (!assignments.isEmpty()) {
                orgUnit = assignments.get(0).getOrgUnit();
            } else {
                throw new BusinessException("Người dùng phải thuộc ít nhất một đơn vị");
            }
        }

        Datasource ds = Datasource.builder()
                .orgUnit(orgUnit)
                .name(request.getName())
                .description(request.getDescription())
                .icon(request.getIcon())
                .createdBy(currentUser)
                .build();

        ds = datasourceRepository.save(ds);
        return toResponse(ds, 0);
    }

    @Transactional(readOnly = true)
    public PageResponse<DatasourceResponse> getDatasources(int page, int size, UUID orgUnitId) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        Page<Datasource> dsPage;
        if (orgUnitId != null) {
            dsPage = datasourceRepository.findByOrgUnitId(orgUnitId, pageable);
        } else {
            dsPage = datasourceRepository.findAll(pageable);
        }

        List<DatasourceResponse> content = dsPage.getContent().stream()
                .map(ds -> toResponse(ds, dsRowRepository.countByDatasourceId(ds.getId())))
                .toList();

        return PageResponse.<DatasourceResponse>builder()
                .content(content)
                .page(dsPage.getNumber())
                .size(dsPage.getSize())
                .totalElements(dsPage.getTotalElements())
                .totalPages(dsPage.getTotalPages())
                .last(dsPage.isLast())
                .build();
    }

    @Transactional(readOnly = true)
    public DatasourceResponse getDatasourceById(UUID id) {
        Datasource ds = datasourceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Datasource", "id", id));
        long rowCount = dsRowRepository.countByDatasourceId(id);
        return toResponse(ds, rowCount);
    }

    @Transactional
    public DatasourceResponse updateDatasource(UUID id, UpdateDatasourceRequest request) {
        Datasource ds = datasourceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Datasource", "id", id));

        if (request.getName() != null) ds.setName(request.getName());
        if (request.getDescription() != null) ds.setDescription(request.getDescription());
        if (request.getIcon() != null) ds.setIcon(request.getIcon());
        ds.setUpdatedBy(getCurrentUser());

        ds = datasourceRepository.save(ds);
        return toResponse(ds, dsRowRepository.countByDatasourceId(id));
    }

    @Transactional
    public void deleteDatasource(UUID id) {
        if (reportDatasourceRepository.existsByDatasourceId(id)) {
            throw new BusinessException("Không thể xóa Nguồn dữ liệu vì đang được kết nối với Báo cáo. Vui lòng gỡ liên kết trong báo cáo trước.");
        }
        Datasource ds = datasourceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Datasource", "id", id));
        ds.setDeletedAt(Instant.now());
        datasourceRepository.save(ds);
    }

    // ============================================================
    // COLUMNS
    // ============================================================

    @Transactional
    public DsColumnResponse addColumn(UUID datasourceId, UpsertColumnRequest request) {
        Datasource ds = datasourceRepository.findById(datasourceId)
                .orElseThrow(() -> new ResourceNotFoundException("Datasource", "id", datasourceId));

        int order = request.getColumnOrder() != null
                ? request.getColumnOrder()
                : dsColumnRepository.findMaxColumnOrder(datasourceId) + 1;

        DsColumn col = DsColumn.builder()
                .datasource(ds)
                .name(request.getName())
                .dataType(request.getDataType())
                .columnOrder(order)
                .isRequired(request.getIsRequired() != null ? request.getIsRequired() : false)
                .config(request.getConfig() != null ? request.getConfig() : "{}")
                .build();

        col = dsColumnRepository.save(col);
        return toColumnResponse(col);
    }

    @Transactional
    public DsColumnResponse updateColumn(UUID columnId, UpsertColumnRequest request) {
        DsColumn col = dsColumnRepository.findById(columnId)
                .orElseThrow(() -> new ResourceNotFoundException("Cột", "id", columnId));

        if (request.getName() != null) col.setName(request.getName());
        if (request.getDataType() != null) col.setDataType(request.getDataType());
        if (request.getColumnOrder() != null) col.setColumnOrder(request.getColumnOrder());
        if (request.getIsRequired() != null) col.setIsRequired(request.getIsRequired());
        if (request.getConfig() != null) col.setConfig(request.getConfig());

        col = dsColumnRepository.save(col);
        return toColumnResponse(col);
    }

    @Transactional
    public void deleteColumn(UUID columnId) {
        if (!dsColumnRepository.existsById(columnId)) {
            throw new ResourceNotFoundException("Cột", "id", columnId);
        }
        dsColumnRepository.deleteById(columnId);
    }

    @Transactional(readOnly = true)
    public List<DsColumnResponse> getColumns(UUID datasourceId) {
        return dsColumnRepository.findByDatasourceIdOrderByColumnOrderAsc(datasourceId)
                .stream().map(this::toColumnResponse).toList();
    }

    // ============================================================
    // ROWS & CELLS
    // ============================================================

    @Transactional
    public DsRowResponse addRow(UUID datasourceId, UpsertRowRequest request) {
        Datasource ds = datasourceRepository.findById(datasourceId)
                .orElseThrow(() -> new ResourceNotFoundException("Datasource", "id", datasourceId));

        int order = dsRowRepository.findMaxRowOrder(datasourceId) + 1;

        DsRow row = DsRow.builder()
                .datasource(ds)
                .rowOrder(order)
                .createdBy(getCurrentUser())
                .build();
        row = dsRowRepository.save(row);

        Map<String, CellValueResponse> cellMap = new LinkedHashMap<>();
        if (request != null && request.getCells() != null) {
            for (Map.Entry<String, CellValueRequest> entry : request.getCells().entrySet()) {
                UUID columnId = UUID.fromString(entry.getKey());
                DsColumn col = dsColumnRepository.findById(columnId)
                        .orElseThrow(() -> new ResourceNotFoundException("Cột", "id", columnId));

                DsCell cell = buildCell(row, col, entry.getValue());
                cell = dsCellRepository.save(cell);
                cellMap.put(entry.getKey(), toCellResponse(cell));
            }
        }

        return DsRowResponse.builder()
                .id(row.getId())
                .rowOrder(row.getRowOrder())
                .cells(cellMap)
                .createdAt(row.getCreatedAt())
                .build();
    }

    @Transactional
    public DsRowResponse updateRow(UUID rowId, UpsertRowRequest request) {
        DsRow row = dsRowRepository.findById(rowId)
                .orElseThrow(() -> new ResourceNotFoundException("Hàng", "id", rowId));

        Map<String, CellValueResponse> cellMap = new LinkedHashMap<>();
        if (request.getCells() != null) {
            for (Map.Entry<String, CellValueRequest> entry : request.getCells().entrySet()) {
                UUID columnId = UUID.fromString(entry.getKey());
                DsColumn col = dsColumnRepository.findById(columnId)
                        .orElseThrow(() -> new ResourceNotFoundException("Cột", "id", columnId));

                DsCell cell = dsCellRepository.findByRowIdAndColumnId(rowId, columnId)
                        .orElse(DsCell.builder().row(row).column(col).build());

                CellValueRequest val = entry.getValue();
                cell.setValueText(val.getValueText());
                cell.setValueNumber(val.getValueNumber());
                cell.setValueBoolean(val.getValueBoolean());
                cell.setValueDate(val.getValueDate() != null ? Instant.parse(val.getValueDate()) : null);
                cell.setValueJson(val.getValueJson());

                cell = dsCellRepository.save(cell);
                cellMap.put(entry.getKey(), toCellResponse(cell));
            }
        }

        return DsRowResponse.builder()
                .id(row.getId())
                .rowOrder(row.getRowOrder())
                .cells(cellMap)
                .createdAt(row.getCreatedAt())
                .build();
    }

    @Transactional
    public void deleteRow(UUID rowId) {
        if (!dsRowRepository.existsById(rowId)) {
            throw new ResourceNotFoundException("Hàng", "id", rowId);
        }
        dsRowRepository.deleteById(rowId);
    }

    @Transactional(readOnly = true)
    public PageResponse<DsRowResponse> getRows(UUID datasourceId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<DsRow> rowPage = dsRowRepository.findByDatasourceIdOrderByRowOrderAsc(datasourceId, pageable);

        List<UUID> rowIds = rowPage.getContent().stream().map(DsRow::getId).toList();
        List<DsCell> allCells = dsCellRepository.findByRowIdIn(rowIds);

        Map<UUID, List<DsCell>> cellsByRow = allCells.stream()
                .collect(Collectors.groupingBy(c -> c.getRow().getId()));

        List<DsRowResponse> content = rowPage.getContent().stream().map(row -> {
            Map<String, CellValueResponse> cellMap = new LinkedHashMap<>();
            List<DsCell> rowCells = cellsByRow.getOrDefault(row.getId(), List.of());
            for (DsCell cell : rowCells) {
                cellMap.put(cell.getColumn().getId().toString(), toCellResponse(cell));
            }
            return DsRowResponse.builder()
                    .id(row.getId())
                    .rowOrder(row.getRowOrder())
                    .cells(cellMap)
                    .createdAt(row.getCreatedAt())
                    .build();
        }).toList();

        return PageResponse.<DsRowResponse>builder()
                .content(content)
                .page(rowPage.getNumber())
                .size(rowPage.getSize())
                .totalElements(rowPage.getTotalElements())
                .totalPages(rowPage.getTotalPages())
                .last(rowPage.isLast())
                .build();
    }

    // ============================================================
    // DATA QUERY (for charts)
    // ============================================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> queryDatasourceData(UUID datasourceId) {
        List<DsColumn> columns = dsColumnRepository.findByDatasourceIdOrderByColumnOrderAsc(datasourceId);
        List<DsRow> rows = dsRowRepository.findByDatasourceIdOrderByRowOrderAsc(datasourceId);
        List<UUID> rowIds = rows.stream().map(DsRow::getId).toList();
        List<DsCell> allCells = dsCellRepository.findByRowIdIn(rowIds);

        Map<UUID, List<DsCell>> cellsByRow = allCells.stream()
                .collect(Collectors.groupingBy(c -> c.getRow().getId()));

        Map<UUID, String> colNames = columns.stream()
                .collect(Collectors.toMap(DsColumn::getId, DsColumn::getName));

        List<Map<String, Object>> result = new ArrayList<>();
        for (DsRow row : rows) {
            Map<String, Object> rowMap = new LinkedHashMap<>();
            List<DsCell> rowCells = cellsByRow.getOrDefault(row.getId(), List.of());
            for (DsCell cell : rowCells) {
                String colName = colNames.getOrDefault(cell.getColumn().getId(), "unknown");
                Object value = extractCellValue(cell);
                rowMap.put(colName, value);
            }
            result.add(rowMap);
        }
        return result;
    }

    // ============================================================
    // MAPPERS
    // ============================================================

    private DatasourceResponse toResponse(Datasource ds, long rowCount) {
        List<DsColumnResponse> cols = ds.getColumns() != null
                ? ds.getColumns().stream().map(this::toColumnResponse).toList()
                : List.of();

        return DatasourceResponse.builder()
                .id(ds.getId())
                .name(ds.getName())
                .description(ds.getDescription())
                .icon(ds.getIcon())
                .status(ds.getStatus())
                .orgUnitId(ds.getOrgUnit().getId())
                .orgUnitName(ds.getOrgUnit().getName())
                .createdById(ds.getCreatedBy().getId())
                .createdByName(ds.getCreatedBy().getFullName())
                .columns(cols)
                .rowCount(rowCount)
                .createdAt(ds.getCreatedAt())
                .updatedAt(ds.getUpdatedAt())
                .build();
    }

    private DsColumnResponse toColumnResponse(DsColumn col) {
        return DsColumnResponse.builder()
                .id(col.getId())
                .name(col.getName())
                .dataType(col.getDataType())
                .columnOrder(col.getColumnOrder())
                .isRequired(col.getIsRequired())
                .config(col.getConfig())
                .build();
    }

    private CellValueResponse toCellResponse(DsCell cell) {
        return CellValueResponse.builder()
                .valueText(cell.getValueText())
                .valueNumber(cell.getValueNumber())
                .valueBoolean(cell.getValueBoolean())
                .valueDate(cell.getValueDate())
                .valueJson(cell.getValueJson())
                .build();
    }

    private DsCell buildCell(DsRow row, DsColumn col, CellValueRequest val) {
        return DsCell.builder()
                .row(row)
                .column(col)
                .valueText(val.getValueText())
                .valueNumber(val.getValueNumber())
                .valueBoolean(val.getValueBoolean())
                .valueDate(val.getValueDate() != null ? Instant.parse(val.getValueDate()) : null)
                .valueJson(val.getValueJson())
                .build();
    }

    private Object extractCellValue(DsCell cell) {
        if (cell.getValueNumber() != null) return cell.getValueNumber();
        if (cell.getValueBoolean() != null) return cell.getValueBoolean();
        if (cell.getValueDate() != null) return cell.getValueDate().toString();
        if (cell.getValueText() != null) return cell.getValueText();
        if (cell.getValueJson() != null) return cell.getValueJson();
        return null;
    }
}
