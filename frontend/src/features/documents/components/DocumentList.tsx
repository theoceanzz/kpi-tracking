import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Folder, Pencil, Pin, Star, Trash2, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { formatDateTime } from '@/i18n/format'
import { cn } from '@/lib/utils'
import { useToggleDocumentAi } from '../hooks/useDocuments'
import type { DocumentFolder, KbDocument } from '../types'
import { formatBytes } from '../utils'
import { AiStatusBadge, FileTypeIcon } from './docUi'
import { useDocumentActions } from './DocumentActions'
import RowMenu, { type RowMenuItem } from './RowMenu'
import { locationLabel, useDocMenu } from './docMenu'

export type DocColumn = 'location' | 'owner' | 'createdAt' | 'openedAt' | 'updatedAt' | 'size' | 'ai'
export type DocLayout = 'list' | 'grid'

interface Props {
  docs: KbDocument[]
  /** Thư mục hiện TRƯỚC tài liệu (chỉ ở Drive). */
  folders?: DocumentFolder[]
  columns: DocColumn[]
  layout: DocLayout
}

/**
 * Danh sách tài liệu kiểu Lark Docs: dạng bảng (cột tuỳ màn) hoặc dạng lưới thẻ. Bấm dòng/thẻ mở drawer; menu ⋯
 * có tải về, yêu thích, ghim, chia sẻ, di chuyển, xoá — mục nào hiện là theo `canEdit` backend trả.
 */
export default function DocumentList({ docs, folders = [], columns, layout }: Props) {
  const { t } = useTranslation('documents')
  const actions = useDocumentActions()
  const menuFor = useDocMenu()
  const folderMenu = (f: DocumentFolder): RowMenuItem[] => f.canEdit ? [
    { key: 'rename', icon: <Pencil />, label: t('actions.rename'), onSelect: () => actions.renameFolder(f) },
    { key: 'delete', icon: <Trash2 />, label: t('actions.delete'), danger: true, separated: true, onSelect: () => actions.deleteFolder(f) },
  ] : []

  if (layout === 'grid') {
    return (
      <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {folders.map(f => (
          <div key={f.id} role="button" tabIndex={0} onClick={() => actions.openFolder(f)}
               onKeyDown={e => { if (e.key === 'Enter') actions.openFolder(f) }}
               className="group flex cursor-pointer items-center gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-3 transition-colors hover:border-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]">
            <FolderIcon />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-foreground)]" title={f.name}>{f.name}</span>
            <RowMenu items={folderMenu(f)} label={t('actions.more')} />
          </div>
        ))}
        {docs.map(d => (
          <div key={d.id} role="button" tabIndex={0} onClick={() => actions.open(d)}
               onKeyDown={e => { if (e.key === 'Enter') actions.open(d) }}
               className="group flex cursor-pointer flex-col rounded-card border border-[var(--color-border)] bg-[var(--color-card)] transition-colors hover:border-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]">
            <div className="flex h-24 items-center justify-center rounded-t-card bg-[var(--color-muted)]">
              <FileTypeIcon doc={d} size={28} />
            </div>
            <div className="flex items-start gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-sm font-medium text-[var(--color-foreground)]" title={d.title}>
                  {d.favorite && <Star size={13} className="shrink-0 fill-[var(--color-warning)] text-[var(--color-warning)]" aria-label={t('badge.favorite')} />}
                  <span className="truncate">{d.title}</span>
                </p>
                <p className="mt-0.5 truncate text-caption" title={locationLabel(d, t)}>{locationLabel(d, t)}</p>
                <div className="mt-2"><AiStatusBadge status={d.aiStatus} error={d.aiError} /></div>
              </div>
              <RowMenu items={menuFor(d)} label={t('actions.more')} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left">
            <th scope="col" className="px-4 py-2.5 text-eyebrow">{t('table.name')}</th>
            {columns.map(c => (
              <th key={c} scope="col" className={cn('px-3 py-2.5 text-eyebrow', c === 'size' && 'text-right')}>{t(`table.${c}`)}</th>
            ))}
            <th scope="col" className="w-12 px-3 py-2.5"><span className="sr-only">{t('table.actions')}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {folders.map(f => (
            <tr key={f.id} onClick={() => actions.openFolder(f)} className="cursor-pointer transition-colors hover:bg-[var(--color-muted)]">
              <td className="px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <FolderIcon />
                  <span className="max-w-[340px] truncate font-medium text-[var(--color-foreground)]" title={f.name}>{f.name}</span>
                </div>
              </td>
              {columns.map(c => (
                <td key={c} className="px-3 py-2.5 whitespace-nowrap text-[var(--color-muted-foreground)]">
                  {c === 'owner' ? (f.createdByName ?? '—') : c === 'createdAt' ? formatDateTime(f.createdAt) : ''}
                </td>
              ))}
              <td className="px-3 py-1.5 text-right" onClick={e => e.stopPropagation()}>
                <RowMenu items={folderMenu(f)} label={t('actions.more')} />
              </td>
            </tr>
          ))}
          {docs.map(d => (
            <tr key={d.id} onClick={() => actions.open(d)} className="cursor-pointer transition-colors hover:bg-[var(--color-muted)]">
              <td className="px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <FileTypeIcon doc={d} />
                  <div className="min-w-0">
                    <p className="flex max-w-[360px] items-center gap-1 font-medium text-[var(--color-foreground)]" title={d.title}>
                      <span className="truncate">{d.title}</span>
                      {d.favorite && <Star size={13} className="shrink-0 fill-[var(--color-warning)] text-[var(--color-warning)]" aria-label={t('badge.favorite')} />}
                      {d.pinned && <Pin size={12} className="shrink-0 text-[var(--color-muted-foreground)]" aria-label={t('badge.pinned')} />}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {d.fileName && <span className="max-w-[260px] truncate text-caption" title={d.fileName}>{d.fileName}</span>}
                      {d.legacy && <Badge variant="warning">{t('badge.noOriginal')}</Badge>}
                      {d.inherited && <Badge variant="info">{t('badge.inherited', { unit: d.orgUnitName ?? '' })}</Badge>}
                      {d.orphan && <Badge variant="destructive">{t('badge.orphan')}</Badge>}
                      {d.sharedWithMe && <Badge variant="info">{t('badge.sharedWithMe')}</Badge>}
                      {d.expired
                        ? <Badge variant="destructive">{t('badge.expired')}</Badge>
                        : d.reviewDue && <Badge variant="warning">{t('badge.reviewDue')}</Badge>}
                      {(d.shareCount ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 text-caption" title={t('badge.sharedCount', { count: d.shareCount ?? 0 })}>
                          <Users size={12} aria-hidden="true" />{d.shareCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </td>
              {columns.map(c => <DocCell key={c} column={c} doc={d} t={t} />)}
              <td className="px-3 py-1.5 text-right" onClick={e => e.stopPropagation()}>
                <RowMenu items={menuFor(d)} label={t('actions.more')} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DocCell({ column, doc: d, t }: { column: DocColumn; doc: KbDocument; t: TFunction<'documents'> }) {
  const toggle = useToggleDocumentAi()
  const muted = 'px-3 py-2.5 text-[var(--color-muted-foreground)]'
  switch (column) {
    case 'location':
      return <td className={muted}><span className="block max-w-[220px] truncate" title={locationLabel(d, t)}>{locationLabel(d, t)}</span></td>
    case 'owner':
      return <td className={muted}><span className="block max-w-[180px] truncate">{d.createdByName ?? '—'}</span></td>
    case 'createdAt':
      return <td className={cn(muted, 'whitespace-nowrap tabular-nums')}>{formatDateTime(d.createdAt)}</td>
    case 'openedAt':
      return <td className={cn(muted, 'whitespace-nowrap tabular-nums')}>{d.lastOpenedAt ? formatDateTime(d.lastOpenedAt) : '—'}</td>
    case 'updatedAt':
      return <td className={cn(muted, 'whitespace-nowrap tabular-nums')}>{formatDateTime(d.updatedAt)}</td>
    case 'size':
      return <td className={cn(muted, 'whitespace-nowrap text-right tabular-nums')}>{formatBytes(d.fileSize)}</td>
    case 'ai':
      return (
        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            {d.canEdit && !d.legacy && (
              <Switch size="sm" checked={d.aiEnabled} disabled={toggle.isPending}
                      onCheckedChange={v => toggle.mutate({ id: d.id, aiEnabled: v })} aria-label={t('fields.aiEnabled')} />
            )}
            <AiStatusBadge status={d.aiStatus} error={d.aiError} />
          </div>
        </td>
      )
  }
}

function FolderIcon() {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-control bg-[var(--color-warning-bg)] p-1.5 text-[var(--color-warning)]" aria-hidden="true">
      <Folder size={18} />
    </span>
  )
}
