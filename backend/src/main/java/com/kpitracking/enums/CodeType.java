package com.kpitracking.enums;

import java.util.List;

/**
 * Các loại mã do hệ thống sinh tự động theo mẫu riêng của từng tổ chức.
 *
 * Mỗi loại tự khai: nhãn hiển thị, mẫu mặc định, token dùng được và bộ ký tự cho phép ở
 * phần chữ cố định. Bộ ký tự KHÔNG giống nhau giữa các loại: mã hạng mục BSC bị chặn ở
 * tầng validate của {@code PerspectiveRequest} với {@code ^[A-Za-z0-9_]*$}, nên mẫu sinh
 * ra dấu gạch ngang sẽ tạo mã hợp lệ ở đây mà chết ở tầng kia.
 */
public enum CodeType {

    OBJECTIVE(
            "Mục tiêu (Objective)",
            "OBJ-{YYYY}-{###}",
            List.of("{YYYY}", "{YY}", "{MM}", "{ORG}", "{UNIT}"),
            "^[A-Za-z0-9._/-]*$"),

    KEY_RESULT(
            "Kết quả then chốt (KR)",
            "{PARENT}-KR{##}",
            List.of("{YYYY}", "{YY}", "{MM}", "{ORG}", "{UNIT}", "{PARENT}"),
            "^[A-Za-z0-9._/-]*$"),

    BSC_PERSPECTIVE(
            "Hạng mục BSC",
            "PSP_{##}",
            List.of("{YYYY}", "{YY}", "{MM}", "{ORG}"),
            "^[A-Za-z0-9_]*$");

    private final String label;
    private final String defaultPattern;
    private final List<String> tokens;
    private final String literalRegex;

    CodeType(String label, String defaultPattern, List<String> tokens, String literalRegex) {
        this.label = label;
        this.defaultPattern = defaultPattern;
        this.tokens = tokens;
        this.literalRegex = literalRegex;
    }

    public String getLabel() { return label; }

    public String getDefaultPattern() { return defaultPattern; }

    /** Token hỗ trợ cho loại mã này, KHÔNG gồm ô số thứ tự {@code {###}} (loại nào cũng có). */
    public List<String> getTokens() { return tokens; }

    public String getLiteralRegex() { return literalRegex; }
}
