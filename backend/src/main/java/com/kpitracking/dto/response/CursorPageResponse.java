package com.kpitracking.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * Trang dữ liệu theo con trỏ (keyset pagination) — thay cho {@link PageResponse} ở các bảng ghi
 * liên tục (thông báo, lịch sử giao dịch...). Không có {@code totalElements}: đếm toàn bộ bảng
 * mỗi lần lật trang là câu tốn kém nhất của OFFSET pagination và UI "tải thêm" không cần nó.
 *
 * <p>Client gửi lại {@code nextCursor} của trang trước để lấy trang kế; {@code null} = hết.
 * Con trỏ là chuỗi mờ (opaque) — client không tự dựng. Xem docs/DATABASE_SCALING.md H1.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CursorPageResponse<T> {

    private List<T> content;
    private int size;
    /** Con trỏ để lấy trang tiếp theo; null khi không còn dữ liệu. */
    private String nextCursor;
    private boolean hasMore;
}
