import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Library, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button, type ButtonProps } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDateTime } from '@/i18n/format'
import { documentFileUrl } from '../api/documentApi'
import { useDocuments } from '../hooks/useDocuments'
import type { KbDocument } from '../types'
import { formatBytes } from '../utils'
import { FileTypeIcon } from './docUi'
import { locationLabel } from './docMenu'

function extOf(name: string | null): string {
  const n = (name ?? '').toLowerCase()
  return n.includes('.') ? n.slice(n.lastIndexOf('.') + 1) : ''
}

/** Tải tệp của tài liệu về trình duyệt thành `File` — đưa vào luồng tải lên sẵn có (bài nộp, minh chứng…). */
async function toFile(d: KbDocument): Promise<File> {
  const r = await fetch(documentFileUrl(d.id), { credentials: 'include' })
  if (!r.ok) throw new Error(String(r.status))
  const blob = await r.blob()
  return new File([blob], d.fileName ?? d.title, { type: d.contentType ?? blob.type })
}

interface PickerProps {
  open: boolean
  onClose: () => void
  onPicked: (files: File[]) => void
  /** Đuôi tệp nơi nhận chấp nhận (vd. `['pdf','docx']`). Không truyền = nhận mọi loại. */
  accept?: string[]
  /** Số tệp còn được thêm. */
  max?: number
}

/**
 * Chọn tài liệu trong thư viện để dùng làm tệp đính kèm (docs/DOCUMENTS_DESIGN.md §16.6). Chỉ liệt kê tài liệu người
 * dùng XEM được (cùng bộ lọc quyền của trang Tài liệu). Tệp được SAO CHÉP vào nơi nhận qua đúng luồng tải lên của nơi
 * đó — nơi nhận vẫn tự kiểm loại / dung lượng / số lượng như tệp chọn từ máy, và tệp đính kèm không mất khi tài liệu
 * gốc bị xoá sau này.
 */
export default function DocumentPickerDialog({ open, onClose, onPicked, accept, max = 5 }: PickerProps) {
  const { t } = useTranslation('documents')
  const [q, setQ] = useState('')
  const debounced = useDebounce(q.trim(), 300)
  const [selected, setSelected] = useState<Map<string, KbDocument>>(new Map())
  const [busy, setBusy] = useState(false)
  const { data, isLoading } = useDocuments({ q: debounced || undefined, page: 0, size: 30 }, open)
  const docs = data?.content ?? []

  const allowed = (d: KbDocument) => !accept || accept.includes(extOf(d.fileName))
  const toggle = (d: KbDocument) => setSelected(prev => {
    const next = new Map(prev)
    if (next.has(d.id)) next.delete(d.id)
    else if (next.size < max) next.set(d.id, d)
    else toast.error(t('picker.tooMany', { max }))
    return next
  })

  const confirm = async () => {
    setBusy(true)
    try {
      const files = await Promise.all([...selected.values()].map(toFile))
      onPicked(files)
      setSelected(new Map())
      onClose()
    } catch {
      toast.error(t('picker.loadFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      dismissible={!busy}
      title={t('picker.title')}
      description={accept ? t('picker.descriptionTypes', { types: accept.map(e => '.' + e).join(', '), max }) : t('picker.description', { max })}
      footer={
        <DialogFooter
          note={selected.size > 0 ? t('picker.selected', { count: selected.size }) : undefined}
          secondary={<Button variant="outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>}
          primary={
            <Button onClick={confirm} disabled={selected.size === 0 || busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              {t('picker.attach', { count: selected.size })}
            </Button>
          }
        />
      }
    >
      <Input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('filters.search')}
             aria-label={t('filters.search')} prefix={<Search aria-hidden="true" />} className="mb-3" />
      {isLoading ? (
        <LoadingSkeleton type="table" rows={5} />
      ) : docs.length === 0 ? (
        <EmptyState icon={Library} title={debounced ? t('empty.filteredTitle') : t('picker.emptyTitle')}
                    description={debounced ? t('empty.filteredDescription') : t('picker.emptyDescription')} />
      ) : (
        <ul className="divide-y divide-[var(--color-border)] rounded-card border border-[var(--color-border)]">
          {docs.map(d => {
            const ok = allowed(d)
            const checked = selected.has(d.id)
            return (
              <li key={d.id}>
                <label className={ok ? 'flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-[var(--color-muted)]' : 'flex cursor-not-allowed items-center gap-3 px-3 py-2.5 opacity-50'}>
                  <Checkbox checked={checked} disabled={!ok || busy} onCheckedChange={() => toggle(d)} aria-label={d.title} />
                  <FileTypeIcon doc={d} size={16} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--color-foreground)]">{d.title}</span>
                    <span className="block truncate text-caption">
                      {ok
                        ? `${d.fileName ?? ''} · ${formatBytes(d.fileSize)} · ${locationLabel(d, t)} · ${formatDateTime(d.updatedAt)}`
                        : t('picker.typeNotAccepted', { name: d.fileName ?? '' })}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </Dialog>
  )
}

/** Nút "Chọn từ Tài liệu" kèm hộp chọn — đặt cạnh nút tải tệp từ máy ở mọi chỗ có đính kèm. */
export function PickFromLibraryButton({ onPicked, accept, max, disabled, variant = 'outline', size = 'sm', className, iconOnly }: {
  onPicked: (files: File[]) => void
  accept?: string[]
  max?: number
  disabled?: boolean
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
  className?: string
  /** Chỉ hiện biểu tượng (ô nhập chat). */
  iconOnly?: boolean
}) {
  const { t } = useTranslation('documents')
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant={variant} size={size} className={className} disabled={disabled || (max ?? 1) <= 0}
              onClick={e => { e.stopPropagation(); setOpen(true) }}
              title={t('picker.button')} aria-label={iconOnly ? t('picker.button') : undefined}>
        <Library aria-hidden="true" />{!iconOnly && <> {t('picker.button')}</>}
      </Button>
      {open && <DocumentPickerDialog open onClose={() => setOpen(false)} onPicked={onPicked} accept={accept} max={max} />}
    </>
  )
}
