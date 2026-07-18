package com.kpitracking.dto.response.bsc;

import lombok.*;

import java.util.List;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ImportBscResponse {
    private int totalRows;
    private int successfulImports;
    private List<String> errors;
}
