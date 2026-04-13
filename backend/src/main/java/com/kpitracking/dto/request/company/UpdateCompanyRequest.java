package com.kpitracking.dto.request.company;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UpdateCompanyRequest {

    @Size(max = 255, message = "Company name must not exceed 255 characters")
    private String name;

    private String taxCode;

    @Email(message = "Invalid email format")
    private String email;

    private String phone;

    private String address;

    private UUID provinceId;

    private UUID districtId;
}
