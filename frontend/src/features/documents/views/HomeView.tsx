import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bot, Clock, FileText, FolderPlus, LayoutGrid, List, Share2, Star, Upload, UserRound } from 'lucide-react'
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
}

/**
 * Trang chủ kiểu Lark Docs: thẻ thao tác nhanh, rồi các tab Gần đây · Của tôi · Được chia sẻ · Yêu thích. Tab nằm
 * trong URL (`?view=`) để quay lại đúng chỗ.
 */
export default function HomeView({ layout, onLayoutChange, canUpload, canCreateFolder, onUpload, onNewFolder }: Props) {
  const { t } = useTranslation('documents')
  const navigate = useNavigate()
  const aiAvailable = useAiAvailable()
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
      <div className="grid gap-3 sm:grid-cols-3">
        <QuickCard icon={<Upload />} title={t('home.cardUpload')} hint={t('home.cardUploadHint')} onClick={onUpload} disabled={!canUpload} />
        <QuickCard icon={<FolderPlus />} title={t('home.cardFolder')} hint={t('home.cardFolderHint')} onClick={onNewFolder} disabled={!canCreateFolder} />
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

function QuickCard({ icon, title, hint, onClick, disabled, ai }: {
  icon: ReactNode; title: string; hint: string; onClick: () => void; disabled?: boolean; ai?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
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
        <span className="block text-caption">{hint}</span>
      </span>
    </button>
  )
}
