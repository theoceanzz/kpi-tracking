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
    /** Đơn từ của tổ chức — đối tượng con của FORM_REQUEST, đã xếp theo nhóm đơn. */
    private List<FormOption> forms;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class FormOption {
        private String id;
        private String name;
        private String groupName;
        private boolean active;
        /** Mẫu đơn: giao diện suy ra các trường số / lựa chọn mà điều kiện dùng được. */
        private Object schema;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ObjectType {
        private String code;
        private String group;
        private List<String> subObjects;
        /** false: đối tượng chưa nối vào chuỗi duyệt, chưa tạo quy trình được. */
        private boolean available;
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
