import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, RotateCcw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { formatDateTime } from '@/i18n/format'
import { useDeletePermanently, useEmptyTrash, useRestoreDocument, useTrash } from '../hooks/useDocuments'
import type { KbDocument } from '../types'
import { trashDaysLeft } from '../utils'
import { FileTypeIcon } from '../components/docUi'
import { locationLabel } from '../components/docMenu'

/**
 * Thùng rác: tài liệu đã xoá mà người xem sửa được (cùng luật với người được xoá). Khôi phục trong N ngày; quá hạn
 * job dọn dẹp xoá hẳn cả tệp. K.AI không đọc tài liệu trong thùng rác — khôi phục thì nạp lại.
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
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-[var(--color-foreground)]">{t('trash.title')}</h2>
          <p className="text-caption">{t('trash.intro', { days: retentionDays })}</p>
        </div>
        {docs.length > 0 && (
          <Button variant="outline" size="sm" className="text-[var(--color-error)]" onClick={() => setConfirmEmpty(true)} disabled={empty.isPending}>
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
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left">
                <th scope="col" className="px-4 py-2.5 text-eyebrow">{t('table.name')}</th>
                <th scope="col" className="px-3 py-2.5 text-eyebrow">{t('trash.originalLocation')}</th>
                <th scope="col" className="px-3 py-2.5 text-eyebrow">{t('trash.deletedBy')}</th>
                <th scope="col" className="px-3 py-2.5 text-eyebrow">{t('trash.deletedAt')}</th>
                <th scope="col" className="px-3 py-2.5 text-eyebrow">{t('trash.remaining')}</th>
                <th scope="col" className="px-3 py-2.5"><span className="sr-only">{t('table.actions')}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {docs.map(d => {
                const left = trashDaysLeft(d.deletedAt, retentionDays)
                return (
                  <tr key={d.id}>
                    <td className="px-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <FileTypeIcon doc={d} />
                        <div className="min-w-0">
                          <p className="max-w-[320px] truncate font-medium text-[var(--color-foreground)]" title={d.title}>{d.title}</p>
                          {d.fileName && <p className="max-w-[260px] truncate text-caption">{d.fileName}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-muted-foreground)]">
                      <span className="block max-w-[200px] truncate">{locationLabel(d, t)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-muted-foreground)]">{d.deletedByName ?? t('trash.system')}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap tabular-nums text-[var(--color-muted-foreground)]">{formatDateTime(d.deletedAt)}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={left <= 3 ? 'warning' : 'secondary'}>{t('trash.daysLeft', { count: left })}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => restore.mutate(d.id)} disabled={restore.isPending}>
                          {restore.isPending && restore.variables === d.id
                            ? <Loader2 className="animate-spin" aria-hidden="true" />
                            : <RotateCcw aria-hidden="true" />}
                          {t('trash.restore')}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-[var(--color-error)]" onClick={() => setConfirm(d)}>
                          {t('trash.deleteForever')}
                        </Button>
                      </div>
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
