package com.kpitracking.dto.response.orgunit;

import com.kpitracking.enums.OrgUnitStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrgUnitExcelResponse {
    private String name;
    private String code;
    private String parentCode;
    /** DIRECT / ADVISORY / SUPERVISORY — cột ParentRelation, nhập lại được. */
    private String parentRelation;
    private String email;
    private String phone;
    private String address;
}
