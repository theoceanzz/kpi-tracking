import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { mySectionApi } from '../api/listApi'
import { taskKeys, useMySections } from '../hooks/useTasks'

/**
 * Menu "…" của một nhóm riêng trong "Việc của tôi": đổi tên, lên / xuống, xoá (việc trong nhóm về "Chưa xếp nhóm").
 * Chỉ ảnh hưởng chính mình.
 */
export default function MySectionMenu({ sectionId, name }: { sectionId: string; name: string }) {
  const { t } = useTranslation('tasks')
  const qc = useQueryClient()
  const { data: sections = [] } = useMySections()
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const sorted = [...sections].sort((a, b) => a.sortOrder - b.sortOrder)
  const idx = sorted.findIndex((s) => s.id === sectionId)
  const refresh = () => { qc.invalidateQueries({ queryKey: taskKeys.mySections }); qc.invalidateQueries({ queryKey: taskKeys.all }) }
  const run = (p: Promise<unknown>) => p.then(refresh).catch((e) => toast.error(getApiErrorMessage(e)))
  const move = (dir: -1 | 1) => {
    const j = idx + dir
    const b = sorted[j]
    if (!b) return
    const beyond = sorted[j + dir]
    void run(mySectionApi.update(sectionId, { sortOrder: beyond ? (b.sortOrder + beyond.sortOrder) / 2 : b.sortOrder + dir }))
    setOpen(false)
  }
  const item = 'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm font-normal hover:bg-[var(--color-muted)] disabled:opacity-40 disabled:hover:bg-transparent'
  return (
    <>
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setRenaming(null) }}>
        <PopoverTrigger asChild>
          <span role="button" tabIndex={0} aria-label={t('menu.more')}
            className="flex rounded p-0.5 text-[var(--color-subtle-foreground)] hover:bg-[var(--color-border)] hover:text-[var(--color-foreground)]">
            <MoreHorizontal size={15} />
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-1" align="end">
          {renaming != null ? (
            <div className="p-1">
              {/* Ô sửa tên nhóm trong menu — ngoại lệ có chủ đích của quy ước Input. */}
              <input autoFocus value={renaming} maxLength={120} onChange={(e) => setRenaming(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && renaming.trim()) { void run(mySectionApi.update(sectionId, { name: renaming.trim() })); setOpen(false); setRenaming(null) }
                  if (e.key === 'Escape') setRenaming(null)
                }}
                className="no-edit-hint w-full rounded border border-[var(--color-ring)] bg-[var(--color-card)] px-2 py-1 text-sm outline-none" />
            </div>
          ) : (
            <>
              <button type="button" className={item} onClick={() => setRenaming(name)}><Pencil size={14} /> {t('kanban.rename')}</button>
              <button type="button" className={item} disabled={idx <= 0} onClick={() => move(-1)}><ArrowUp size={14} /> {t('lists.moveUp')}</button>
              <button type="button" className={item} disabled={idx < 0 || idx >= sorted.length - 1} onClick={() => move(1)}><ArrowDown size={14} /> {t('lists.moveDown')}</button>
              <button type="button" className={cn(item, 'text-[var(--color-error)]')} onClick={() => { setOpen(false); setConfirmDelete(true) }}>
                <Trash2 size={14} /> {t('lists.deleteSection')}
              </button>
            </>
          )}
        </PopoverContent>
      </Popover>
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title={t('lists.deleteSection')}
        description={t('mySections.deleteHint')} confirmLabel={t('lists.deleteSection')}
        onConfirm={() => { setConfirmDelete(false); void run(mySectionApi.remove(sectionId)) }} />
    </>
  )
}
