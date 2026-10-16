import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import Pagination from '@/components/common/Pagination'
import { useDocuments } from '../hooks/useDocuments'
import DocumentList, { type DocLayout } from '../components/DocumentList'
import { LayoutToggle } from '../components/ListChrome'

const PAGE_SIZE = 20

/**
 * Kết quả ô "Tìm kiếm" đầu thanh bên (như Lark): tìm trong MỌI tài liệu mình xem được — cá nhân, đơn vị, công ty, được
 * chia sẻ — theo tên, tên tệp, mô tả. Không truyền phạm vi / chế độ xem thì máy chủ chỉ áp luật xem.
 */
export default function SearchView({ q, layout, onLayoutChange }: { q: string; layout: DocLayout; onLayoutChange: (l: DocLayout) => void }) {
  const { t } = useTranslation('documents')
  const [page, setPage] = useState(0)
  const list = useDocuments({ q, page, size: PAGE_SIZE }, !!q)
  const docs = list.data?.content ?? []

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-2.5">
          <p className="min-w-0 flex-1 truncate text-sm text-[var(--color-muted-foreground)]">
            {list.data ? t('search.resultCount', { count: list.data.totalElements, q }) : t('search.searching', { q })}
          </p>
          <LayoutToggle value={layout} onChange={onLayoutChange} />
        </div>
        {list.isLoading ? (
          <div className="p-4"><LoadingSkeleton type="table" rows={5} /></div>
        ) : docs.length === 0 ? (
          <EmptyState icon={Search} title={t('empty.filteredTitle')} description={t('empty.filteredDescription')} />
        ) : (
          <div className={list.isFetching ? 'opacity-80 transition-opacity' : undefined}>
            <DocumentList docs={docs} columns={['location', 'owner', 'updatedAt']} layout={layout} />
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
