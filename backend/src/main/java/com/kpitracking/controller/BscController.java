package com.kpitracking.controller;

import com.kpitracking.dto.request.bsc.PerspectiveRequest;
import com.kpitracking.dto.request.bsc.ScorecardRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.bsc.BscDashboardResponse;
import com.kpitracking.dto.response.bsc.ImportBscResponse;
import com.kpitracking.dto.response.bsc.PerspectiveResponse;
import com.kpitracking.dto.response.bsc.ScorecardResponse;
import com.kpitracking.enums.BscScoringMode;
import com.kpitracking.service.BscScoringService;
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
    private final BscScoringService bscScoringService;

    // ============================================================
    // Perspectives (viễn cảnh)
    // ============================================================

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
    // Scorecards (thẻ điểm)
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

    @GetMapping("/scorecards/{scorecardId}/dashboard")
    @PreAuthorize("hasAuthority('BSC:VIEW')")
    public ResponseEntity<ApiResponse<BscDashboardResponse>> getDashboard(@PathVariable UUID scorecardId) {
        return ResponseEntity.ok(ApiResponse.success(bscScoringService.getDashboard(scorecardId)));
    }

    @PostMapping("/organization/{organizationId}/scorecards/import")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    public ResponseEntity<ApiResponse<ImportBscResponse>> importScorecards(
            @PathVariable UUID organizationId,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(ApiResponse.success(bscService.importScorecards(organizationId, file)));
    }
}
