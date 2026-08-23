import { Children, Fragment, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Dấu xuống dòng bên trong một ô bảng, do backend đặt.
 *
 * <p>Phải khớp với `ResponseSanitizingAdvisor.CELL_LINE_BREAK`. Bảng Markdown không cho xuống dòng
 * thật trong ô, nên backend thay `<br>` bằng LINE SEPARATOR (U+2028) và chỗ này tách lại.
 */
const CELL_LINE_BREAK = '\u2028'

/** Tách phần CHỮ theo dấu xuống dòng của ô; phần tử con (in đậm, mã…) giữ nguyên. */
function withLineBreaks(children: ReactNode): ReactNode {
  return Children.map(children, (child, childIndex) => {
    if (typeof child !== 'string') return child
    if (!child.includes(CELL_LINE_BREAK)) return child

    const parts = child.split(CELL_LINE_BREAK)
    return parts.map((part, i) => (
      <Fragment key={`${childIndex}-${i}`}>
        {i > 0 && <br />}
        {part}
      </Fragment>
    ))
  })
}

/**
 * Chỗ DUY NHẤT render câu trả lời của trợ lý.
 *
 * <p>Gom về một nơi vì trước đó widget và trang mỗi bên tự khai một bộ lớp `prose` riêng, và hai bộ
 * đã lệch nhau — sửa cách hiển thị ở một màn thì màn kia không đổi.
 *
 * <p>Hai việc nó làm thêm so với `ReactMarkdown` trần:
 * <ul>
 *   <li><b>Ô bảng xuống dòng đúng.</b> Model hay nhét cả danh sách gạch đầu dòng vào một ô; không
 *       tách ra thì chúng dính thành một chuỗi chạy dài không đọc nổi.</li>
 *   <li><b>Bảng rộng thì cuộn ngang trong khung của nó</b> thay vì bị bóp cột. Ở panel hẹp, bảng
 *       hai cột từng chỉ còn ~170px mỗi cột.</li>
 * </ul>
 */
export default function AnswerMarkdown({ children }: { children: string }) {
  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none
        prose-p:leading-relaxed prose-p:my-1.5
        prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1
        prose-li:my-0.5 prose-ul:my-1.5 prose-ol:my-1.5
        prose-a:text-[var(--color-ai)] prose-a:no-underline hover:prose-a:underline
        prose-code:bg-[var(--color-ai-soft)] prose-code:rounded prose-code:px-1
        prose-code:text-[var(--color-ai)] prose-code:before:content-none prose-code:after:content-none
        prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-xl
        prose-strong:text-[var(--color-foreground)]
        prose-td:align-top"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children: tableChildren }) => (
            <div className="not-prose my-2 overflow-x-auto rounded-lg border border-[var(--color-border)]">
              <table className="w-full min-w-max border-collapse text-sm">{tableChildren}</table>
            </div>
          ),
          thead: ({ children: c }) => (
            <thead className="bg-[var(--color-ai-soft)] text-left">{c}</thead>
          ),
          th: ({ children: c }) => (
            <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-ai)] whitespace-nowrap">
              {withLineBreaks(c)}
            </th>
          ),
          td: ({ children: c }) => (
            <td className="border-t border-[var(--color-border)] px-3 py-2 align-top">
              {withLineBreaks(c)}
            </td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
