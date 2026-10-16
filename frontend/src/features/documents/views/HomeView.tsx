import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Clock, FileText, Share2, Star, UserRound } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import Pagination from '@/components/common/Pagination'
import { useDocuments, useRecentDocuments } from '../hooks/useDocuments'
import type { HomeView as HomeViewKind } from '../types'
import DocumentList, { type DocColumn, type DocLayout } from '../components/DocumentList'
import { LayoutToggle, UnderlineTabs } from '../components/ListChrome'

type HomeTab = 'recent' | 'owned' | 'shared' | 'favorites'
const TABS: { key: HomeTab; icon: typeof Clock }[] = [
  { key: 'recent', icon: Clock },
  { key: 'owned', icon: UserRound },
  { key: 'shared', icon: Share2 },
  { key: 'favorites', icon: Star },
]
const VIEW_OF: Record<Exclude<HomeTab, 'recent'>, HomeViewKind> = { owned: 'OWNED', shared: 'SHARED', favorites: 'FAVORITES' }
// Lark (bản mới): Name · Location · Owner · Created · Recent ↓. Trạng thái K.AI chỉ hiện ở Drive (nơi quản lý tài liệu).
const COLUMNS: Record<HomeTab, DocColumn[]> = {
  recent: ['location', 'owner', 'createdAt', 'openedAt'],
  owned: ['location', 'createdAt', 'updatedAt'],
  shared: ['location', 'owner', 'createdAt'],
  favorites: ['location', 'owner', 'updatedAt'],
}
const PAGE_SIZE = 20

/**
 * Trang chủ kiểu Lark Docs: tab chữ gạch chân Gần đây · Của tôi · Được chia sẻ · Yêu thích, bên phải nút danh sách / lưới.
 * Thẻ "Mới / Tải lên" do trang vẽ phía trên; tìm kiếm ở ô đầu thanh bên. Tab nằm trong URL (`?view=`).
 */
export default function HomeView({ layout, onLayoutChange }: { layout: DocLayout; onLayoutChange: (l: DocLayout) => void }) {
  const { t } = useTranslation('documents')
  const [params, setParams] = useSearchParams()
  const raw = params.get('view') as HomeTab | null
  const tab: HomeTab = raw && TABS.some(x => x.key === raw) ? raw : 'recent'
  const [page, setPage] = useState(0)
  const setTab = (k: HomeTab) => {
    setParams(prev => { const p = new URLSearchParams(prev); p.set('view', k); return p }, { replace: true })
    setPage(0)
  }

  const recent = useRecentDocuments(tab === 'recent')
  const listed = useDocuments({ view: tab === 'recent' ? undefined : VIEW_OF[tab], page, size: PAGE_SIZE }, tab !== 'recent')
  const docs = tab === 'recent' ? (recent.data ?? []) : (listed.data?.content ?? [])
  const loading = tab === 'recent' ? recent.isLoading : listed.isLoading

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="flex items-end gap-3 border-b border-[var(--color-border)] px-4 pt-2">
          <UnderlineTabs label={t('home.tabs')} value={tab} onChange={setTab}
                         items={TABS.map(x => ({ key: x.key, label: t(`home.tab.${x.key}`) }))} />
          <div className="ml-auto pb-2"><LayoutToggle value={layout} onChange={onLayoutChange} /></div>
        </div>
        {loading ? (
          <div className="p-4"><LoadingSkeleton type="table" rows={5} /></div>
        ) : docs.length === 0 ? (
          <EmptyState icon={TABS.find(x => x.key === tab)?.icon ?? FileText}
                      title={t(`home.empty.${tab}Title`)} description={t(`home.empty.${tab}Description`)} />
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

