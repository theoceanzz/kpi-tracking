import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Pin, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import UserAvatar from '@/components/common/UserAvatar'
import { cn } from '@/lib/utils'
import type { KbDocument } from '../types'
import { formatBytes, larkTime } from '../utils'
import { AiStatusIcon, FileTypeIcon } from './docUi'
import { useDocumentActions } from './DocumentActions'
import RowMenu from '@/components/common/RowMenu'
import { locationLabel, useDocMenu } from './docMenu'

export type DocColumn = 'location' | 'owner' | 'createdAt' | 'openedAt' | 'updatedAt' | 'size' | 'ai'

/** Bề ngang cố định của từng cột; cột Tên lấy phần còn lại và cắt "…" — bảng vừa khung, không cuộn ngang. */
const COL_WIDTH: Record<DocColumn, string> = {
  location: 'w-[17%]', owner: 'w-[140px]', createdAt: 'w-[136px]', openedAt: 'w-[136px]', updatedAt: 'w-[136px]', size: 'w-[90px]', ai: 'w-[56px]',
}
/** Màn hẹp (dưới md) chỉ giữ Tên + thời gian mở / sửa + ⋯, như bản di động của Lark. */
const hideOnNarrow = (c: DocColumn) => (c === 'openedAt' || c === 'updatedAt' ? '' : 'hidden md:table-cell')
export type DocLayout = 'list' | 'grid'

interface Props {
  docs: KbDocument[]
  columns: DocColumn[]
  layout: DocLayout
  /** Cho chọn nhiều (ô tích hiện khi rê chuột, thanh thao tác dưới đáy) — Drive, như Lark. */
  selectable?: boolean
}

/**
 * Danh sách tài liệu kiểu Lark Docs (docs/DOCUMENTS_LARK_REFERENCE.md §2, §4): bảng tiêu đề chữ thường, mỗi dòng icon
 * loại + tên + nhãn nhỏ sau tên, người tạo có avatar, thời gian "16:59 Hôm nay", menu ⋯ cuối dòng; hoặc lưới thẻ. Bấm
 * dòng/thẻ mở tài liệu. Mục nào trong menu hiện là theo `canEdit` backend trả.
 */
export default function DocumentList({ docs, columns, layout, selectable }: Props) {
  const { t } = useTranslation('documents')
  const actions = useDocumentActions()
  const menuFor = useDocMenu()
  const [picked, setPicked] = useState<Set<string>>(new Set())
  // Chỉ giữ lựa chọn của tài liệu còn trên màn (đổi trang / xoá xong thì tự rơi ra).
  const selected = useMemo(() => docs.filter(d => picked.has(d.id)), [docs, picked])
  const selecting = selectable && selected.length > 0
  const toggle = (id: string) => setPicked(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const allPicked = docs.length > 0 && selected.length === docs.length

  if (layout === 'grid') {
    return (
      <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {docs.map(d => (
          <div key={d.id} role="button" tabIndex={0} onClick={() => actions.open(d)}
               onKeyDown={e => { if (e.key === 'Enter') actions.open(d) }}
               className="group flex cursor-pointer flex-col rounded-card border border-[var(--color-border)] bg-[var(--color-card)] transition-colors hover:border-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]">
            <div className="flex h-28 items-center justify-center rounded-t-card bg-[var(--color-muted)]">
              <FileTypeIcon doc={d} size={30} />
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5">
              <FileTypeIcon doc={d} size={12} />
              <p className="flex min-w-0 flex-1 items-center gap-1 text-sm text-[var(--color-foreground)]" title={d.title}>
                <span className="truncate">{d.title}</span>
                {d.pinned && <Pin size={12} className="shrink-0 fill-[var(--color-success)] text-[var(--color-success)]" aria-label={t('badge.pinned')} />}
              </p>
              <RowMenu items={menuFor(d)} label={t('actions.more')} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const labels = { today: t('time.today'), yesterday: t('time.yesterday') }
  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-sm md:min-w-[640px]">
          <thead>
            <tr className="group/head border-b border-[var(--color-border)] text-left text-[13px] text-[var(--color-muted-foreground)]">
              {selectable && (
                <th scope="col" className="w-9 py-2 pl-3">
                  <Checkbox checked={allPicked}
                            className={cn(!selecting && 'opacity-0 focus-visible:opacity-100 group-hover/head:opacity-100')}
                            onCheckedChange={() => setPicked(allPicked ? new Set() : new Set(docs.map(d => d.id)))}
                            aria-label={t('select.all')} />
                </th>
              )}
              <th scope="col" className={cn('py-2 font-normal', selectable ? 'pl-1 pr-3' : 'px-4')}>{t('table.name')}</th>
              {columns.map(c => (
                <th key={c} scope="col" className={cn('truncate px-3 py-2 font-normal whitespace-nowrap', COL_WIDTH[c], hideOnNarrow(c), c === 'size' && 'text-right', c === 'ai' && 'text-center')}>
                  {t(`table.${c}`)}
                </th>
              ))}
              <th scope="col" className="w-12 px-3 py-2"><span className="sr-only">{t('table.actions')}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {docs.map(d => {
              const on = picked.has(d.id)
              return (
                <tr key={d.id} onClick={() => (selecting ? toggle(d.id) : actions.open(d))}
                    className={cn('group cursor-pointer transition-colors', on ? 'bg-[var(--color-primary-soft)]' : 'hover:bg-[var(--color-muted)]')}>
                  {selectable && (
                    <td className="py-2.5 pl-3" onClick={e => { e.stopPropagation(); toggle(d.id) }}>
                      <Checkbox checked={on} className={cn(!selecting && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')}
                                onCheckedChange={() => toggle(d.id)} onClick={e => e.stopPropagation()}
                                aria-label={t('select.one', { title: d.title })} />
                    </td>
                  )}
                  <td className={cn('py-2.5', selectable ? 'pl-1 pr-3' : 'px-4')}>
                    <div className="flex min-w-0 items-center gap-3">
                      <FileTypeIcon doc={d} size={15} />
                      <p className="flex min-w-0 items-center gap-1.5 text-[var(--color-foreground)]" title={d.title}>
                        <span className="truncate">{d.title}</span>
                        <DocBadges doc={d} t={t} />
                      </p>
                    </div>
                  </td>
                  {columns.map(c => <DocCell key={c} column={c} doc={d} t={t} labels={labels} className={hideOnNarrow(c)} />)}
                  <td className="px-3 py-1.5 text-right" onClick={e => e.stopPropagation()}>
                    <RowMenu items={menuFor(d)} label={t('actions.more')} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selecting && (
        // Thanh dưới đáy như Lark (Move To · Delete); chỉ thao tác trên tài liệu mình quản lý được.
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5">
          <span className="mr-1 text-sm font-medium text-[var(--color-foreground)]">{t('select.count', { count: selected.length })}</span>
          {selected.every(d => d.canEdit && !d.legacy) && (
            <Button variant="outline" size="sm" onClick={() => actions.moveMany(selected)}>{t('actions.moveTo')}</Button>
          )}
          {selected.every(d => d.canEdit) && (
            <Button variant="outline" size="sm" className="border-[var(--color-error-border)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)]"
                    onClick={() => actions.removeMany(selected)}>
              {t('actions.delete')}
            </Button>
          )}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setPicked(new Set())}>
            <X aria-hidden="true" /> {t('select.clear')}
          </Button>
        </div>
      )}
    </div>
  )
}

/** Nhãn nhỏ ngay sau tên (như "External" / icon ghim của Lark) — chỉ những trạng thái người xem cần biết. */
function DocBadges({ doc: d, t }: { doc: KbDocument; t: TFunction<'documents'> }) {
  return (
    <>
      {d.pinned && <Pin size={12} className="shrink-0 fill-[var(--color-success)] text-[var(--color-success)]" aria-label={t('badge.pinned')} />}
      {d.legacy && <Badge variant="warning" className="shrink-0">{t('badge.noOriginal')}</Badge>}
      {d.inherited && <Badge variant="info" className="shrink-0">{t('badge.inherited', { unit: d.orgUnitName ?? '' })}</Badge>}
      {d.orphan && <Badge variant="destructive" className="shrink-0">{t('badge.orphan')}</Badge>}
      {d.expired
        ? <Badge variant="destructive" className="shrink-0">{t('badge.expired')}</Badge>
        : d.reviewDue && <Badge variant="warning" className="shrink-0">{t('badge.reviewDue')}</Badge>}
    </>
  )
}

function DocCell({ column, doc: d, t, labels, className }: {
  column: DocColumn; doc: KbDocument; t: TFunction<'documents'>; labels: { today: string; yesterday: string }; className?: string
}) {
  const muted = cn('px-3 py-2.5 text-[var(--color-muted-foreground)]', className)
  switch (column) {
    case 'location':
      return <td className={muted}><span className="block truncate" title={locationLabel(d, t)}>{locationLabel(d, t)}</span></td>
    case 'owner':
      return (
        <td className={muted}>
          <span className="flex min-w-0 items-center gap-1.5">
            <UserAvatar fullName={d.createdByName ?? ''} className="h-5 w-5 rounded-full text-[9px]"
                        fallbackClassName="bg-[var(--color-primary)] font-semibold text-[var(--color-primary-foreground)]" />
            <span className="truncate text-[var(--color-foreground)]">{d.createdByName ?? '—'}</span>
          </span>
        </td>
      )
    case 'createdAt':
      return <td className={cn(muted, 'truncate whitespace-nowrap tabular-nums')}>{larkTime(d.createdAt, labels)}</td>
    case 'openedAt':
      return <td className={cn(muted, 'truncate whitespace-nowrap tabular-nums')}>{larkTime(d.lastOpenedAt, labels)}</td>
    case 'updatedAt':
      return <td className={cn(muted, 'truncate whitespace-nowrap tabular-nums')}>{larkTime(d.updatedAt, labels)}</td>
    case 'size':
      return <td className={cn(muted, 'whitespace-nowrap text-right tabular-nums')}>{formatBytes(d.fileSize)}</td>
    case 'ai':
      return <td className={cn('px-3 py-2.5 text-center', className)}><AiStatusIcon doc={d} /></td>
  }
}
