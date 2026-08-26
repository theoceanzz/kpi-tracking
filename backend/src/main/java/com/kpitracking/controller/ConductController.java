package com.kpitracking.controller;

import com.kpitracking.dto.request.conduct.ConductScoreRequest;
import com.kpitracking.dto.request.conduct.ConductSetRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.conduct.ConductConfigResponse;
import com.kpitracking.dto.response.conduct.ConductSheetResponse;
import com.kpitracking.dto.response.conduct.ConductSummaryResponse;
import com.kpitracking.enums.ConductScope;
import com.kpitracking.service.ConductService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Chấm hạnh kiểm theo đợt/kỳ.
 *
 * Quyền dùng lại đúng bộ đang có, không thêm mã quyền mới: cấu hình bộ tiêu chí đi cùng
 * COMPANY:UPDATE như các thiết lập cấp tổ chức khác; chấm cho người khác đi cùng
 * EVALUATION:CREATE như đánh giá KPI; tự chấm thì ai cũng làm được cho chính mình.
 */
@RestController
@RequestMapping("/api/v1/conduct")
@RequiredArgsConstructor
@Tag(name = "Conduct", description = "Đánh giá xếp loại hành vi (hạnh kiểm) theo bộ tiêu chí có trọng số")
public class ConductController {

    private final ConductService conductService;

    @GetMapping("/config/{organizationId}")
    @Operation(summary = "Toàn bộ các bộ tiêu chí hạnh kiểm của tổ chức và kỳ áp dụng của từng bộ")
    public ResponseEntity<ApiResponse<ConductConfigResponse>> getConfig(@PathVariable UUID organizationId) {
        return ResponseEntity.ok(ApiResponse.success(conductService.getConfig(organizationId)));
    }

    // Mỗi bộ là một tài nguyên riêng thay vì một lần PUT cả cấu hình: sửa một bộ không được
    // đụng tới tiêu chí của bộ mà kỳ khác đang chấm dở.

    @PostMapping("/config/{organizationId}/sets")
    @PreAuthorize("hasAuthority('COMPANY:UPDATE')")
    @Operation(summary = "Tạo một bộ tiêu chí mới",
            description = "Không gửi criteria thì chép từ copyFromSetId (mặc định: bộ mặc định).")
    public ResponseEntity<ApiResponse<ConductConfigResponse>> createSet(
            @PathVariable UUID organizationId,
            @Valid @RequestBody ConductSetRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã tạo bộ tiêu chí hạnh kiểm",
                conductService.createSet(organizationId, request)));
    }

    @PutMapping("/config/{organizationId}/sets/{setId}")
    @PreAuthorize("hasAuthority('COMPANY:UPDATE')")
    @Operation(summary = "Lưu một bộ tiêu chí",
            description = "Danh sách criteria gửi lên thay thế toàn bộ tiêu chí của bộ; tổng trọng số phải bằng 100%.")
    public ResponseEntity<ApiResponse<ConductConfigResponse>> updateSet(
            @PathVariable UUID organizationId,
            @PathVariable UUID setId,
            @Valid @RequestBody ConductSetRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Cập nhật bộ tiêu chí hạnh kiểm thành công",
                conductService.updateSet(organizationId, setId, request)));
    }

    @DeleteMapping("/config/{organizationId}/sets/{setId}")
    @PreAuthorize("hasAuthority('COMPANY:UPDATE')")
    @Operation(summary = "Xoá một bộ tiêu chí (các kỳ của nó quay về bộ mặc định)")
    public ResponseEntity<ApiResponse<ConductConfigResponse>> deleteSet(
            @PathVariable UUID organizationId,
            @PathVariable UUID setId) {
        return ResponseEntity.ok(ApiResponse.success("Đã xoá bộ tiêu chí hạnh kiểm",
                conductService.deleteSet(organizationId, setId)));
    }

    @PostMapping("/config/{organizationId}/sets/{setId}/default")
    @PreAuthorize("hasAuthority('COMPANY:UPDATE')")
    @Operation(summary = "Đặt bộ này làm mặc định cho mọi kỳ chưa được gán bộ riêng")
    public ResponseEntity<ApiResponse<ConductConfigResponse>> markDefault(
            @PathVariable UUID organizationId,
            @PathVariable UUID setId) {
        return ResponseEntity.ok(ApiResponse.success("Đã đặt bộ tiêu chí mặc định",
                conductService.markDefault(organizationId, setId)));
    }

    @PostMapping("/config/{organizationId}/reset")
    @PreAuthorize("hasAuthority('COMPANY:UPDATE')")
    @Operation(summary = "Đặt lại một bộ về 4 tiêu chí mặc định (25% mỗi tiêu chí)",
            description = "Bỏ trống setId thì đặt lại bộ mặc định.")
    public ResponseEntity<ApiResponse<ConductConfigResponse>> resetConfig(
            @PathVariable UUID organizationId,
            @RequestParam(required = false) UUID setId) {
        return ResponseEntity.ok(ApiResponse.success("Đã đặt lại bộ tiêu chí mặc định",
                conductService.resetToDefault(organizationId, setId)));
    }

    @GetMapping("/sheet")
    @Operation(summary = "Phiếu chấm hạnh kiểm của một người trong một đợt/kỳ",
            description = "Bỏ trống userId = phiếu của chính mình. Chưa chấm lần nào vẫn trả về đủ dòng tiêu chí.")
    public ResponseEntity<ApiResponse<ConductSheetResponse>> getSheet(
            @RequestParam(required = false) UUID userId,
            @RequestParam ConductScope scope,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID cycleId) {
        return ResponseEntity.ok(ApiResponse.success(conductService.getSheet(userId, scope, periodId, cycleId)));
    }

    @PutMapping("/sheet/self")
    @Operation(summary = "Tự đánh giá: điểm và dẫn chứng của chính mình")
    public ResponseEntity<ApiResponse<ConductSheetResponse>> saveSelf(
            @Valid @RequestBody ConductScoreRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã lưu phần tự đánh giá hạnh kiểm",
                conductService.saveSelfScores(request)));
    }

    @PutMapping("/sheet/manager")
    @PreAuthorize("hasAuthority('EVALUATION:CREATE')")
    @Operation(summary = "Cán bộ quản lý chấm: điểm và nhận xét cho nhân sự")
    public ResponseEntity<ApiResponse<ConductSheetResponse>> saveManager(
            @Valid @RequestBody ConductScoreRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã lưu điểm hạnh kiểm",
                conductService.saveManagerScores(request)));
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAuthority('EVALUATION:VIEW')")
    @Operation(summary = "Danh sách hạnh kiểm của một đơn vị (gồm đơn vị con) trong một đợt/kỳ")
    public ResponseEntity<ApiResponse<List<ConductSummaryResponse>>> listSummary(
            @RequestParam UUID orgUnitId,
            @RequestParam ConductScope scope,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID cycleId) {
        return ResponseEntity.ok(ApiResponse.success(
                conductService.listUnitSummary(orgUnitId, scope, periodId, cycleId)));
    }
}
