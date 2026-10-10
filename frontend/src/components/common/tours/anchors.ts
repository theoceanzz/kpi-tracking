/**
 * Neo của bước hướng dẫn: `data-tour="<tên>"` thay cho `id="tour-…"`.
 *
 * `id` phải duy nhất trên trang, nên không neo được vào "ô đầu tiên của lưới" hay "thẻ đầu tiên
 * của thư viện" — thứ lặp lại theo danh sách. `data-tour` thì lặp thoải mái; bước trỏ vào nó
 * bằng `tourTarget()` và lấy phần tử ĐẦU TIÊN khớp. Tên dùng dấu chấm theo cụm:
 * `widgets.library.search`, `dashboard.toolbar`.
 *
 * Các neo `#tour-*` cũ vẫn chạy song song; chuyển dần khi viết lại từng bài.
 */
export const tourAnchor = (name: string) => ({ 'data-tour': name }) as const

/** Selector của một neo, dùng làm `target` của bước. */
export const tourTarget = (name: string) => `[data-tour="${name}"]`
