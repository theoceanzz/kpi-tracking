package com.kpitracking.dto.response.scope;

import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ScopeResponse {

    private UUID id;
    private String code;
}
