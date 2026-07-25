package com.kpitracking.controller;

import com.kpitracking.dto.request.okr.KeyResultRequest;
import com.kpitracking.dto.request.okr.ObjectiveRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.okr.ImportOkrResponse;
import com.kpitracking.dto.response.okr.KeyResultResponse;
import com.kpitracking.dto.response.okr.ObjectiveResponse;
import com.kpitracking.service.OkrService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/okr")
@RequiredArgsConstructor
public class OkrController {

    private final OkrService okrService;

    @GetMapping("/organization/{organizationId}/objectives")
    @PreAuthorize("hasAuthority('OKR:VIEW')")
    public ResponseEntity<ApiResponse<List<ObjectiveResponse>>> getObjectivesByOrganization(@PathVariable UUID organizationId) {
        return ResponseEntity.ok(ApiResponse.success(okrService.getObjectivesByOrganization(organizationId)));
    }

    @GetMapping("/org-unit/{orgUnitId}/objectives")
    @PreAuthorize("hasAuthority('OKR:VIEW')")
    public ResponseEntity<ApiResponse<List<ObjectiveResponse>>> getObjectivesByOrgUnit(@PathVariable UUID orgUnitId) {
        return ResponseEntity.ok(ApiResponse.success(okrService.getObjectivesByOrgUnit(orgUnitId)));
    }

    @PostMapping("/organization/{organizationId}/objectives")
    @PreAuthorize("hasAuthority('OKR:MANAGE')")
    public ResponseEntity<ApiResponse<ObjectiveResponse>> createObjective(
            @PathVariable UUID organizationId,
            @Valid @RequestBody ObjectiveRequest request) {
        return ResponseEntity.ok(ApiResponse.success(okrService.createObjective(organizationId, request)));
    }

    @PutMapping("/objectives/{objectiveId}")
    @PreAuthorize("hasAuthority('OKR:MANAGE')")
    public ResponseEntity<ApiResponse<ObjectiveResponse>> updateObjective(
            @PathVariable UUID objectiveId,
            @Valid @RequestBody ObjectiveRequest request) {
        return ResponseEntity.ok(ApiResponse.success(okrService.updateObjective(objectiveId, request)));
    }

    @DeleteMapping("/objectives/{objectiveId}")
    @PreAuthorize("hasAuthority('OKR:MANAGE')")
    public ResponseEntity<ApiResponse<Void>> deleteObjective(@PathVariable UUID objectiveId) {
        okrService.deleteObjective(objectiveId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/key-results")
    @PreAuthorize("hasAuthority('OKR:MANAGE')")
    public ResponseEntity<ApiResponse<KeyResultResponse>> createKeyResult(@Valid @RequestBody KeyResultRequest request) {
        return ResponseEntity.ok(ApiResponse.success(okrService.createKeyResult(request)));
    }

    @PutMapping("/key-results/{keyResultId}")
    @PreAuthorize("hasAuthority('OKR:MANAGE')")
    public ResponseEntity<ApiResponse<KeyResultResponse>> updateKeyResult(
            @PathVariable UUID keyResultId,
            @Valid @RequestBody KeyResultRequest request) {
        return ResponseEntity.ok(ApiResponse.success(okrService.updateKeyResult(keyResultId, request)));
    }

    @DeleteMapping("/key-results/{keyResultId}")
    @PreAuthorize("hasAuthority('OKR:MANAGE')")
    public ResponseEntity<ApiResponse<Void>> deleteKeyResult(@PathVariable UUID keyResultId) {
        okrService.deleteKeyResult(keyResultId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/organization/{organizationId}/import")
    @PreAuthorize("hasAuthority('OKR:MANAGE')")
    public ResponseEntity<ApiResponse<ImportOkrResponse>> importOkrs(
            @PathVariable UUID organizationId,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(ApiResponse.success(okrService.importOkrs(organizationId, file)));
    }
}
