import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Building2, FileText, Info, Layers, Plus, User, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import { WorkspaceTabsProvider } from '@/components/common/WorkspaceTabs'
import FilterBar from '@/components/common/FilterBar'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import Pagination from '@/components/common/Pagination'
import { useTabParam } from '@/hooks/useTabParam'
import { useDebounce } from '@/hooks/useDebounce'
import { formatNumber } from '@/i18n/format'
import { useDocument, useDocumentCapabilities, useDocumentUsage, useDocuments, useLegacyDocuments } from './hooks/useDocuments'
import DocumentTable from './components/DocumentTable'
import DocumentDrawer from './components/DocumentDrawer'
import UploadDocumentDialog from './components/UploadDocumentDialog'
import { creatableScopes, formatBytes } from './utils'
import {
  DOCUMENT_CATEGORIES, type DocumentAiStatus, type DocumentCategory, type DocumentScope, type KbDocument,
} from './types'

type TabKey = 'mine' | 'unit' | 'company'
const SCOPE_OF: Record<TabKey, DocumentScope> = { mine: 'PERSONAL', unit: 'UNIT', company: 'COMPANY' }
/** Radix Select không nhận value="" — dùng hằng cho lựa chọn "tất cả". */
const ALL = '__all__'
const PAGE_SIZE = 20
const AI_FILTERS: DocumentAiStatus[] = ['READY', 'PENDING', 'INDEXING', 'FAILED', 'UNSUPPORTED', 'NONE']

/**
 * Thư viện tài liệu 3 phạm vi — tri thức cho K.AI (docs/DOCUMENTS_DESIGN.md §8). Tab nào hiện và ai sửa được gì
 * đều do backend quyết (`/documents/capabilities`, `canEdit` trên từng tài liệu).
 */
export default function DocumentsPage() {
  const { t } = useTranslation('documents')
  const { data: caps, isLoading: capsLoading } = useDocumentCapabilities()
  const { data: usage } = useDocumentUsage()

  const { activeTab, setActiveTab, visibleTabs } = useTabParam<TabKey>([
    { key: 'mine', label: t('tabs.mine'), icon: User, visible: !!caps?.canUploadPersonal },
    { key: 'unit', label: t('tabs.unit'), icon: Layers, visible: (caps?.visibleUnits.length ?? 0) > 0 },
    { key: 'company', label: t('tabs.company'), icon: Building2, visible: !!caps?.member },
  ])
  const scope = SCOPE_OF[activeTab] ?? 'COMPANY'

  const [q, setQ] = useState('')
  const debouncedQ = useDebounce(q, 400)
  const [category, setCategory] = useState<string>(ALL)
  const [aiStatus, setAiStatus] = useState<string>(ALL)
  const [unitId, setUnitId] = useState<string>(ALL)
  const [includeDescendants, setIncludeDescendants] = useState(true)
  const [page, setPage] = useState(0)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [openDoc, setOpenDoc] = useState<KbDocument | null>(null)

  /** Đổi tab hay bộ lọc là quay về trang đầu — làm ngay trong handler, không qua effect. */
  const resetting = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(0) }

  const filterUnit = activeTab === 'unit' && unitId !== ALL ? unitId : undefined
  const { data, isLoading, isFetching } = useDocuments({
    scope,
    unitId: filterUnit,
    includeDescendants: filterUnit ? includeDescendants : undefined,
    category: category === ALL ? undefined : category as DocumentCategory,
    aiStatus: aiStatus === ALL ? undefined : aiStatus as DocumentAiStatus,
    q: debouncedQ.trim() || undefined,
    page,
    size: PAGE_SIZE,
  }, !!caps?.member)
  const { data: legacy } = useLegacyDocuments(activeTab === 'company' && !!caps?.member)

  // Mở thẳng một tài liệu từ chip nguồn của K.AI: /documents?tab=…&doc=<id>[&legacy=1]. Vẫn qua kiểm quyền —
  // không đọc được (đã xoá, bị thu quyền) thì báo rõ thay vì im lặng.
  const [searchParams, setSearchParams] = useSearchParams()
  const linkedId = searchParams.get('doc')
  const linkedLegacy = searchParams.get('legacy') === '1'
  const linked = useDocument(linkedLegacy ? null : linkedId, !!caps?.member)
  const linkedDoc = linkedId
    ? (linkedLegacy ? legacy?.find(d => d.id === linkedId) : linked.data) ?? null
    : null
  const linkedMissing = !!linkedId && (linkedLegacy ? legacy !== undefined && !linkedDoc : linked.isError)

  const clearLink = () => setSearchParams(prev => {
    const p = new URLSearchParams(prev)
    p.delete('doc')
    p.delete('legacy')
    return p
  }, { replace: true })

  // Drawer luôn hiện bản MỚI NHẤT sau khi danh sách làm mới (bật AI, nạp xong…).
  const current = useMemo(() => {
    const open = openDoc ?? linkedDoc
    if (!open) return null
    return data?.content.find(d => d.id === open.id) ?? legacy?.find(d => d.id === open.id) ?? open
  }, [openDoc, linkedDoc, data, legacy])

  const closeDrawer = () => {
    setOpenDoc(null)
    if (linkedId) clearLink()
  }

  const docs = data?.content ?? []
  const filtered = !!(debouncedQ || category !== ALL || aiStatus !== ALL || filterUnit)
  const canUpload = !!caps && creatableScopes(caps).length > 0

  const stats = usage ? (
    activeTab === 'mine'
      ? [{ label: t('stats.personalUsage'), value: `${formatBytes(usage.personalUsed)} / ${formatBytes(usage.personalQuota)}` }]
      : activeTab === 'company'
        ? [
            { label: t('stats.companyUsage'), value: `${formatBytes(usage.companyUsed)} / ${formatBytes(usage.companyQuota)}` },
            { label: t('stats.aiChunks'), value: `${formatNumber(usage.orgChunks)} / ${formatNumber(usage.orgChunkQuota)}` },
          ]
        : [{ label: t('stats.unitQuota'), value: formatBytes(usage.unitQuota) }]
  ) : undefined

  if (capsLoading) {
    return <div className="mx-auto max-w-[1600px]"><LoadingSkeleton type="table" rows={6} /></div>
  }
  if (!caps?.member) {
    return (
      <div className="mx-auto max-w-[1600px] rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
        <EmptyState icon={FileText} title={t('empty.notMemberTitle')} description={t('empty.notMemberDescription')} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <WorkspaceTabsProvider tabs={visibleTabs} activeTab={activeTab} setActiveTab={k => { setActiveTab(k as TabKey); setPage(0) }}>
        <WorkspaceHeader
          id="tour-documents-header"
          title={visibleTabs.length > 1 ? undefined : t('title')}
          description={t(`tabIntro.${activeTab}`)}
          stats={stats}
          actions={canUpload ? (
            <Button onClick={() => setUploadOpen(true)}><Plus aria-hidden="true" /> {t('actions.upload')}</Button>
          ) : undefined}
        />
      </WorkspaceTabsProvider>

      {linkedMissing && (
        <div role="alert" className="flex items-start gap-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
          <p className="flex-1 text-[var(--color-foreground)]">{t('sources.notFound')}</p>
          <button type="button" onClick={clearLink} aria-label={t('common.close')}
                  className="shrink-0 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <p className="flex items-start gap-1.5 text-caption">
        <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>{t('notice.chatHistory')}</span>
      </p>

      {activeTab === 'company' && (legacy?.length ?? 0) > 0 && (
        <section className="overflow-hidden rounded-card border border-[var(--color-warning-border)] bg-[var(--color-card)]">
          <div className="border-b border-[var(--color-border)] bg-[var(--color-warning-bg)] px-4 py-2.5">
            <h2 className="text-sm font-semibold text-[var(--color-foreground)]">{t('legacy.heading', { count: legacy!.length })}</h2>
            <p className="text-caption">{t('legacy.sectionHint')}</p>
          </div>
          <DocumentTable docs={legacy!} scope="COMPANY" onOpen={setOpenDoc} />
        </section>
      )}

      <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        <FilterBar
          className="border-b border-[var(--color-border)] p-3"
          search={{ value: q, onChange: resetting(setQ), placeholder: t('filters.search') }}
        >
          {activeTab === 'unit' && (
            <>
              <Select value={unitId} onValueChange={resetting(setUnitId)}>
                <SelectTrigger className="w-full sm:w-56" aria-label={t('filters.unit')}><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={ALL}>{t('filters.allUnits')}</SelectItem>
                  {caps.visibleUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {filterUnit && (
                <label className="flex h-9 items-center gap-2 text-sm text-[var(--color-foreground)]">
                  <Checkbox checked={includeDescendants} onCheckedChange={resetting(setIncludeDescendants)} />
                  {t('filters.includeDescendants')}
                </label>
              )}
            </>
          )}
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

        {isLoading ? (
          <div className="p-4"><LoadingSkeleton type="table" rows={5} /></div>
        ) : docs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={filtered ? t('empty.filteredTitle') : t(`empty.${activeTab}Title`)}
            description={filtered ? t('empty.filteredDescription') : t(`empty.${activeTab}Description`)}
            action={!filtered && canUpload ? (
              <Button variant="outline" onClick={() => setUploadOpen(true)}><Plus aria-hidden="true" /> {t('actions.upload')}</Button>
            ) : undefined}
          />
        ) : (
          <div className={isFetching ? 'opacity-80 transition-opacity' : undefined}>
            <DocumentTable docs={docs} scope={scope} onOpen={setOpenDoc} />
          </div>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={data.totalPages} totalElements={data.totalElements}
                    size={PAGE_SIZE} onPageChange={setPage} itemLabel={t('pagination.item')} />
      )}

      {uploadOpen && usage && (
        <UploadDocumentDialog
          open
          onClose={() => setUploadOpen(false)}
          caps={caps}
          maxFileBytes={usage.maxFileBytes}
          defaultScope={scope}
          defaultUnitId={filterUnit}
        />
      )}
      {current && <DocumentDrawer key={current.id} doc={current} caps={caps} onClose={closeDrawer} />}
    </div>
  )
}
