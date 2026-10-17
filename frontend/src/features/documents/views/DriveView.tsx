import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight, ExternalLink, FileText, Filter, Link2, PenLine, Trash2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import Pagination from '@/components/common/Pagination'
import RowMenu, { type RowMenuItem } from '@/components/common/RowMenu'
import { cn } from '@/lib/utils'
import { useDocumentFolders, useDocuments, useLegacyDocuments } from '../hooks/useDocuments'
import {
  DOCUMENT_CATEGORIES, type DocumentAiStatus, type DocumentCapabilities, type DocumentCategory, type DocumentFolder,
  type DocumentScope,
} from '../types'
import DocumentList, { type DocLayout } from '../components/DocumentList'
import { LayoutToggle } from '../components/ListChrome'
import { FolderIcon } from '../components/docUi'
import { copyAppLink, folderPath } from '../components/docMenu'
import { useDocumentActions } from '../components/DocumentActions'
import { listableUnits } from '../utils'

/** Radix Select không nhận value="" — dùng hằng cho lựa chọn "tất cả". */
const ALL = '__all__'
const PAGE_SIZE = 20
const AI_FILTERS: DocumentAiStatus[] = ['READY', 'PENDING', 'INDEXING', 'FAILED', 'UNSUPPORTED', 'NONE']

/** Nơi tải lên / tạo thư mục: đúng thư mục đang mở, hoặc gốc của phạm vi đang xem. */
export interface DriveContext {
  scope: DocumentScope
  unitId: string | null
  folder: DocumentFolder | null
}

interface Props {
  scope: DocumentScope
  caps: DocumentCapabilities
  layout: DocLayout
  onLayoutChange: (l: DocLayout) => void
  /** Báo cho trang chỗ đang đứng (để thẻ "Mới / Tải lên" tạo đúng tại đây) và có được tạo ở đây không. */
  onContext: (ctx: DriveContext, canCreate: boolean) => void
}

/**
 * "Drive" của một phạm vi (của tôi / một đơn vị / công ty) theo bố cục Lark (docs/DOCUMENTS_LARK_REFERENCE.md §4):
 * đường dẫn thư mục, thư mục hiện thành thẻ, rồi mục "Tài liệu" (Tên · Người tạo · Sửa lần cuối, ⋯), rê chuột để tích chọn
 * nhiều. Thư mục và đơn vị đang mở nằm trong URL (`?folder=`, `?unit=`).
 */
export default function DriveView({ scope, caps, layout, onLayoutChange, onContext }: Props) {
  const { t } = useTranslation('documents')
  const actions = useDocumentActions()
  const [params, setParams] = useSearchParams()
  const setParam = (key: string, value: string | null) => setParams(prev => {
    const p = new URLSearchParams(prev)
    if (value) p.set(key, value); else p.delete(key)
    return p
  }, { replace: true })

  const unitParam = params.get('unit')
  const units = listableUnits(caps)
  const defaultUnit = caps.manageableUnits[0]?.id ?? units[0]?.id ?? null
  const unitId = scope === 'UNIT'
    ? (unitParam && units.some(u => u.id === unitParam) ? unitParam : defaultUnit)
    : null
  const folderId = params.get('folder')

  const [category, setCategory] = useState<string>(ALL)
  const [aiStatus, setAiStatus] = useState<string>(ALL)
  const [page, setPage] = useState(0)
  const resetting = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(0) }
  const filterCount = (category !== ALL ? 1 : 0) + (aiStatus !== ALL ? 1 : 0)

  const folders = useDocumentFolders(folderId ? { parentId: folderId } : { scope, unitId: unitId ?? undefined },
    scope !== 'UNIT' || !!unitId)
  // Thư mục trong link không còn (đã xoá, mất quyền) → về gốc thay vì kẹt ở trang lỗi.
  useEffect(() => {
    if (folderId && folders.isError) setParam('folder', null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId, folders.isError])

  const list = useDocuments({
    scope,
    unitId: unitId ?? undefined,
    folderId: folderId ?? undefined,
    rootOnly: !folderId,
    category: category === ALL ? undefined : category as DocumentCategory,
    aiStatus: aiStatus === ALL ? undefined : aiStatus as DocumentAiStatus,
    page,
    size: PAGE_SIZE,
  }, scope !== 'UNIT' || !!unitId)
  const atCompanyRoot = scope === 'COMPANY' && !folderId
  const legacy = useLegacyDocuments(atCompanyRoot)

  const current = folders.data?.current ?? null
  const canCreate = !!folders.data?.canCreate
  useEffect(() => {
    onContext({ scope, unitId, folder: current }, canCreate)
  }, [scope, unitId, current, canCreate, onContext])

  const rootLabel = scope === 'PERSONAL' ? t('location.mine')
    : scope === 'UNIT' ? (units.find(u => u.id === unitId)?.name ?? t('scope.UNIT')) : t('scope.COMPANY')
  const subfolders = filterCount > 0 ? [] : (folders.data?.folders ?? [])
  const docs = list.data?.content ?? []
  const loading = list.isLoading || folders.isLoading
  const kind = scope === 'PERSONAL' ? 'mine' : scope === 'UNIT' ? 'unit' : 'company'

  if (scope === 'UNIT' && !unitId) {
    return (
      <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
        <EmptyState icon={FileText} title={t('empty.unitTitle')} description={t('empty.noUnitDescription')} />
      </div>
    )
  }

  const folderMenu = (f: DocumentFolder): RowMenuItem[] => [
    { key: 'newTab', icon: <ExternalLink />, label: t('actions.openNewTab'), onSelect: () => window.open(folderPath(f), '_blank', 'noopener') },
    { key: 'copyLink', separated: true, icon: <Link2 />, label: t('actions.copyLink'), onSelect: () => copyAppLink(folderPath(f), t('toast.linkCopied')) },
    ...(f.canEdit ? [
      { key: 'rename', separated: true, icon: <PenLine />, label: t('actions.rename'), onSelect: () => actions.renameFolder(f) },
      { key: 'delete', separated: true, icon: <Trash2 />, label: t('actions.delete'), danger: true, onSelect: () => actions.deleteFolder(f) },
    ] : []),
  ]

  return (
    <div className="space-y-4">
      {atCompanyRoot && (legacy.data?.length ?? 0) > 0 && (
        <section className="overflow-hidden rounded-card border border-[var(--color-warning-border)] bg-[var(--color-card)]">
          <div className="border-b border-[var(--color-border)] bg-[var(--color-warning-bg)] px-4 py-2.5">
            <h2 className="text-sm font-semibold text-[var(--color-foreground)]">{t('legacy.heading', { count: legacy.data!.length })}</h2>
            <p className="text-caption">{t('legacy.sectionHint')}</p>
          </div>
          <DocumentList docs={legacy.data!} columns={['owner', 'updatedAt', 'ai']} layout="list" />
        </section>
      )}

      <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
          {scope === 'UNIT' && (
            <Select value={unitId ?? undefined} onValueChange={v => { setParams(prev => {
              const p = new URLSearchParams(prev); p.set('unit', v); p.delete('folder'); return p
            }, { replace: true }); setPage(0) }}>
              <SelectTrigger className="h-8 w-full sm:w-52" aria-label={t('filters.unit')}><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {/* Ở gốc, tên kho đã là tiêu đề to của trang — chỉ hiện đường dẫn khi đã vào thư mục. */}
          <nav aria-label={t('drive.breadcrumb')} className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5 text-[15px]">
            {current && <button type="button" onClick={() => { setParam('folder', null); setPage(0) }}
                    className={current ? 'rounded-control px-1.5 py-0.5 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]' : 'px-1.5 py-0.5 font-semibold text-[var(--color-foreground)]'}>
              {rootLabel}
            </button>}
            {current && (folders.data?.breadcrumb ?? []).map((f, i, arr) => (
              <span key={f.id} className="flex min-w-0 items-center gap-0.5">
                <ChevronRight size={14} className="shrink-0 text-[var(--color-muted-foreground)]" aria-hidden="true" />
                {i === arr.length - 1 ? (
                  <span className="max-w-[240px] truncate px-1.5 py-0.5 font-semibold text-[var(--color-foreground)]" aria-current="page">{f.name}</span>
                ) : (
                  <button type="button" onClick={() => { setParam('folder', f.id); setPage(0) }}
                          className="max-w-[180px] truncate rounded-control px-1.5 py-0.5 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]">
                    {f.name}
                  </button>
                )}
              </span>
            ))}
          </nav>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={cn('flex h-8 items-center gap-1.5 rounded-control px-2.5 text-sm transition-colors hover:bg-[var(--color-muted)]',
                filterCount > 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted-foreground)]')}>
                <Filter size={15} aria-hidden="true" /> {t('filters.button')}{filterCount > 0 && ` ${filterCount}`}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 space-y-3 p-3">
              <div className="space-y-1.5">
                <p className="text-label">{t('filters.category')}</p>
                <Select value={category} onValueChange={resetting(setCategory)}>
                  <SelectTrigger aria-label={t('filters.category')}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t('filters.allCategories')}</SelectItem>
                    {DOCUMENT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{t(`category.${c}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-label">{t('filters.aiStatus')}</p>
                <Select value={aiStatus} onValueChange={resetting(setAiStatus)}>
                  <SelectTrigger aria-label={t('filters.aiStatus')}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t('filters.allAiStatuses')}</SelectItem>
                    {AI_FILTERS.map(s => <SelectItem key={s} value={s}>{t(`aiStatus.${s}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
          <LayoutToggle value={layout} onChange={onLayoutChange} />
        </div>

        {loading ? (
          <div className="p-4"><LoadingSkeleton type="table" rows={5} /></div>
        ) : subfolders.length === 0 && docs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={filterCount > 0 ? t('empty.filteredTitle') : current ? t('empty.folderTitle') : t(`empty.${kind}Title`)}
            description={filterCount > 0 ? t('empty.filteredDescription') : current ? t('empty.folderDescription') : t(`empty.${kind}Description`)}
          />
        ) : (
          <>
            {subfolders.length > 0 && (
              <section className="px-4 pb-1 pt-3">
                <h2 className="mb-2 text-sm font-semibold text-[var(--color-foreground)]">{t('drive.folders')}</h2>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  {subfolders.map(f => (
                    <div key={f.id} role="button" tabIndex={0} onClick={() => actions.openFolder(f)}
                         onKeyDown={e => { if (e.key === 'Enter') actions.openFolder(f) }}
                         className="flex cursor-pointer items-center gap-3 rounded-card border border-[var(--color-border)] py-2 pl-3.5 pr-1.5 transition-colors hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]">
                      <FolderIcon />
                      <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-foreground)]" title={f.name}>{f.name}</span>
                      <RowMenu items={folderMenu(f)} label={t('actions.more')} />
                    </div>
                  ))}
                </div>
              </section>
            )}
            {docs.length > 0 && (
              <section className={cn('pt-3', list.isFetching && 'opacity-80 transition-opacity')}>
                {subfolders.length > 0 && <h2 className="mb-1 px-4 text-sm font-semibold text-[var(--color-foreground)]">{t('drive.documents')}</h2>}
                <DocumentList docs={docs} columns={['owner', 'updatedAt', 'ai']} layout={layout} selectable />
              </section>
            )}
          </>
        )}
      </div>

      {list.data && list.data.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={list.data.totalPages} totalElements={list.data.totalElements}
                    size={PAGE_SIZE} onPageChange={setPage} itemLabel={t('pagination.item')} />
      )}
    </div>
  )
}
