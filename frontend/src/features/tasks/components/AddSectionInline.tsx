import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2, Plus } from 'lucide-react'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { listApi } from '../api/listApi'
import { useSetTaskList } from '../hooks/useTasks'
import type { TaskListDetail } from '../types'

/**
 * "+ Thêm nhóm" ngay trong danh sách đang xem (như Lark): dòng cuối bảng ở chế độ Danh sách, cột cuối ở Kanban.
 * Bấm ⇒ ô nhập tên, Enter tạo, Esc / bỏ trống thì đóng. Chỉ hiện khi đang nhóm theo nhóm và mình là biên tập trở lên.
 */
export default function AddSectionInline({ list, variant, onCreate }: {
  list?: TaskListDetail | null
  variant: 'row' | 'column'
  /** Thay cho thêm nhóm của danh sách (vd. nhóm riêng của tôi). */
  onCreate?: (name: string) => Promise<unknown>
}) {
  const { t } = useTranslation('tasks')
  const setList = useSetTaskList()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = () => {
    const v = name.trim()
    if (!v || busy) return
    setBusy(true)
    const p = onCreate ? onCreate(v) : list ? listApi.addSection(list.id, v).then(setList) : Promise.resolve()
    p.then(() => setName(''))
      .catch((e) => toast.error(getApiErrorMessage(e)))
      .finally(() => setBusy(false))
  }

  const shell = variant === 'column'
    ? 'w-72 shrink-0 rounded-card bg-[var(--color-muted)] p-2'
    : 'border-t border-[var(--color-border)] px-2 py-1.5'

  if (!open) {
    return (
      <div className={shell}>
        <button type="button" onClick={() => setOpen(true)}
          className={cn('flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-[var(--color-subtle-foreground)] hover:bg-[var(--color-card)] hover:text-[var(--color-foreground)]',
            variant === 'row' && 'hover:bg-[var(--color-muted)]')}>
          <Plus size={15} /> {t('lists.addSection')}
        </button>
      </div>
    )
  }
  return (
    <div className={cn(shell, 'flex items-center gap-2')}>
      <Plus size={15} className="ml-2 shrink-0 text-[var(--color-subtle-foreground)]" />
      {/* Ô nhập trong dòng danh sách — ngoại lệ có chủ đích của quy ước Input (giống thêm nhanh việc). */}
      <input autoFocus value={name} maxLength={120} disabled={busy} placeholder={t('lists.sectionPlaceholder')}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); submit() }
          if (e.key === 'Escape') { setName(''); setOpen(false) }
        }}
        onBlur={() => { if (!name.trim()) setOpen(false) }}
        className="no-edit-hint min-w-0 flex-1 rounded-md bg-[var(--color-card)] px-2 py-1.5 text-sm outline-none placeholder:text-[var(--color-muted-foreground)]" />
      {busy && <Loader2 size={14} className="animate-spin text-[var(--color-subtle-foreground)]" />}
    </div>
  )
}
