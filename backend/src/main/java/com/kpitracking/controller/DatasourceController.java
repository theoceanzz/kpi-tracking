package com.kpitracking.controller;

import com.kpitracking.dto.request.datasource.*;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.datasource.*;
import com.kpitracking.service.DatasourceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/datasources")
@RequiredArgsConstructor
@Tag(name = "Datasources", description = "Data Source management endpoints")
public class DatasourceController {

    private final DatasourceService datasourceService;

    // ============================================================
    // DATASOURCE CRUD
    // ============================================================

    @PostMapping
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Create a new datasource")
    public ResponseEntity<ApiResponse<DatasourceResponse>> createDatasource(
            @Valid @RequestBody CreateDatasourceRequest request) {
        DatasourceResponse response = datasourceService.createDatasource(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Tạo datasource thành công", response));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "List datasources")
    public ResponseEntity<ApiResponse<PageResponse<DatasourceResponse>>> getDatasources(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) UUID orgUnitId) {
        PageResponse<DatasourceResponse> response = datasourceService.getDatasources(page, size, orgUnitId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Get datasource by ID")
    public ResponseEntity<ApiResponse<DatasourceResponse>> getDatasource(@PathVariable UUID id) {
        DatasourceResponse response = datasourceService.getDatasourceById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Update datasource")
    public ResponseEntity<ApiResponse<DatasourceResponse>> updateDatasource(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateDatasourceRequest request) {
        DatasourceResponse response = datasourceService.updateDatasource(id, request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật datasource thành công", response));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Soft delete datasource")
    public ResponseEntity<ApiResponse<Void>> deleteDatasource(@PathVariable UUID id) {
        datasourceService.deleteDatasource(id);
        return ResponseEntity.ok(ApiResponse.success("Xóa datasource thành công"));
    }

    // ============================================================
    // COLUMNS
    // ============================================================

    @GetMapping("/{datasourceId}/columns")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Get all columns of a datasource")
    public ResponseEntity<ApiResponse<List<DsColumnResponse>>> getColumns(@PathVariable UUID datasourceId) {
        List<DsColumnResponse> response = datasourceService.getColumns(datasourceId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/{datasourceId}/columns")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Add a column to datasource")
    public ResponseEntity<ApiResponse<DsColumnResponse>> addColumn(
            @PathVariable UUID datasourceId,
            @Valid @RequestBody UpsertColumnRequest request) {
        DsColumnResponse response = datasourceService.addColumn(datasourceId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Thêm cột thành công", response));
    }

    @PutMapping("/columns/{columnId}")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Update a column")
    public ResponseEntity<ApiResponse<DsColumnResponse>> updateColumn(
            @PathVariable UUID columnId,
            @Valid @RequestBody UpsertColumnRequest request) {
        DsColumnResponse response = datasourceService.updateColumn(columnId, request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật cột thành công", response));
    }

    @DeleteMapping("/columns/{columnId}")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Delete a column")
    public ResponseEntity<ApiResponse<Void>> deleteColumn(@PathVariable UUID columnId) {
        datasourceService.deleteColumn(columnId);
        return ResponseEntity.ok(ApiResponse.success("Xóa cột thành công"));
    }

    // ============================================================
    // ROWS & CELLS
    // ============================================================

    @GetMapping("/{datasourceId}/rows")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Get rows with cells (paginated)")
    public ResponseEntity<ApiResponse<PageResponse<DsRowResponse>>> getRows(
            @PathVariable UUID datasourceId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        PageResponse<DsRowResponse> response = datasourceService.getRows(datasourceId, page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/{datasourceId}/rows")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Add a row with cell values")
    public ResponseEntity<ApiResponse<DsRowResponse>> addRow(
            @PathVariable UUID datasourceId,
            @RequestBody(required = false) UpsertRowRequest request) {
        DsRowResponse response = datasourceService.addRow(datasourceId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Thêm hàng thành công", response));
    }

    @PutMapping("/rows/{rowId}")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Update a row's cell values")
    public ResponseEntity<ApiResponse<DsRowResponse>> updateRow(
            @PathVariable UUID rowId,
            @Valid @RequestBody UpsertRowRequest request) {
        DsRowResponse response = datasourceService.updateRow(rowId, request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật hàng thành công", response));
    }

    @DeleteMapping("/rows/{rowId}")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Delete a row")
    public ResponseEntity<ApiResponse<Void>> deleteRow(@PathVariable UUID rowId) {
        datasourceService.deleteRow(rowId);
        return ResponseEntity.ok(ApiResponse.success("Xóa hàng thành công"));
    }

    // ============================================================
    // DATA QUERY (for charts)
    // ============================================================

    @GetMapping("/{datasourceId}/data")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Query all data from a datasource (for chart rendering)")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> queryData(@PathVariable UUID datasourceId) {
        List<Map<String, Object>> data = datasourceService.queryDatasourceData(datasourceId);
        return ResponseEntity.ok(ApiResponse.success(data));
    }
}
