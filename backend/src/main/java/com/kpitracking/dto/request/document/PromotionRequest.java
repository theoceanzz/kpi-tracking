package com.kpitracking.dto.request.document;

import com.kpitracking.enums.DocumentScope;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/** Đề xuất đưa tài liệu lên đơn vị ({@code targetUnitId}) hoặc công ty. */
public record PromotionRequest(@NotNull DocumentScope targetScope, UUID targetUnitId, @Size(max = 2000) String note) {}
