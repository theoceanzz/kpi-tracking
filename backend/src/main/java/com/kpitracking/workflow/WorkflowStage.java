package com.kpitracking.workflow;

/**
 * Các BƯỚC của luồng KPI — đơn vị mà tổ chức bật/tắt và sắp xếp được.
 *
 * <p>Enum này cố ý KHÔNG mang metadata (route, quyền, phụ thuộc): metadata nằm ở
 * {@link StageRegistry} vì phụ thuộc giữa các bước là tham chiếu vòng giữa chính các hằng số enum,
 * mà hằng số enum thì không tham chiếu lẫn nhau được trong constructor.
 *
 * <p>Thứ tự khai báo ở đây là thứ tự NGHIỆP VỤ (ràng buộc bởi dữ liệu, không đổi được).
 * Thứ tự HIỂN THỊ do cấu hình của tổ chức quyết định — xem {@code StageConfig.order}.
 */
public enum WorkflowStage {

    /** Tạo kỳ (tháng/quý/năm) gom nhiều đợt. */
    CYCLE_SETUP,

    /** Tạo đợt KPI — mốc thời gian mà mọi hoạt động KPI bám vào. */
    PERIOD_SETUP,

    /** Soạn chỉ tiêu KPI (DRAFT). */
    CRITERIA_DRAFT,

    /** Gửi duyệt và phê duyệt chỉ tiêu. */
    CRITERIA_APPROVAL,

    /** Yêu cầu và duyệt điều chỉnh chỉ tiêu đã duyệt. */
    CRITERIA_ADJUSTMENT,

    /** Nhân viên nộp báo cáo kết quả. */
    SUBMISSION,

    /** Quản lý phê duyệt bản nộp. */
    SUBMISSION_REVIEW,

    /** Nhân viên tự đánh giá. */
    SELF_EVALUATION,

    /** Quản lý chấm điểm nhân viên. */
    MANAGER_EVALUATION,

    /** Tổng hợp và chốt đánh giá theo kỳ. */
    CYCLE_EVALUATION
}
