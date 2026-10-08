package com.kpitracking.dto.request.document;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RenameFolderRequest(@NotBlank @Size(max = 255) String name) {}
