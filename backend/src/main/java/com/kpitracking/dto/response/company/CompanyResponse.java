package com.kpitracking.dto.response.company;

import com.kpitracking.enums.CompanyStatus;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CompanyResponse {

    private UUID id;
    private String name;
    private String taxCode;
    private String email;
    private String phone;
    private String address;
    private UUID provinceId;
    private String provinceName;
    private UUID districtId;
    private String districtName;
    private String logoUrl;
    private CompanyStatus status;
    private Instant createdAt;
    private Instant updatedAt;
}
