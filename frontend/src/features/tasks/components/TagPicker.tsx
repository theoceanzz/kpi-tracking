import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Check, Plus, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getApiErrorMessage } from '@/lib/apiError'
import { tagApi } from '../api/listApi'
import { taskKeys, useTaskTags } from '../hooks/useTasks'
import { TagChip } from './TaskBits'
import { TAG_COLORS } from '../taskUtils'

/**
 * Chọn nhãn của tổ chức; gõ tên chưa có ⇒ tạo nhãn mới ngay. `lark`: chưa có nhãn ⇒ chữ xám "Thêm nhãn" (dòng thuộc tính
 * kiểu Lark), có nhãn ⇒ chip + nút "+" nhỏ; mặc định chip viền đứt "+ Nhãn" (form tạo việc, thanh hàng loạt).
 */
export default function TagPicker({ value, onChange, disabled, variant = 'chips' }: {
  value: string[]; onChange: (ids: string[]) => void; disabled?: boolean; variant?: 'chips' | 'lark'
}) {
  const { t } = useTranslation('tasks')
  const qc = useQueryClient()
  const { data: tags = [] } = useTaskTags()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const selected = tags.filter((g) => value.includes(g.id))
  const k = q.trim().toLowerCase()
  const filtered = tags.filter((g) => !k || g.name.toLowerCase().includes(k))
  const exact = tags.some((g) => g.name.toLowerCase() === k)

  const create = () => {
    const name = q.trim()
    if (!name) return
    tagApi.create(name, TAG_COLORS[tags.length % TAG_COLORS.length]).then((g) => {
      qc.invalidateQueries({ queryKey: taskKeys.tags })
      onChange([...value, g.id])
      setQ('')
    }).catch((e) => toast.error(getApiErrorMessage(e)))
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selected.map((g) => <TagChip key={g.id} tag={g} onRemove={disabled ? undefined : () => onChange(value.filter((x) => x !== g.id))} />)}
      {!disabled && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            {variant === 'lark' ? (
              <button type="button" aria-label={t('tags.add')}
                className="rounded-md px-1.5 py-1 text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]">
                {selected.length ? <Plus size={14} /> : t('tags.addLark')}
              </button>
            ) : (
              <button type="button" aria-label={t('tags.add')}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--color-border-strong)] px-2 py-0.5 text-xs text-[var(--color-subtle-foreground)] hover:text-[var(--color-foreground)]">
                <Plus size={12} /> {t('tags.add')}
              </button>
            )}
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <Input size="sm" value={q} autoFocus onChange={(e) => setQ(e.target.value)} prefix={<Search size={13} />} placeholder={t('tags.search')}
              onKeyDown={(e) => { if (e.key === 'Enter' && !exact && q.trim()) { e.preventDefault(); create() } }} />
            <div className="mt-2 max-h-60 overflow-y-auto">
              {filtered.map((g) => {
                const on = value.includes(g.id)
                return (
                  <button key={g.id} type="button" onClick={() => onChange(on ? value.filter((x) => x !== g.id) : [...value, g.id])}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-[var(--color-muted)]">
                    <TagChip tag={g} /> <span className="flex-1" /> {on && <Check size={14} className="text-[var(--color-primary)]" />}
                  </button>
                )
              })}
              {q.trim() && !exact && (
                <button type="button" onClick={create} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--color-muted)]">
                  <Plus size={13} /> {t('tags.create', { name: q.trim() })}
                </button>
              )}
              {tags.length === 0 && !q && <p className="p-2 text-xs text-[var(--color-subtle-foreground)]">{t('tags.none')}</p>}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
