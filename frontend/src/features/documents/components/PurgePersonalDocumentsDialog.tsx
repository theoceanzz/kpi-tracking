import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getApiErrorMessage } from '@/lib/apiError'
import { documentApi } from '../api/documentApi'
import { formatBytes } from '../utils'

interface Props {
  user: { id: string; fullName: string }
  onClose: () => void
}

/**
 * Admin xoá sớm kho tài liệu cá nhân của một người ĐANG bị vô hiệu hoá (docs/DOCUMENTS_DESIGN.md §5.5). Không cần
 * chờ hết 90 ngày tự xoá. Admin chỉ thấy số tài liệu và dung lượng — không tên, không nội dung.
 */
export default function PurgePersonalDocumentsDialog({ user, onClose }: Props) {
  const { t } = useTranslation('documents')
  const qc = useQueryClient()
  const { data: summary, isLoading, isError, error } = useQuery({
    queryKey: ['documents', 'personal-summary', user.id],
    queryFn: () => documentApi.personalSummary(user.id),
    retry: false,
  })
  const purge = useMutation({
    mutationFn: () => documentApi.purgePersonal(user.id),
    onSuccess: res => {
      toast.success(t('purge.done', { count: res.deleted }))
      qc.invalidateQueries({ queryKey: ['documents'] })
      onClose()
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, t('purge.failed'))),
  })

  const empty = summary && summary.count === 0
  const blocked = summary && !summary.deactivated

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      dismissible={!purge.isPending}
      title={t('purge.title', { name: user.fullName })}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={purge.isPending}>{t('common.close')}</Button>}
          primary={!empty && !blocked && summary ? (
            <Button variant="destructive" onClick={() => purge.mutate()} disabled={purge.isPending}>
              {purge.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {t('purge.confirm', { count: summary.count })}
            </Button>
          ) : undefined}
        />
      }
    >
      {isLoading && <p className="text-sm text-[var(--color-muted-foreground)]">{t('purge.loading')}</p>}
      {isError && <p className="text-sm text-[var(--color-error)]">{getApiErrorMessage(error, t('purge.failed'))}</p>}
      {summary && blocked && <p className="text-sm text-[var(--color-foreground)]">{t('purge.notDeactivated')}</p>}
      {summary && !blocked && empty && <p className="text-sm text-[var(--color-foreground)]">{t('purge.empty')}</p>}
      {summary && !blocked && !empty && (
        <div className="space-y-3 text-sm">
          <p className="text-[var(--color-foreground)]">
            {t('purge.summary', { count: summary.count, size: formatBytes(summary.bytes) })}
          </p>
          <div className="flex gap-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
            <p className="text-[var(--color-foreground)]">{t('purge.warning')}</p>
          </div>
        </div>
      )}
    </Dialog>
  )
}
