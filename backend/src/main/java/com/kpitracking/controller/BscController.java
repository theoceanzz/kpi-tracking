package com.kpitracking.controller;

import com.kpitracking.dto.request.bsc.PerspectiveRequest;
import com.kpitracking.dto.request.bsc.ScorecardRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.bsc.ImportBscResponse;
import com.kpitracking.dto.response.bsc.PerspectiveResponse;
import com.kpitracking.dto.response.bsc.ScorecardResponse;
import com.kpitracking.enums.BscScoringMode;
import com.kpitracking.service.BscService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/bsc")
@RequiredArgsConstructor
public class BscController {

    private final BscService bscService;

    // ============================================================
    // Perspectives (lĩnh vực)
    // ============================================================

    /** 4 lĩnh vực BSC cố định của tổ chức — FE dùng để hiển thị/chọn khi cấu hình hạng mục. */
    @GetMapping("/organization/{organizationId}/fixed-perspectives")
    @PreAuthorize("hasAuthority('BSC:VIEW')")
    public ResponseEntity<ApiResponse<List<com.kpitracking.dto.response.bsc.FixedPerspectiveResponse>>> getFixedPerspectives(
            @PathVariable UUID organizationId) {
        return ResponseEntity.ok(ApiResponse.success(bscService.getFixedPerspectives(organizationId)));
    }

    /** Sửa hiển thị (tên/màu/thứ tự) 1 lĩnh vực cố định theo tổ chức. Mã (code) cố định. */
    @PutMapping("/organization/{organizationId}/fixed-perspectives/{code}")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    public ResponseEntity<ApiResponse<com.kpitracking.dto.response.bsc.FixedPerspectiveResponse>> updateFixedPerspective(
            @PathVariable UUID organizationId,
            @PathVariable String code,
            @Valid @RequestBody com.kpitracking.dto.request.bsc.FixedPerspectiveUpdateRequest request) {
        return ResponseEntity.ok(ApiResponse.success(bscService.updateFixedPerspective(organizationId, code, request)));
    }

    @GetMapping("/organization/{organizationId}/perspectives")
    @PreAuthorize("hasAuthority('BSC:VIEW')")
    public ResponseEntity<ApiResponse<List<PerspectiveResponse>>> getPerspectives(@PathVariable UUID organizationId) {
        return ResponseEntity.ok(ApiResponse.success(bscService.getPerspectives(organizationId)));
    }

    @PostMapping("/organization/{organizationId}/perspectives")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    public ResponseEntity<ApiResponse<PerspectiveResponse>> createPerspective(
            @PathVariable UUID organizationId,
            @Valid @RequestBody PerspectiveRequest request) {
        return ResponseEntity.ok(ApiResponse.success(bscService.createPerspective(organizationId, request)));
    }

    @PutMapping("/perspectives/{perspectiveId}")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    public ResponseEntity<ApiResponse<PerspectiveResponse>> updatePerspective(
            @PathVariable UUID perspectiveId,
            @Valid @RequestBody PerspectiveRequest request) {
        return ResponseEntity.ok(ApiResponse.success(bscService.updatePerspective(perspectiveId, request)));
    }

    @DeleteMapping("/perspectives/{perspectiveId}")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    public ResponseEntity<ApiResponse<Void>> deletePerspective(@PathVariable UUID perspectiveId) {
        bscService.deletePerspective(perspectiveId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/organization/{organizationId}/perspectives/import")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    public ResponseEntity<ApiResponse<ImportBscResponse>> importPerspectives(
            @PathVariable UUID organizationId,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(ApiResponse.success(bscService.importPerspectives(organizationId, file)));
    }

    // ============================================================
    // Scorecards (bộ tiêu chí)
    // ============================================================

    @GetMapping("/organization/{organizationId}/scorecards")
    @PreAuthorize("hasAuthority('BSC:VIEW')")
    public ResponseEntity<ApiResponse<List<ScorecardResponse>>> getScorecards(@PathVariable UUID organizationId) {
        return ResponseEntity.ok(ApiResponse.success(bscService.getScorecards(organizationId)));
    }

    @GetMapping("/scorecards/{scorecardId}")
    @PreAuthorize("hasAuthority('BSC:VIEW')")
    public ResponseEntity<ApiResponse<ScorecardResponse>> getScorecard(@PathVariable UUID scorecardId) {
        return ResponseEntity.ok(ApiResponse.success(bscService.getScorecardById(scorecardId)));
    }

    @PostMapping("/organization/{organizationId}/scorecards")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    public ResponseEntity<ApiResponse<ScorecardResponse>> createScorecard(
            @PathVariable UUID organizationId,
            @Valid @RequestBody ScorecardRequest request) {
        return ResponseEntity.ok(ApiResponse.success(bscService.createScorecard(organizationId, request)));
    }

    @PutMapping("/scorecards/{scorecardId}")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    public ResponseEntity<ApiResponse<ScorecardResponse>> updateScorecard(
            @PathVariable UUID scorecardId,
            @Valid @RequestBody ScorecardRequest request) {
        return ResponseEntity.ok(ApiResponse.success(bscService.updateScorecard(scorecardId, request)));
    }

    @DeleteMapping("/scorecards/{scorecardId}")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    public ResponseEntity<ApiResponse<Void>> deleteScorecard(@PathVariable UUID scorecardId) {
        bscService.deleteScorecard(scorecardId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PatchMapping("/scorecards/{scorecardId}/scoring-mode")
    @PreAuthorize("hasAuthority('BSC:PUBLISH_SCORE')")
    public ResponseEntity<ApiResponse<ScorecardResponse>> updateScoringMode(
            @PathVariable UUID scorecardId,
            @RequestParam BscScoringMode mode) {
        return ResponseEntity.ok(ApiResponse.success(bscService.updateScoringMode(scorecardId, mode)));
    }

    @PostMapping("/organization/{organizationId}/scorecards/import")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    public ResponseEntity<ApiResponse<ImportBscResponse>> importScorecards(
            @PathVariable UUID organizationId,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(ApiResponse.success(bscService.importScorecards(organizationId, file)));
    }
}
