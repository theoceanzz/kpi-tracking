package com.kpitracking.entity.form;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.kpitracking.enums.FormAdminPermission;

import java.util.List;
import java.util.UUID;

/** Một người quản lý đơn và các quyền của họ trên đơn đó. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record FormAdmin(UUID userId, List<FormAdminPermission> permissions) {
    public List<FormAdminPermission> permissionsOrEmpty() {
        return permissions == null ? List.of() : permissions;
    }
}
