import { useMemo, useState } from 'react'
import { ChevronRight, LayoutGrid, Users, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FollowupPools } from '../api/aiApi'

type Pool = 'all' | 'technical' | 'management'

const POOLS: { id: Pool; label: string; icon?: typeof Wrench }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'technical', label: 'Kỹ thuật', icon: Wrench },
  { id: 'management', label: 'Quản trị', icon: Users },
]

/** Lấy 3 câu trong nhóm. Xáo trộn theo hạt giống để cùng một nhóm luôn ra cùng bộ câu. */
function pick3(arr: string[], seed: number): string[] {
  const copy = [...arr]
  const out: string[] = []
  let s = seed
  while (out.length < 3 && copy.length) {
    // Bộ sinh số giả ngẫu nhiên nhỏ: đủ để trộn, mà KHÔNG đổi kết quả giữa hai lần render —
    // Math.random() ở đây sẽ khiến câu hỏi nhảy loạn mỗi lần component vẽ lại.
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const [picked] = copy.splice(s % copy.length, 1)
    if (picked) out.push(picked)
  }
  return out
}

/** Hạt giống ổn định theo nội dung nhóm, để đổi lượt thì đổi bộ câu, còn vẽ lại thì không. */
function seedOf(pools: FollowupPools): number {
  const text = [...(pools.technical ?? []), ...(pools.management ?? [])].join('|')
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) & 0x7fffffff
  return h || 1
}

interface Props {
  pools: FollowupPools
  onSelectQuestion: (question: string) => void
  selectedQuestion?: string
  onShowInsights: () => void
}

/**
 * Gợi ý câu hỏi tiếp theo, đặt dưới câu trả lời.
 *
 * <p><b>Bộ lọc nằm TRÊN danh sách</b> — bản trước để nó ở dưới, tức người đọc xem hết câu hỏi rồi
 * mới phát hiện ra có thể lọc. Và có nút "Tất cả": bản trước khởi tạo ở trạng thái tất cả nhưng
 * không có nút nào quay lại được, chọn "Kỹ thuật" một lần là kẹt luôn.
 *
 * <p><b>Dòng nhẹ, không phải thẻ.</b> Thẻ có viền + đổ bóng làm khối gợi ý nặng hơn chính câu trả
 * lời nó đi kèm, và lệch với bố cục tài liệu của khu vực AI.
 */
export default function FollowupSuggestions({
  pools, onSelectQuestion, selectedQuestion, onShowInsights,
}: Props) {
  const [pool, setPool] = useState<Pool>('all')

  // Tính bằng useMemo chứ không phải useEffect + setState: bản trước gọi setState ngay trong effect
  // nên mỗi lượt gợi ý mới tốn thêm một vòng render, và eslint react-hooks bắt lỗi đúng chỗ đó.
  const shown = useMemo(() => {
    const source =
      pool === 'technical' ? pools.technical
      : pool === 'management' ? pools.management
      : [...(pools.technical ?? []), ...(pools.management ?? [])]
    return pick3(source ?? [], seedOf(pools) + pool.length)
  }, [pools, pool])

  if (!shown.length) return null

  return (
    <div className="mt-3 border-t border-[var(--color-ai-line)]/30 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ai)]">
          Hỏi tiếp
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {POOLS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPool(id)}
              aria-pressed={pool === id}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition-colors cursor-pointer',
                pool === id
                  ? 'bg-[var(--color-ai-soft)] text-[var(--color-ai)] font-medium'
                  : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-ai)]',
              )}
            >
              {Icon && <Icon size={11} />}
              {label}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-1">
        {shown.map((q, i) => {
          const isSelected = selectedQuestion === q
          return (
            <li key={`${q}-${i}`}>
              <button
                type="button"
                onClick={() => onSelectQuestion(q)}
                className={cn(
                  'group flex w-full items-start gap-1.5 py-1.5 text-left text-[13px] leading-snug transition-colors cursor-pointer',
                  i > 0 && 'border-t border-[var(--color-border)]',
                  isSelected
                    ? 'text-[var(--color-ai)] font-medium'
                    : 'text-[var(--color-foreground)] hover:text-[var(--color-ai)]',
                )}
              >
                <ChevronRight
                  size={13}
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 shrink-0 transition-transform group-hover:translate-x-0.5',
                    isSelected ? 'text-[var(--color-ai)]' : 'text-[var(--color-ai-line)]',
                  )}
                />
                <span>{q}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        onClick={onShowInsights}
        className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--color-muted-foreground)] hover:text-[var(--color-ai)] transition-colors cursor-pointer"
      >
        <LayoutGrid size={12} aria-hidden="true" />
        Xem insights khác
      </button>
    </div>
  )
}
