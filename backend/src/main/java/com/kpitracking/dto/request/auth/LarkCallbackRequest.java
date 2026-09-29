package com.kpitracking.dto.request.auth;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class LarkCallbackRequest {

    @NotBlank(message = "{validation.larkAuthorizationCodeMissing}")
    private String code;

    @NotBlank(message = "{validation.stateParameterMissing}")
    private String state;
}
