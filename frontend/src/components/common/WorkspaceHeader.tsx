import { useEffect, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkspaceTabs } from './WorkspaceTabs'

export interface WorkspaceStat {
  label: string
  value: ReactNode
  icon?: LucideIcon
}

export interface WorkspaceHeaderProps {
  /** Chỉ dùng khi trang KHÔNG có tab cấp 2 — có tab thì chính tab đang mở là tiêu đề. */
  title?: string
  description?: string
  stats?: WorkspaceStat[]
  actions?: ReactNode
  /** Neo cho tour hướng dẫn (vd `tour-periods-header`). */
  id?: string
  className?: string
  /** Nội dung phụ xếp dưới thân card, trong cùng khung viền. */
  children?: ReactNode
}

/**
 * Khối mở đầu chuẩn của mọi màn trong nhóm "Thiết lập công cụ": hàng tab cấp 2 nằm
 * ngay trên mặt card, rồi tới mô tả, số liệu và nút hành động.
 *
 * Tab cấp 2 cố ý KHÔNG dùng khối pill nền xám như trước. Pill có nền riêng, chữ
 * `uppercase font-black` và padding rộng nên đọc nặng hơn cả hàng tab cấp 1 ở trên nó
 * — phân cấp bị lộn ngược. Ở đây tab cấp 2 nhỏ hơn cấp 1 một bậc và nằm trong viền
 * card, nên quan hệ "tab này điều khiển card này" thấy được ngay mà không cần thêm màu
 * hay khối nào.
 *
 * Tiêu đề lớn cũng bỏ: breadcrumb trên header và tab đang sáng đã nói đúng chỗ đứng,
 * lặp lại lần thứ ba bằng chữ 4xl chỉ tốn chiều cao.
 */
export default function WorkspaceHeader({
  title,
  description,
  stats,
  actions,
  id,
  className,
  children,
}: WorkspaceHeaderProps) {
  const ctx = useWorkspaceTabs()
  const claim = ctx?.claim
  const publishSlot = ctx?.setActionSlot

  useEffect(() => claim?.(), [claim])

  // Chỗ đáp cho nút mà tab con gửi lên. Giữ node ở state cục bộ rồi mới công bố lên
  // context trong effect, thay vì đưa thẳng setter của context vào `ref` — làm vậy
  // là ghi vào state của component khác ngay giữa lượt render.
  const [slotEl, setSlotEl] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!publishSlot) return
    publishSlot(slotEl)
    return () => publishSlot(null)
  }, [publishSlot, slotEl])

  const tabs = ctx?.tabs ?? []
  const showTabs = tabs.length > 1
  // Trong phạm vi provider thì luôn dựng thân card: tab con có thể gửi nút lên qua
  // `WorkspaceHeaderActions`, mà lúc render này chưa biết nó có gửi hay không.
  const hasBody = Boolean(ctx || title || description || stats?.length || actions || children)

  if (!showTabs && !hasBody) return null

  return (
    <section
      // Neo mặc định cho hướng dẫn. Mọi mục trong "Thiết lập công cụ" đều mở đầu bằng
      // khối này, nên có một id ổn định ở đây là mỗi mục tự có điểm bám mà không phải
      // sửa từng file. Trang nào cần neo riêng thì truyền `id` như cũ và ghi đè.
      id={id ?? 'tour-workspace-card'}
      className={cn(
        'rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm overflow-hidden',
        className
      )}
    >
      {showTabs && (
        <nav
          id="tour-workspace-tabs"
          aria-label="Mục con"
          className="flex items-stretch px-2 border-b border-[var(--color-border)] overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map(tab => {
            const Icon = tab.icon
            const isActive = tab.key === ctx?.activeTab
            return (
              <button
                key={tab.key}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => ctx?.setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2.5 text-[13px] font-semibold border-b-2 -mb-px whitespace-nowrap shrink-0 transition-colors cursor-pointer',
                  isActive
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
                )}
              >
                <Icon size={15} className={cn('shrink-0', isActive ? 'opacity-100' : 'opacity-60')} />
                {tab.label}
                {!!tab.badge && (
                  <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      )}

      {hasBody && (
        <div className="p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {(title || description) && (
              <div className="min-w-0">
                {title && (
                  <h1 className="text-xl font-bold tracking-tight text-[var(--color-foreground)]">{title}</h1>
                )}
                {description && (
                  <p
                    className={cn(
                      'text-sm text-[var(--color-muted-foreground)] leading-relaxed max-w-2xl',
                      title && 'mt-1'
                    )}
                  >
                    {description}
                  </p>
                )}
              </div>
            )}

            {(ctx || stats?.length || actions) && (
              <div className="flex flex-wrap items-center gap-3 lg:ml-auto lg:justify-end">
                {!!stats?.length && (
                  <dl id="tour-workspace-stats" className="flex items-stretch divide-x divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/40">
                    {stats.map(stat => {
                      const Icon = stat.icon
                      return (
                        <div key={stat.label} className="px-4 py-2 text-center">
                          <dd className="flex items-center justify-center gap-1.5 text-lg font-bold tabular-nums text-[var(--color-foreground)]">
                            {Icon && <Icon size={15} className="text-[var(--color-primary)]" />}
                            {stat.value}
                          </dd>
                          <dt className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted-foreground)] whitespace-nowrap">
                            {stat.label}
                          </dt>
                        </div>
                      )
                    })}
                  </dl>
                )}
                {actions}
                {/* Nút do tab con gửi lên qua `WorkspaceHeaderActions` đáp xuống đây.
                    `:empty` để không sinh khoảng hở khi tab đó không gửi gì. */}
                {ctx && (
                  <div ref={setSlotEl} className="flex flex-wrap items-center gap-3 empty:hidden" />
                )}
              </div>
            )}
          </div>

          {children}
        </div>
      )}
    </section>
  )
}
