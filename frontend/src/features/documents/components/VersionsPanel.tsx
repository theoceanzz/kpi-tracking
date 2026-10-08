import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, History, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { formatDateTime } from '@/i18n/format'
import { documentFileUrl, documentVersionFileUrl } from '../api/documentApi'
import { useDocumentVersions, useRestoreVersion } from '../hooks/useDocuments'
import type { DocumentVersion, KbDocument } from '../types'
import { formatBytes } from '../utils'

/**
 * Lịch sử phiên bản: mỗi lần "Thay tệp", bản cũ được giữ lại (tối đa 10 bản). Khôi phục một bản cũ không làm mất
 * bản hiện hành — nó lại thành một phiên bản trong danh sách.
 */
export default function VersionsPanel({ doc }: { doc: KbDocument }) {
  const { t } = useTranslation('documents')
  const { data, isLoading } = useDocumentVersions(doc.id, true)
  const restore = useRestoreVersion()
  const [confirm, setConfirm] = useState<DocumentVersion | null>(null)

  if (isLoading) return <LoadingSkeleton type="table" rows={3} />
  const list = data ?? []

  return (
    <div className="space-y-3">
      <p className="text-caption">{t('versions.intro')}</p>
      <ol className="divide-y divide-[var(--color-border)] rounded-card border border-[var(--color-border)]">
        {list.map(v => (
          <li key={v.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-muted)] text-xs font-semibold tabular-nums text-[var(--color-foreground)]">
              v{v.version}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate font-medium text-[var(--color-foreground)]" title={v.fileName}>{v.fileName}</span>
                {v.current && <Badge variant="success">{t('versions.current')}</Badge>}
              </span>
              <span className="block truncate text-caption">
                {formatBytes(v.fileSize)} · {formatDateTime(v.createdAt)}
                {!v.current && v.createdByName ? ` · ${t('versions.replacedBy', { name: v.createdByName })}` : ''}
              </span>
            </span>
            <Button asChild variant="ghost" size="icon-sm" aria-label={t('actions.download')} title={t('actions.download')}>
              <a href={v.current ? documentFileUrl(doc.id) : documentVersionFileUrl(doc.id, v.id)} download><Download aria-hidden="true" /></a>
            </Button>
            {!v.current && (
              <Button variant="ghost" size="icon-sm" aria-label={t('versions.restore')} title={t('versions.restore')}
                      onClick={() => setConfirm(v)} disabled={restore.isPending}>
                <RotateCcw aria-hidden="true" />
              </Button>
            )}
          </li>
        ))}
      </ol>
      {list.length <= 1 && (
        <p className="flex items-center gap-1.5 text-caption"><History size={13} aria-hidden="true" />{t('versions.none')}</p>
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && restore.mutate({ id: doc.id, versionId: confirm.id }, { onSuccess: () => setConfirm(null) })}
        title={t('versions.confirmTitle', { version: confirm?.version ?? '' })}
        description={t('versions.confirmDescription')}
        confirmLabel={t('versions.restore')}
        loading={restore.isPending}
      />
    </div>
  )
}
