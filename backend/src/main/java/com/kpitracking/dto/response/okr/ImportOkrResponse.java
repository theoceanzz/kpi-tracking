package com.kpitracking.dto.response.okr;

import lombok.*;

import java.util.List;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ImportOkrResponse {
    private int totalRows;
    private int successfulImports;
    private List<String> errors;
}
