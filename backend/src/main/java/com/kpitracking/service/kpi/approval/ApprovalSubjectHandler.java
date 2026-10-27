package com.kpitracking.service.kpi.approval;

import com.kpitracking.entity.kpi.KpiApprovalFlow;
import com.kpitracking.entity.user.User;
import com.kpitracking.enums.kpi.ApprovalSubjectType;

import java.util.Map;

/**
 * Tác dụng thật của một loại đề xuất đi theo quy trình duyệt mà CHƯA có bản ghi cho tới khi duyệt
 * xong (đánh giá đợt, chốt kỳ…). Duyệt / từ chối chung đi qua {@link ApprovalActionService}; loại
 * nào không có handler (chỉ tiêu, điều chỉnh, bài nộp) thì duyệt ở màn riêng của nó.
 */
public interface ApprovalSubjectHandler {

    ApprovalSubjectType type();

    /**
     * Chạy TRƯỚC khi khoá flow: khoá kỳ ({@code FOR SHARE}) trước, flow sau — cùng thứ tự với thủ
     * tục khoá kỳ. Kỳ đã khoá thì ném lỗi ngay.
     */
    void guard(Map<String, Object> payload);

    /**
     * Bước cuối vừa duyệt: áp đề xuất bằng đúng thao tác cũ, kiểm lại dữ liệu lúc này. Chạy trong
     * transaction của người duyệt, flow đang khoá; ném lỗi ⇒ cả lần duyệt cuộn lại.
     */
    void apply(KpiApprovalFlow flow, User actor);

    /** Bị từ chối ở một bước: trả đối tượng về như khi người duyệt cũ bấm "trả lại". Mặc định không làm gì. */
    default void onRejected(KpiApprovalFlow flow, User actor, String reason) {}
}
