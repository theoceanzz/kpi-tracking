import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight, FileText, FolderPlus, LayoutGrid, List, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import FilterBar, { SegmentedControl } from '@/components/common/FilterBar'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import Pagination from '@/components/common/Pagination'
import { useDebounce } from '@/hooks/useDebounce'
import { useDocumentFolders, useDocuments, useLegacyDocuments } from '../hooks/useDocuments'
import {
  DOCUMENT_CATEGORIES, type DocumentAiStatus, type DocumentCapabilities, type DocumentCategory, type DocumentFolder,
  type DocumentScope,
} from '../types'
import DocumentList, { type DocColumn, type DocLayout } from '../components/DocumentList'
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
  onUpload: (ctx: DriveContext) => void
  onNewFolder: (ctx: DriveContext) => void
}

/**
 * "Drive" của một phạm vi (của tôi / một đơn vị / công ty): breadcrumb, thư mục, tài liệu. Thư mục và đơn vị đang
 * mở nằm trong URL (`?folder=`, `?unit=`). Gõ tìm kiếm thì tìm trong CẢ phạm vi (mọi thư mục), như Lark.
 */
export default function DriveView({ scope, caps, layout, onLayoutChange, onUpload, onNewFolder }: Props) {
  const { t } = useTranslation('documents')
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

  const [q, setQ] = useState('')
  const debouncedQ = useDebounce(q.trim(), 400)
  const [category, setCategory] = useState<string>(ALL)
  const [aiStatus, setAiStatus] = useState<string>(ALL)
  const [page, setPage] = useState(0)
  const resetting = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(0) }
  const searching = !!debouncedQ

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
    folderId: searching ? undefined : (folderId ?? undefined),
    rootOnly: !searching && !folderId,
    category: category === ALL ? undefined : category as DocumentCategory,
    aiStatus: aiStatus === ALL ? undefined : aiStatus as DocumentAiStatus,
    q: debouncedQ || undefined,
    page,
    size: PAGE_SIZE,
  }, scope !== 'UNIT' || !!unitId)
  const atCompanyRoot = scope === 'COMPANY' && !folderId && !searching
  const legacy = useLegacyDocuments(atCompanyRoot)

  const current = folders.data?.current ?? null
  const canCreate = !!folders.data?.canCreate
  const ctx: DriveContext = { scope, unitId, folder: current }
  const rootLabel = scope === 'PERSONAL' ? t('location.mine')
    : scope === 'UNIT' ? (units.find(u => u.id === unitId)?.name ?? t('scope.UNIT')) : t('scope.COMPANY')

  const subfolders = searching ? [] : (folders.data?.folders ?? [])
  const docs = list.data?.content ?? []
  const filtered = searching || category !== ALL || aiStatus !== ALL
  const columns: DocColumn[] = searching ? ['location', 'owner', 'updatedAt', 'ai'] : ['owner', 'updatedAt', 'size', 'ai']
  const loading = list.isLoading || (folders.isLoading && !searching)

  if (scope === 'UNIT' && !unitId) {
    return (
      <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
        <EmptyState icon={FileText} title={t('empty.unitTitle')} description={t('empty.noUnitDescription')} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-caption">{t(`tabIntro.${scope === 'PERSONAL' ? 'mine' : scope === 'UNIT' ? 'unit' : 'company'}`)}</p>

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
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-3 py-2.5">
          {scope === 'UNIT' && (
            <Select value={unitId ?? undefined} onValueChange={v => { setParams(prev => {
              const p = new URLSearchParams(prev); p.set('unit', v); p.delete('folder'); return p
            }, { replace: true }); setPage(0) }}>
              <SelectTrigger className="w-full sm:w-56" aria-label={t('filters.unit')}><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <nav aria-label={t('drive.breadcrumb')} className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm">
            <button type="button" onClick={() => { setParam('folder', null); setPage(0) }}
                    className={current ? 'rounded-control px-1.5 py-0.5 font-medium text-[var(--color-primary)] hover:bg-[var(--color-muted)]' : 'px-1.5 py-0.5 font-semibold text-[var(--color-foreground)]'}>
              {rootLabel}
            </button>
            {(folders.data?.breadcrumb ?? []).map((f, i, arr) => (
              <span key={f.id} className="flex min-w-0 items-center gap-1">
                <ChevronRight size={14} className="shrink-0 text-[var(--color-muted-foreground)]" aria-hidden="true" />
                {i === arr.length - 1 ? (
                  <span className="max-w-[220px] truncate px-1.5 py-0.5 font-semibold text-[var(--color-foreground)]" aria-current="page">{f.name}</span>
                ) : (
                  <button type="button" onClick={() => { setParam('folder', f.id); setPage(0) }}
                          className="max-w-[180px] truncate rounded-control px-1.5 py-0.5 text-[var(--color-primary)] hover:bg-[var(--color-muted)]">
                    {f.name}
                  </button>
                )}
              </span>
            ))}
          </nav>
          {canCreate && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onNewFolder(ctx)}><FolderPlus aria-hidden="true" /> {t('actions.newFolder')}</Button>
              <Button size="sm" onClick={() => onUpload(ctx)}><Plus aria-hidden="true" /> {t('actions.upload')}</Button>
            </div>
          )}
        </div>

        <FilterBar
          className="border-b border-[var(--color-border)] p-3"
          search={{ value: q, onChange: resetting(setQ), placeholder: t('drive.searchScope', { name: rootLabel }), className: 'sm:w-72' }}
          trailing={
            <SegmentedControl<DocLayout>
              value={layout}
              onChange={onLayoutChange}
              ariaLabel={t('layout.label')}
              options={[
                { value: 'list', label: <List aria-hidden="true" />, title: t('layout.list') },
                { value: 'grid', label: <LayoutGrid aria-hidden="true" />, title: t('layout.grid') },
              ]}
            />
          }
        >
          <Select value={category} onValueChange={resetting(setCategory)}>
            <SelectTrigger className="w-full sm:w-48" aria-label={t('filters.category')}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('filters.allCategories')}</SelectItem>
              {DOCUMENT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{t(`category.${c}`)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={aiStatus} onValueChange={resetting(setAiStatus)}>
            <SelectTrigger className="w-full sm:w-44" aria-label={t('filters.aiStatus')}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('filters.allAiStatuses')}</SelectItem>
              {AI_FILTERS.map(s => <SelectItem key={s} value={s}>{t(`aiStatus.${s}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterBar>

        {loading ? (
          <div className="p-4"><LoadingSkeleton type="table" rows={5} /></div>
        ) : subfolders.length === 0 && docs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={filtered ? t('empty.filteredTitle') : current ? t('empty.folderTitle') : t(`empty.${scope === 'PERSONAL' ? 'mine' : scope === 'UNIT' ? 'unit' : 'company'}Title`)}
            description={filtered ? t('empty.filteredDescription') : current ? t('empty.folderDescription') : t(`empty.${scope === 'PERSONAL' ? 'mine' : scope === 'UNIT' ? 'unit' : 'company'}Description`)}
            action={!filtered && canCreate ? (
              <Button variant="outline" onClick={() => onUpload(ctx)}><Plus aria-hidden="true" /> {t('actions.upload')}</Button>
            ) : undefined}
          />
        ) : (
          <div className={list.isFetching ? 'opacity-80 transition-opacity' : undefined}>
            <DocumentList docs={docs} folders={category === ALL && aiStatus === ALL ? subfolders : []} columns={columns} layout={layout} />
          </div>
        )}
      </div>

      {list.data && list.data.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={list.data.totalPages} totalElements={list.data.totalElements}
                    size={PAGE_SIZE} onPageChange={setPage} itemLabel={t('pagination.item')} />
      )}
    </div>
  )
}
