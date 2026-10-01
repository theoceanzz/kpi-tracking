import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { formatDateTime } from '@/i18n/format'
import { documentFileUrl } from '../api/documentApi'
import { useToggleDocumentAi } from '../hooks/useDocuments'
import type { DocumentScope, KbDocument } from '../types'
import { AiStatusBadge, FileTypeIcon } from './docUi'
import { formatBytes } from '../utils'

interface Props {
  docs: KbDocument[]
  scope: DocumentScope
  onOpen: (doc: KbDocument) => void
}

/**
 * Bảng tài liệu. Cột thứ ba đổi theo tab: tab Đơn vị hiện đơn vị (để thấy tài liệu kế thừa từ đâu), hai tab kia
 * hiện người tải. Bấm dòng mở drawer; công tắc "Dùng cho AI" bật/tắt ngay tại chỗ khi được sửa.
 */
export default function DocumentTable({ docs, scope, onOpen }: Props) {
  const { t } = useTranslation('documents')
  const toggle = useToggleDocumentAi()

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left">
            <th scope="col" className="px-4 py-2.5 text-eyebrow">{t('table.name')}</th>
            <th scope="col" className="px-3 py-2.5 text-eyebrow">{t('table.category')}</th>
            <th scope="col" className="px-3 py-2.5 text-eyebrow">{scope === 'UNIT' ? t('table.unit') : t('table.uploadedBy')}</th>
            <th scope="col" className="px-3 py-2.5 text-eyebrow">{t('table.updated')}</th>
            <th scope="col" className="px-3 py-2.5 text-right text-eyebrow">{t('table.size')}</th>
            <th scope="col" className="px-3 py-2.5 text-eyebrow">{t('table.ai')}</th>
            <th scope="col" className="px-3 py-2.5"><span className="sr-only">{t('table.actions')}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {docs.map(d => (
            <tr key={d.id} onClick={() => onOpen(d)} className="cursor-pointer transition-colors hover:bg-[var(--color-muted)]">
              <td className="px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileTypeIcon doc={d} />
                  <div className="min-w-0">
                    <p className="max-w-[340px] truncate font-medium text-[var(--color-foreground)]" title={d.title}>{d.title}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {d.fileName && <span className="max-w-[260px] truncate text-caption" title={d.fileName}>{d.fileName}</span>}
                      {d.legacy && <Badge variant="warning">{t('badge.noOriginal')}</Badge>}
                      {d.inherited && <Badge variant="info">{t('badge.inherited', { unit: d.orgUnitName ?? '' })}</Badge>}
                      {d.orphan && <Badge variant="destructive">{t('badge.orphan')}</Badge>}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-[var(--color-muted-foreground)]">{t(`category.${d.category}`)}</td>
              <td className="px-3 py-3">
                <span className="block max-w-[200px] truncate text-[var(--color-muted-foreground)]">
                  {scope === 'UNIT' ? (d.orgUnitName ?? '—') : (d.createdByName ?? '—')}
                </span>
              </td>
              <td className="px-3 py-3 whitespace-nowrap tabular-nums text-[var(--color-muted-foreground)]">{formatDateTime(d.updatedAt)}</td>
              <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums text-[var(--color-muted-foreground)]">{formatBytes(d.fileSize)}</td>
              <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  {d.canEdit && !d.legacy && (
                    <Switch
                      size="sm"
                      checked={d.aiEnabled}
                      disabled={toggle.isPending}
                      onCheckedChange={v => toggle.mutate({ id: d.id, aiEnabled: v })}
                      aria-label={t('fields.aiEnabled')}
                    />
                  )}
                  <AiStatusBadge status={d.aiStatus} error={d.aiError} />
                </div>
              </td>
              <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                {!d.legacy && (
                  <Button asChild variant="ghost" size="icon-sm" aria-label={t('actions.download')} title={t('actions.download')}>
                    <a href={documentFileUrl(d.id)} download><Download aria-hidden="true" /></a>
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
