package com.kpitracking.controller;

import com.kpitracking.dto.request.user.CreateUserRequest;
import com.kpitracking.dto.request.user.UpdateUserRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.user.UserResponse;
import com.kpitracking.dto.response.user.ImportUserResponse;
import com.kpitracking.service.UserService;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "Users", description = "User management endpoints")
public class UserController {

    private final UserService userService;

    @PostMapping
    @PreAuthorize("hasRole('DIRECTOR')")
    @Operation(summary = "Create a new user (Director only)")
    public ResponseEntity<ApiResponse<UserResponse>> createUser(@Valid @RequestBody CreateUserRequest request) {
        UserResponse response = userService.createUser(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("User created successfully", response));
    }

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('DIRECTOR')")
    @Operation(summary = "Import users via Excel or CSV (Director only)")
    public ResponseEntity<ApiResponse<ImportUserResponse>> importUsers(@RequestParam("file") MultipartFile file) {
        ImportUserResponse response = userService.importUsers(file);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Users imported successfully", response));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('DIRECTOR', 'HEAD')")
    @Operation(summary = "List users with optional search")
    public ResponseEntity<ApiResponse<PageResponse<UserResponse>>> getUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) UUID departmentId) {
        PageResponse<UserResponse> response = userService.getUsers(page, size, keyword);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/{userId}")
    @PreAuthorize("hasAnyRole('DIRECTOR', 'HEAD')")
    @Operation(summary = "Get user by ID")
    public ResponseEntity<ApiResponse<UserResponse>> getUserById(@PathVariable UUID userId) {
        UserResponse response = userService.getUserById(userId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{userId}")
    @PreAuthorize("hasRole('DIRECTOR')")
    @Operation(summary = "Update user (Director only)")
    public ResponseEntity<ApiResponse<UserResponse>> updateUser(
            @PathVariable UUID userId,
            @Valid @RequestBody UpdateUserRequest request) {
        UserResponse response = userService.updateUser(userId, request);
        return ResponseEntity.ok(ApiResponse.success("User updated successfully", response));
    }

    @DeleteMapping("/{userId}")
    @PreAuthorize("hasRole('DIRECTOR')")
    @Operation(summary = "Soft delete user (Director only)")
    public ResponseEntity<ApiResponse<Void>> deleteUser(@PathVariable UUID userId) {
        userService.deleteUser(userId);
        return ResponseEntity.ok(ApiResponse.success("User deleted successfully"));
    }
}
