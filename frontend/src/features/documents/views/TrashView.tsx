import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import RowMenu from '@/components/common/RowMenu'
import UserAvatar from '@/components/common/UserAvatar'
import { cn } from '@/lib/utils'
import { useDeletePermanently, useEmptyTrash, useRestoreDocument, useTrash } from '../hooks/useDocuments'
import type { KbDocument } from '../types'
import { trashDaysLeft } from '../utils'
import { FileTypeIcon } from '../components/docUi'
import { locationLabel } from '../components/docMenu'

/**
 * Thùng rác theo Lark (docs/DOCUMENTS_LARK_REFERENCE.md §5): Tên · Người xoá · Thời gian còn lại, menu ⋯ chỉ có Khôi phục
 * (về đúng chỗ cũ) và Xoá vĩnh viễn. Tài liệu đã xoá mà người xem sửa được (cùng luật với người được xoá); quá hạn thì job
 * dọn dẹp xoá hẳn cả tệp. K.AI không đọc tài liệu trong thùng rác — khôi phục thì nạp lại. "Dọn sạch thùng rác" là thêm
 * của KeyGo.
 */
export default function TrashView({ retentionDays }: { retentionDays: number }) {
  const { t } = useTranslation('documents')
  const { data, isLoading } = useTrash(true)
  const restore = useRestoreDocument()
  const purge = useDeletePermanently()
  const [confirm, setConfirm] = useState<KbDocument | null>(null)
  const empty = useEmptyTrash()
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const docs = data ?? []

  return (
    <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] px-4 py-2.5">
        <p className="min-w-0 flex-1 text-caption">{t('trash.intro', { days: retentionDays })}</p>
        {docs.length > 0 && (
          <Button variant="ghost" size="sm" className="text-[var(--color-error)]" onClick={() => setConfirmEmpty(true)} disabled={empty.isPending}>
            <Trash2 aria-hidden="true" /> {t('trash.empty')}
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="p-4"><LoadingSkeleton type="table" rows={4} /></div>
      ) : docs.length === 0 ? (
        <EmptyState icon={Trash2} title={t('trash.emptyTitle')} description={t('trash.emptyDescription', { days: retentionDays })} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[13px] text-[var(--color-muted-foreground)]">
                <th scope="col" className="px-4 py-2 font-normal">{t('table.name')}</th>
                <th scope="col" className="px-3 py-2 font-normal">{t('trash.deletedBy')}</th>
                <th scope="col" className="px-3 py-2 font-normal">{t('trash.timeRemaining')}</th>
                <th scope="col" className="w-12 px-3 py-2"><span className="sr-only">{t('table.actions')}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {docs.map(d => {
                const left = trashDaysLeft(d.deletedAt, retentionDays)
                return (
                  <tr key={d.id} className="hover:bg-[var(--color-muted)]">
                    <td className="px-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-3" title={`${d.title} · ${t('trash.originalLocation')}: ${locationLabel(d, t)}`}>
                        <FileTypeIcon doc={d} size={15} />
                        <span className="max-w-[420px] truncate text-[var(--color-foreground)]">{d.title}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <UserAvatar fullName={d.deletedByName ?? ''} className="h-5 w-5 rounded-full text-[9px]"
                                    fallbackClassName="bg-[var(--color-primary)] font-semibold text-[var(--color-primary-foreground)]" />
                        <span className="truncate text-[var(--color-foreground)]">{d.deletedByName ?? t('trash.system')}</span>
                      </span>
                    </td>
                    <td className={cn('px-3 py-2.5 tabular-nums', left <= 3 ? 'text-[var(--color-warning)]' : 'text-[var(--color-muted-foreground)]')}>
                      {t('trash.daysLeft', { count: left })}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <RowMenu label={t('actions.more')} items={[
                        { key: 'restore', icon: <RotateCcw />, label: t('trash.restore'), onSelect: () => restore.mutate(d.id) },
                        { key: 'purge', icon: <Trash2 />, label: t('trash.deleteForever'), danger: true, onSelect: () => setConfirm(d) },
                      ]} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={confirmEmpty}
        onClose={() => setConfirmEmpty(false)}
        onConfirm={() => empty.mutate(undefined, { onSuccess: () => setConfirmEmpty(false) })}
        title={t('trash.emptyConfirmTitle')}
        description={t('trash.emptyConfirmDescription', { count: docs.length })}
        confirmLabel={t('trash.empty')}
        loading={empty.isPending}
      />
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && purge.mutate(confirm.id, { onSuccess: () => setConfirm(null) })}
        title={t('trash.confirmTitle', { title: confirm?.title ?? '' })}
        description={t('trash.confirmDescription')}
        confirmLabel={t('trash.deleteForever')}
        loading={purge.isPending}
      />
    </div>
  )
}
