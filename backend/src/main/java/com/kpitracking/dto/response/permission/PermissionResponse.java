package com.kpitracking.dto.response.permission;

import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class PermissionResponse {

    private UUID id;
    private String code;
    private String resource;
    private String action;
}
