package com.kpitracking.enums;

import java.util.List;

/**
 * Đối tượng mà một quy trình duyệt áp dụng ("Đối tượng" trên màn 1Office), kèm nhóm và các đối
 * tượng con. Thứ tự khai báo là thứ tự hiện trên giao diện.
 *
 * <p>Đối tượng chưa nối vào chuỗi duyệt ({@code subjectType == null}) vẫn có trong danh mục để
 * người dùng thấy lộ trình, nhưng chưa cho tạo quy trình — quy trình đó sẽ không có tác dụng gì.
 */
public enum ApprovalObjectType {
    /** Thiết lập và giao KPI: đối tượng con theo loại chỉ tiêu ({@link KpiType}). */
    KPI_CRITERIA(Group.KPI, ApprovalSubjectType.CRITERIA, List.of("QUANTITATIVE", "QUALITATIVE")),
    /** Báo cáo kết quả KPI (bài nộp): đối tượng con theo loại chỉ tiêu của KPI. */
    KPI_SUBMISSION(Group.KPI, ApprovalSubjectType.SUBMISSION, List.of("QUANTITATIVE", "QUALITATIVE")),
    /** Đánh giá và xếp loại hiệu suất (đánh giá của quản lý). */
    KPI_EVALUATION(Group.KPI, ApprovalSubjectType.EVALUATION, List.of()),
    /** Điều chỉnh KPI: đổi chỉ tiêu, hoặc xin dừng KPI. */
    KPI_ADJUSTMENT(Group.KPI, ApprovalSubjectType.ADJUSTMENT, List.of("CHANGE_TARGET", "DEACTIVATE")),
    /** Chốt kỳ và công nhận kết quả của một đơn vị (đơn vị gốc ⇒ khoá kỳ). */
    CYCLE_FINALIZE(Group.KPI, ApprovalSubjectType.CYCLE_FINALIZE, List.of("ROOT_UNIT", "CHILD_UNIT")),
    /** Lập và phê duyệt thẻ điểm BSC. */
    BSC_SCORECARD(Group.BSC, ApprovalSubjectType.BSC_SCORECARD, List.of()),
    /** Chốt kết quả thẻ điểm đơn vị. */
    BSC_RESULT(Group.BSC, ApprovalSubjectType.BSC_RESULT, List.of()),
    /** Đề xuất khen thưởng vượt / ngoài ngân sách. */
    REWARD_GRANT(Group.REWARD, ApprovalSubjectType.REWARD_GRANT, List.of()),
    /** Duyệt đổi quà nội bộ cần giao. */
    GIFT_REDEMPTION(Group.REWARD, ApprovalSubjectType.GIFT_REDEMPTION, List.of()),
    /**
     * Đơn từ. Mỗi đơn tự giữ sơ đồ của nó ({@code approval_forms.process_definition}); quy trình lập ở màn
     * Quy trình duyệt cho các đơn cụ thể (đối tượng con = id đơn, động theo tổ chức) được ƯU TIÊN hơn sơ đồ
     * riêng đó khi đang bật.
     */
    FORM_REQUEST(Group.FORM, ApprovalSubjectType.FORM_REQUEST, List.of());

    public static final class Group {
        public static final String KPI = "KPI";
        public static final String BSC = "BSC";
        public static final String REWARD = "REWARD";
        public static final String FORM = "FORM";

        private Group() {}
    }

    private final String group;
    private final ApprovalSubjectType subjectType;
    private final List<String> subObjects;

    ApprovalObjectType(String group, ApprovalSubjectType subjectType, List<String> subObjects) {
        this.group = group;
        this.subjectType = subjectType;
        this.subObjects = subObjects;
    }

    public String group() {
        return group;
    }

    public ApprovalSubjectType subjectType() {
        return subjectType;
    }

    public List<String> subObjects() {
        return subObjects;
    }

    /** Đã nối vào chuỗi duyệt — quy trình của đối tượng này có tác dụng thật. */
    public boolean available() {
        return subjectType != null;
    }

    /** Đối tượng con là danh sách động (id đơn từ của tổ chức), không phải mã cố định ở {@link #subObjects()}. */
    public boolean dynamicSubObjects() {
        return this == FORM_REQUEST;
    }

    public static ApprovalObjectType of(ApprovalSubjectType subjectType) {
        for (ApprovalObjectType t : values()) {
            if (t.subjectType == subjectType) return t;
        }
        throw new IllegalArgumentException("No approval object for " + subjectType);
    }
}
