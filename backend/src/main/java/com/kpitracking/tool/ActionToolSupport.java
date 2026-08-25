package com.kpitracking.tool;

import com.kpitracking.service.ai.action.PendingAction.Decision;

import java.util.Locale;

/**
 * Phần dùng chung của bốn tool GHI: bóc quyết định, ép nêu lý do khi từ chối, và ghép tiêu đề.
 *
 * <p>Tách ra vì bốn tool phải nằm ở BỐN bean riêng — {@code ToolCallbacks.from(bean)} lấy mọi
 * {@code @Tool} của một bean, nên gộp chúng lại là gộp luôn cả quyền: ai có quyền duyệt chỉ tiêu
 * sẽ nhận được cả tool gửi nhắc nhở. Bốn việc đòi bốn quyền khác nhau thì phải là bốn bean.
 */
final class ActionToolSupport {

    private ActionToolSupport() {}

    /** Không đoán: hai chiều cho kết quả ngược nhau, và một chiều không có nút hoàn tác. */
    static Decision decisionOf(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException(
                    "Thiếu decision. Truyền APPROVE để duyệt hoặc REJECT để từ chối.");
        }
        String v = raw.trim().toUpperCase(Locale.ROOT);
        if (v.equals("APPROVE") || v.equals("APPROVED")) return Decision.APPROVE;
        if (v.equals("REJECT") || v.equals("REJECTED")) return Decision.REJECT;
        throw new IllegalArgumentException(
                "decision không hợp lệ: '" + raw + "'. Chỉ nhận APPROVE hoặc REJECT.");
    }

    /** Từ chối mà không nêu lý do là để lại một quyết định không ai truy được nguồn. */
    static void requireNoteWhenRejecting(Decision decision, String note, String what) {
        if (decision == Decision.REJECT && !ToolSupport.notBlank(note)) {
            throw new IllegalArgumentException("Từ chối " + what
                    + " thì PHẢI có note nêu lý do. Hỏi người dùng lý do rồi gọi lại.");
        }
    }

    static String verb(Decision d) { return d == Decision.APPROVE ? "Duyệt" : "Từ chối"; }

    static String suffix(String unitName, String periodName) {
        StringBuilder sb = new StringBuilder();
        if (ToolSupport.notBlank(unitName)) sb.append(" của ").append(unitName);
        if (ToolSupport.notBlank(periodName)) sb.append(", kỳ ").append(periodName);
        return sb.toString();
    }

    static String nameOr(String s) { return ToolSupport.notBlank(s) ? s : "(không rõ)"; }

    static String str(Object o) { return o == null ? "" : String.valueOf(o); }

    static String trim(double v) {
        return v == Math.rint(v) ? String.valueOf((long) v) : String.valueOf(v);
    }
}
