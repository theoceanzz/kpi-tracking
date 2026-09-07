/**
 * Đổi HTML của UrBox thành văn bản thuần.
 *
 * <p>UrBox trả mô tả và điều kiện sử dụng dưới dạng HTML do merchant tự soạn — có cả
 * thẻ Facebook, style inline và ảnh emoji. Đây là nội dung của BÊN THỨ BA: nhét thẳng
 * vào `dangerouslySetInnerHTML` là mở một cửa XSS mà dự án chưa có thư viện làm sạch nào
 * để đóng lại. Bỏ hết thẻ rồi hiển thị như văn bản vừa an toàn tuyệt đối, vừa đọc dễ hơn
 * bản gốc.
 *
 * <p>Giữ lại xuống dòng ở những thẻ ngắt đoạn, nếu không cả danh sách điều kiện sẽ dính
 * thành một khối chữ không ai đọc nổi.
 */
export function htmlToText(html?: string | null): string {
  if (!html) return ''

  return html
    // Bỏ hẳn nội dung script/style trước khi bóc thẻ — bóc thẻ trước sẽ để lộ mã nguồn
    // của chúng ra thành chữ.
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n')
}

/** Rút gọn cho phần xem trước trên thẻ quà. */
export function htmlToSnippet(html: string | null | undefined, max = 160): string {
  const text = htmlToText(html).replace(/\n/g, ' · ')
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}
