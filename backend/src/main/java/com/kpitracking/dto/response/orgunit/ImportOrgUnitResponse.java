package com.kpitracking.dto.response.orgunit;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImportOrgUnitResponse {
    private int totalRows;
    private int successfulImports;
    private List<String> errors;
}
