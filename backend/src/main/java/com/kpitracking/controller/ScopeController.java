package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.scope.ScopeResponse;
import com.kpitracking.service.ScopeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/scopes")
@RequiredArgsConstructor
@Tag(name = "Scopes", description = "Scope management endpoints")
public class ScopeController {

    private final ScopeService scopeService;

    @GetMapping
    @Operation(summary = "List all scopes")
    public ResponseEntity<ApiResponse<List<ScopeResponse>>> listScopes() {
        List<ScopeResponse> response = scopeService.listScopes();
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/{code}")
    @Operation(summary = "Get scope by code")
    public ResponseEntity<ApiResponse<ScopeResponse>> getScopeByCode(@PathVariable String code) {
        ScopeResponse response = scopeService.getScopeByCode(code);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
