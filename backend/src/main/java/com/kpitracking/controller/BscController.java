package com.kpitracking.controller;

import com.kpitracking.dto.request.bsc.PerspectiveRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.bsc.ImportBscResponse;
import com.kpitracking.dto.response.bsc.PerspectiveResponse;
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
}
