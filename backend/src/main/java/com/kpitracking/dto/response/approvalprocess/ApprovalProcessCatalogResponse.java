package com.kpitracking.dto.response.approvalprocess;

import lombok.*;

import java.util.List;

/**
 * Bộ từ vựng của màn sửa quy trình: đối tượng / đối tượng con, trường điều kiện kèm kiểu giá trị
 * và toán tử, các loại người duyệt. Chỉ trả MÃ — giao diện dịch nhãn theo mã.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ApprovalProcessCatalogResponse {
    private List<ObjectType> objects;
    private List<Field> fields;
    private List<String> approverTypes;
    private int maxLevelsUp;
    /** Chế độ duyệt của tổ chức: quy trình chỉ có hiệu lực khi là CHAIN. */
    private boolean chainMode;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ObjectType {
        private String code;
        private String group;
        private List<String> subObjects;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Field {
        private String code;
        private String valueType;
        private List<String> operators;
        private List<String> objects;
        private List<String> options;
    }
}
