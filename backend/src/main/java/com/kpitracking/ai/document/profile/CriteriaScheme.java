package com.kpitracking.ai.document.profile;

import java.util.List;
import java.util.Optional;

/**
 * Bộ nhóm của bộ tiêu chí bóc từ một loại tài liệu — do chính loại tài liệu khai báo
 * ({@link DocumentProfile#criteriaScheme()}).
 *
 * <p>Mỗi dòng có hai thuộc tính: <b>vai trò</b> (cố định, quyết định AI dùng dòng đó thế nào khi chấm) và
 * <b>chủ đề</b> (tự do, lấy từ chính tài liệu — tài liệu ít mảng nội dung ra ít chủ đề, nhiều ra nhiều).
 *
 * @param roles       vai trò loại tài liệu này được dùng, theo thứ tự hiển thị
 * @param topicSource chủ đề của dòng lấy từ đâu
 */
public record CriteriaScheme(List<Role> roles, TopicSource topicSource) {

    /**
     * @param scoring  dùng trực tiếp để chấm (căn cứ, thang mức) — hiện riêng khối "Dùng để chấm"
     * @param inPrompt đưa vào prompt khi AI chấm bài nộp ({@code TRA_CUU} thì không — tra qua kho tri thức)
     */
    public record Role(String code, String label, String hint, boolean scoring, boolean inPrompt, String itemsLabel) {}

    public enum TopicSource {
        /** Tên chương khi tài liệu có chương, không thì nhãn mô hình đặt cho mục. */
        CHAPTER_OR_MODEL,
        /** Tên trang tính (bảng KPI). */
        SHEET,
        /** Tiêu đề mục (mô tả công việc: tên vị trí / bộ phận). */
        SECTION_TITLE,
        NONE
    }

    public static final Role TIEU_CHI = new Role("TIEU_CHI", "Căn cứ chấm",
            "Những gì quản lý dựa vào để chấm kết quả công việc. AI dùng nhóm này để đánh giá chất lượng bài nộp.",
            true, true, "Các mức, mỗi dòng một mức");
    public static final Role THANG_MUC = new Role("THANG_MUC", "Thang mức",
            "Các mức xếp loại kết quả công việc (vd Hoàn thành, Xuất sắc…). AI dùng để chọn mức chất lượng.",
            true, true, "Các mức, mỗi dòng một mức");
    public static final Role THAM_KHAO = new Role("THAM_KHAO", "AI đọc khi chấm",
            "Quy định ảnh hưởng tới việc đánh giá (lập kế hoạch, minh chứng, hệ quả…). AI đọc để lưu ý, không chấm theo.",
            false, true, "Các ý, mỗi dòng một ý");
    public static final Role TRA_CUU = new Role("TRA_CUU", "Chỉ tra cứu",
            "Nội dung khác của tài liệu (nhiệm vụ bộ phận, thưởng, tổ chức…). Không vào lời nhắc chấm; AI tra khi cần qua kho tri thức.",
            false, false, "Các ý, mỗi dòng một ý");

    public static final List<Role> ALL_ROLES = List.of(TIEU_CHI, THANG_MUC, THAM_KHAO, TRA_CUU);

    public static final CriteriaScheme NONE = new CriteriaScheme(List.of(), TopicSource.NONE);

    public boolean isEmpty() {
        return roles.isEmpty();
    }

    public boolean allows(String code) {
        return role(code).isPresent();
    }

    public Optional<Role> role(String code) {
        return roles.stream().filter(r -> r.code().equals(code)).findFirst();
    }

    /** Vai trò không-chấm cuối danh sách — nơi hạ những dòng mô hình xếp nhầm vai trò không được dùng. */
    public String fallbackRole() {
        for (int i = roles.size() - 1; i >= 0; i--) {
            if (!roles.get(i).scoring()) return roles.get(i).code();
        }
        return roles.isEmpty() ? TRA_CUU.code() : roles.get(roles.size() - 1).code();
    }

    /** Mọi vai trò đã biết (kể cả không thuộc scheme này) — để đọc dòng cũ. */
    public static Optional<Role> known(String code) {
        return ALL_ROLES.stream().filter(r -> r.code().equals(code)).findFirst();
    }
}
