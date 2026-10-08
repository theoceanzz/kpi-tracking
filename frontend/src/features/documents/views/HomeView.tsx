import { forwardRef, useMemo, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bot, Clock, FilePlus2, FileSpreadsheet, FileText, FolderPlus, LayoutGrid, List, Plus, Share2, Star, Upload, UserRound } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import FilterBar, { SegmentedControl } from '@/components/common/FilterBar'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import Pagination from '@/components/common/Pagination'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { useDebounce } from '@/hooks/useDebounce'
import { useAiAvailable } from '@/features/analytics/hooks/useAiAvailable'
import { useDocuments, useRecentDocuments } from '../hooks/useDocuments'
import type { HomeView as HomeViewKind } from '../types'
import DocumentList, { type DocColumn, type DocLayout } from '../components/DocumentList'

type HomeTab = 'recent' | 'owned' | 'shared' | 'favorites'
const TABS: { key: HomeTab; icon: typeof Clock }[] = [
  { key: 'recent', icon: Clock },
  { key: 'owned', icon: UserRound },
  { key: 'shared', icon: Share2 },
  { key: 'favorites', icon: Star },
]
const VIEW_OF: Record<Exclude<HomeTab, 'recent'>, HomeViewKind> = { owned: 'OWNED', shared: 'SHARED', favorites: 'FAVORITES' }
const COLUMNS: Record<HomeTab, DocColumn[]> = {
  recent: ['location', 'owner', 'openedAt', 'ai'],
  owned: ['location', 'createdAt', 'updatedAt', 'ai'],
  shared: ['location', 'owner', 'createdAt', 'ai'],
  favorites: ['location', 'owner', 'updatedAt', 'ai'],
}
const PAGE_SIZE = 20

interface Props {
  layout: DocLayout
  onLayoutChange: (l: DocLayout) => void
  canUpload: boolean
  canCreateFolder: boolean
  onUpload: () => void
  onNewFolder: () => void
  onNewDoc: (kind: 'doc' | 'sheet') => void
}

/**
 * Trang chủ kiểu Lark Docs: thẻ thao tác nhanh, rồi các tab Gần đây · Của tôi · Được chia sẻ · Yêu thích. Tab nằm
 * trong URL (`?view=`) để quay lại đúng chỗ.
 */
export default function HomeView({ layout, onLayoutChange, canUpload, canCreateFolder, onUpload, onNewFolder, onNewDoc }: Props) {
  const { t } = useTranslation('documents')
  const navigate = useNavigate()
  const aiAvailable = useAiAvailable()
  const [createOpen, setCreateOpen] = useState(false)
  const [params, setParams] = useSearchParams()
  const raw = params.get('view') as HomeTab | null
  const tab: HomeTab = raw && TABS.some(x => x.key === raw) ? raw : 'recent'
  const setTab = (k: HomeTab) => {
    setParams(prev => { const p = new URLSearchParams(prev); p.set('view', k); return p }, { replace: true })
    setPage(0)
  }

  const [q, setQ] = useState('')
  const debouncedQ = useDebounce(q.trim(), 400)
  const [page, setPage] = useState(0)

  const recent = useRecentDocuments(tab === 'recent')
  const listed = useDocuments({
    view: tab === 'recent' ? undefined : VIEW_OF[tab],
    q: debouncedQ || undefined,
    page,
    size: PAGE_SIZE,
  }, tab !== 'recent')

  // "Gần đây" là danh sách ngắn (≤ 50) — lọc tại chỗ theo từ khoá.
  const recentDocs = useMemo(() => {
    const all = recent.data ?? []
    if (!debouncedQ) return all
    const needle = debouncedQ.toLowerCase()
    return all.filter(d => d.title.toLowerCase().includes(needle) || (d.fileName ?? '').toLowerCase().includes(needle))
  }, [recent.data, debouncedQ])

  const docs = tab === 'recent' ? recentDocs : (listed.data?.content ?? [])
  const loading = tab === 'recent' ? recent.isLoading : listed.isLoading

  return (
    <div className="space-y-4">
      {/* Ba ô gom đủ việc: Tạo mới (tài liệu / bảng tính / thư mục), Tải lên, Hỏi K.AI — ít ô để không xuống dòng. */}
      <div className={aiAvailable ? 'grid gap-3 sm:grid-cols-3' : 'grid gap-3 sm:grid-cols-2'}>
        <Popover open={createOpen} onOpenChange={setCreateOpen}>
          <PopoverTrigger asChild>
            <QuickCard icon={<Plus />} title={t('home.cardCreate')} hint={t('home.cardCreateHint')} disabled={!canUpload && !canCreateFolder}
                       aria-haspopup="menu" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-60 p-1.5" role="menu">
            <CreateItem icon={<FilePlus2 />} label={t('actions.newDoc')} disabled={!canUpload}
                        onClick={() => { setCreateOpen(false); onNewDoc('doc') }} />
            <CreateItem icon={<FileSpreadsheet />} label={t('actions.newSheet')} disabled={!canUpload}
                        onClick={() => { setCreateOpen(false); onNewDoc('sheet') }} />
            <CreateItem icon={<FolderPlus />} label={t('actions.newFolder')} disabled={!canCreateFolder}
                        onClick={() => { setCreateOpen(false); onNewFolder() }} />
          </PopoverContent>
        </Popover>
        <QuickCard icon={<Upload />} title={t('home.cardUpload')} hint={t('home.cardUploadHint')} onClick={onUpload} disabled={!canUpload} />
        {aiAvailable && (
          <QuickCard icon={<Bot />} title={t('home.cardAsk')} hint={t('home.cardAskHint')} onClick={() => navigate('/ai-assistant')} ai />
        )}
      </div>

      <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="px-3 pt-3">
          <div className="custom-scrollbar inline-flex max-w-full gap-0.5 overflow-x-auto rounded-control bg-[var(--color-muted)] p-0.5"
               role="tablist" aria-label={t('home.tabs')}>
            {TABS.map(({ key, icon: Icon }) => (
              <ChoiceChip key={key} role="tab" aria-selected={tab === key} selected={tab === key} variant="segment"
                          onClick={() => setTab(key)}>
                <Icon aria-hidden="true" /> {t(`home.tab.${key}`)}
              </ChoiceChip>
            ))}
          </div>
        </div>
        <FilterBar
          className="border-b border-[var(--color-border)] p-3"
          search={{ value: q, onChange: v => { setQ(v); setPage(0) }, placeholder: t('filters.search') }}
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
        />
        {loading ? (
          <div className="p-4"><LoadingSkeleton type="table" rows={5} /></div>
        ) : docs.length === 0 ? (
          <EmptyState
            icon={TABS.find(x => x.key === tab)?.icon ?? FileText}
            title={debouncedQ ? t('empty.filteredTitle') : t(`home.empty.${tab}Title`)}
            description={debouncedQ ? t('empty.filteredDescription') : t(`home.empty.${tab}Description`)}
          />
        ) : (
          <DocumentList docs={docs} columns={COLUMNS[tab]} layout={layout} />
        )}
      </div>

      {tab !== 'recent' && listed.data && listed.data.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={listed.data.totalPages} totalElements={listed.data.totalElements}
                    size={PAGE_SIZE} onPageChange={setPage} itemLabel={t('pagination.item')} />
      )}
    </div>
  )
}

type QuickCardProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon: ReactNode; title: string; hint: string; ai?: boolean }

/** Ô thao tác nhanh; nhận ref + props để làm nút mở menu (PopoverTrigger asChild). */
const QuickCard = forwardRef<HTMLButtonElement, QuickCardProps>(function QuickCard({ icon, title, hint, ai, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      className="flex items-center gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-left transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:pointer-events-none disabled:opacity-50"
    >
      <span className={ai
        ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-[var(--color-ai-soft)] text-[var(--color-ai)] [&_svg]:size-5'
        : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-[var(--color-primary-soft)] text-[var(--color-primary)] [&_svg]:size-5'}
            aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--color-foreground)]">{title}</span>
        <span className="block truncate text-caption">{hint}</span>
      </span>
    </button>
  )
})

function CreateItem({ icon, label, onClick, disabled }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] focus-visible:bg-[var(--color-muted)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[var(--color-muted-foreground)]"
    >
      {icon}{label}
    </button>
  )
}
