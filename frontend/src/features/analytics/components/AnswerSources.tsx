import { BookOpen, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AnswerSource } from '../api/aiApi'

/**
 * Thẻ "Nguồn" dưới câu trả lời lấy từ kho tài liệu (nhánh HELP).
 *
 * <p>Người dùng cần hai thứ mà chữ trong câu trả lời không cho: biết trợ lý dựa vào MỤC NÀO của
 * tài liệu (để tin hay không tin), và một nút mở đúng trang đang được hướng dẫn — `route` là
 * đường dẫn thật trong app, gắn vào tài liệu lúc nạp.
 */
export default function AnswerSources({ sources }: { sources: AnswerSource[] }) {
  if (!sources.length) return null
  return (
    <div className="mt-2 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-xs">
      <div className="mb-1 flex items-center gap-1.5 font-medium text-[var(--color-muted-foreground)]">
        <BookOpen className="h-3.5 w-3.5" />
        Nguồn
      </div>
      <ul className="space-y-1">
        {sources.map((s, i) => (
          <li key={`${s.title}-${i}`} className="flex items-start justify-between gap-2">
            <span className="text-[var(--color-foreground)]">
              {s.parent && <span className="text-[var(--color-muted-foreground)]">{s.parent} › </span>}
              {s.title}
            </span>
            {s.route && (
              <Link
                to={s.route}
                className="inline-flex shrink-0 items-center gap-1 text-[var(--color-ai)] hover:underline"
              >
                Mở trang <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
