package com.kpitracking.constant;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class RolePermissionConstants {

    public static final List<String> SYSTEM_ONLY = Arrays.asList(
            "SYSTEM:ADMIN", "COMPANY:DELETE", "ROLE:DELETE", "POLICY:DELETE", "PERMISSION:EDIT"
    );

    public static final List<String> PERSONAL_PERMS = Arrays.asList(
            "KPI:VIEW_MY", "SUBMISSION:VIEW_MY", "EVALUATION:VIEW_MY", "STATS:VIEW_MY", "ADJUSTMENT:VIEW_MY"
    );

    public static final List<String> UNIT_HEAD_PERSONAL_PERMS = Arrays.asList(
            "KPI:VIEW_MY", "SUBMISSION:VIEW_MY", "STATS:VIEW_MY", "ADJUSTMENT:VIEW_MY"
    );

    // ----------------------------------------------------------------
    // Archetype DIRECTOR: quyền quản lý toàn phần (không có SYSTEM_ONLY)
    // Khi isTopLevel=true → sẽ cộng thêm SYSTEM_ONLY ở bên dưới
    // ----------------------------------------------------------------
    public static final List<String> DIRECTOR_PERMS = Arrays.asList(
            "DASHBOARD:VIEW", "COMPANY:VIEW", "COMPANY:UPDATE",
            "ORG:VIEW", "ORG:CREATE", "ORG:UPDATE", "ORG:DELETE",
            "USER:VIEW", "USER:CREATE", "USER:UPDATE", "USER:DELETE", "USER:IMPORT",
            "ROLE:VIEW", "ROLE:ASSIGN", "ROLE:CREATE", "ROLE:UPDATE",
            "PERMISSION:VIEW",
            "KPI:VIEW", "KPI:CREATE", "KPI:UPDATE", "KPI:DELETE", "KPI:APPROVE_CRITERIA", "KPI:APPROVE_ADJUSTMENT",
            "KPI:IMPORT", "KPI:SUBMIT", "KPI:REJECT",
            "SUBMISSION:REVIEW", "SUBMISSION:VIEW", "SUBMISSION:DELETE", "SUBMISSION:UPDATE",
            "EVALUATION:VIEW", "EVALUATION:CREATE", "EVALUATION:UPDATE", "EVALUATION:DELETE",
            "NOTIF:VIEW", "NOTIF:MANAGE",
            "KPI_PERIOD:VIEW", "KPI_PERIOD:CREATE", "KPI_PERIOD:UPDATE", "KPI_PERIOD:DELETE",
            "AI:SUGGEST_KPI",
            "POLICY:VIEW", "POLICY:CREATE", "POLICY:UPDATE", "POLICY:ASSIGN",
            "STATS:VIEW_ORG", "STATS:VIEW_EMPLOYEE",
            "USER_ROLE:VIEW", "USER_ROLE:ASSIGN", "USER_ROLE:REVOKE",
            "ATTACHMENT:UPLOAD", "ATTACHMENT:DELETE",
            "REMINDER:SEND"
    );

    // ----------------------------------------------------------------
    // Archetype DEPUTY_DIRECTOR: như DIRECTOR nhưng bớt quyền xoá/cấu hình
    // Khi isTopLevel=true → cộng thêm SYSTEM_ONLY trừ SYSTEM:ADMIN
    // ----------------------------------------------------------------
    public static final List<String> DEPUTY_DIRECTOR_PERMS = Arrays.asList(
            "DASHBOARD:VIEW", "COMPANY:VIEW",
            "ORG:VIEW", "ORG:CREATE", "ORG:UPDATE",
            "USER:VIEW", "USER:CREATE", "USER:UPDATE", "USER:IMPORT",
            "ROLE:VIEW", "ROLE:ASSIGN", "ROLE:CREATE", "ROLE:UPDATE",
            "PERMISSION:VIEW",
            "KPI:VIEW", "KPI:CREATE", "KPI:UPDATE", "KPI:APPROVE_CRITERIA", "KPI:APPROVE_ADJUSTMENT",
            "KPI:IMPORT", "KPI:SUBMIT", "KPI:REJECT",
            "SUBMISSION:REVIEW", "SUBMISSION:VIEW", "SUBMISSION:UPDATE",
            "EVALUATION:VIEW", "EVALUATION:CREATE", "EVALUATION:UPDATE",
            "NOTIF:VIEW", "NOTIF:MANAGE",
            "KPI_PERIOD:VIEW", "KPI_PERIOD:CREATE", "KPI_PERIOD:UPDATE",
            "AI:SUGGEST_KPI",
            "POLICY:VIEW", "POLICY:CREATE", "POLICY:UPDATE", "POLICY:ASSIGN",
            "STATS:VIEW_ORG", "STATS:VIEW_EMPLOYEE",
            "USER_ROLE:VIEW", "USER_ROLE:ASSIGN",
            "ATTACHMENT:UPLOAD",
            "REMINDER:SEND"
    );

    // ----------------------------------------------------------------
    // Archetype MANAGER: Trưởng các cấp quản lý (Trưởng phòng, Trưởng bộ phận, Trưởng nhóm...)
    // ----------------------------------------------------------------
    public static final List<String> MANAGER_PERMS = Arrays.asList(
            "DASHBOARD:VIEW",
            "ORG:VIEW_TREE",
            "USER:VIEW_LIST",
            "KPI:VIEW", "KPI:CREATE", "KPI:UPDATE", "KPI:DELETE", "KPI:APPROVE_ADJUSTMENT",
            "KPI:IMPORT", "KPI:SUBMIT", "KPI:REJECT",
            "SUBMISSION:VIEW", "SUBMISSION:REVIEW", "SUBMISSION:REVIEW_KPI",
            "EVALUATION:VIEW", "EVALUATION:CREATE",
            "NOTIF:VIEW", "KPI_PERIOD:VIEW",
            "AI:SUGGEST_KPI",
            "STATS:VIEW_EMPLOYEE",
            "ATTACHMENT:UPLOAD",
            "REMINDER:SEND"
    );

    // ----------------------------------------------------------------
    // Archetype DEPUTY: Phó các cấp quản lý (Phó phòng, Phó bộ phận, Phó nhóm...)
    // ----------------------------------------------------------------
    public static final List<String> DEPUTY_PERMS = Arrays.asList(
            "DASHBOARD:VIEW",
            "ORG:VIEW_TREE",
            "USER:VIEW_LIST",
            "KPI:SUBMIT", "KPI:REJECT",
            "SUBMISSION:VIEW", "SUBMISSION:REVIEW_KPI",
            "EVALUATION:VIEW", "EVALUATION:CREATE",
            "NOTIF:VIEW", "KPI_PERIOD:VIEW",
            "AI:SUGGEST_KPI",
            "STATS:VIEW_EMPLOYEE",
            "ATTACHMENT:UPLOAD"
    );

    // ----------------------------------------------------------------
    // Archetype STAFF: Nhân viên (chỉ dữ liệu cá nhân)
    // ----------------------------------------------------------------
    public static final List<String> STAFF_PERMS = Arrays.asList(
            "DASHBOARD:VIEW",
            "KPI:SUBMIT",
            "SUBMISSION:CREATE",
            "EVALUATION:VIEW","EVALUATION:CREATE",
            "NOTIF:VIEW", "KPI_PERIOD:VIEW",
            "ATTACHMENT:UPLOAD"
    );

    // ================================================================
    // CORE METHOD
    // numTiers   : tổng số phân cấp của công ty (2,3,4,5)
    // tierLevel  : vị trí của role này trong công ty (1=cao nhất, n=thấp nhất)
    // archetype  : director | deputy_director | manager | deputy | staff
    // ================================================================
    public static List<String> getPermissions(String archetype, int tierLevel, int numTiers) {
        boolean isTopLevel = (tierLevel == 1);  // vị trí cao nhất trong công ty

        List<String> perms = new ArrayList<>(resolveBasePerms(archetype));

        // Mọi role (trừ Giám đốc) đều có PERSONAL_PERMS (xem dữ liệu của chính mình)
        // Riêng trưởng đơn vị (manager) dùng UNIT_HEAD_PERSONAL_PERMS (không có EVALUATION:VIEW_MY)
        if (!"director".equals(archetype) && !"deputy_director".equals(archetype)) {
            if ("manager".equals(archetype)) {
                addIfAbsent(perms, UNIT_HEAD_PERSONAL_PERMS);
            } else {
                addIfAbsent(perms, PERSONAL_PERMS);
            }
        }

        // Role cao nhất của công ty → có thêm SYSTEM_ONLY
        if (isTopLevel) {
            if ("director".equals(archetype)) {
                addIfAbsent(perms, SYSTEM_ONLY);  // full SYSTEM_ONLY
            } else if ("deputy_director".equals(archetype)) {
                // Phó cấp cao nhất: có SYSTEM_ONLY nhưng không có SYSTEM:ADMIN
                SYSTEM_ONLY.stream()
                        .filter(p -> !"SYSTEM:ADMIN".equals(p))
                        .forEach(p -> addIfAbsent(perms, p));
            }
        }

        return perms;
    }

    // ----------------------------------------------------------------
    private static List<String> resolveBasePerms(String archetype) {
        switch (archetype.toLowerCase()) {
            case "director":         return new ArrayList<>(DIRECTOR_PERMS);
            case "deputy_director":  return new ArrayList<>(DEPUTY_DIRECTOR_PERMS);
            case "manager":          return new ArrayList<>(MANAGER_PERMS);
            case "deputy":           return new ArrayList<>(DEPUTY_PERMS);
            case "staff":            return new ArrayList<>(STAFF_PERMS);
            default:                 return new ArrayList<>(Arrays.asList("DASHBOARD:VIEW", "NOTIF:VIEW"));
        }
    }

    private static void addIfAbsent(List<String> target, List<String> toAdd) {
        toAdd.forEach(p -> addIfAbsent(target, p));
    }

    private static void addIfAbsent(List<String> target, String perm) {
        if (!target.contains(perm)) target.add(perm);
    }
}