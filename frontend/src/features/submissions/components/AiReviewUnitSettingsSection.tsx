import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import AiUnitWeightDialog from './AiUnitWeightDialog'
import type { AiWeights } from './aiWeights'
import { useAiReviewUnitSettings, useDeleteAiReviewUnitSetting } from '../hooks/useAiReview'
import type { AiReviewUnitSetting } from '../api/aiReviewApi'

/**
 * Trọng số riêng theo đơn vị — phần dưới của thẻ "AI gợi ý điểm khi chấm" (không còn là thẻ riêng: hai thẻ cùng ba
 * ô % làm người dùng tưởng có hai cấu hình). Luật: công ty tắt thì mọi đơn vị tắt; công ty bật thì đơn vị GẦN NHẤT
 * có dòng ở đây quyết (áp cả đơn vị con); không có thì dùng trọng số mặc định.
 */
export default function AiReviewUnitSettingsSection({ companyWeights, companyEnabled }: {
  companyWeights: AiWeights
  companyEnabled: boolean
}) {
  const { t } = useTranslation('submissions')
  const { data: rows = [], isLoading } = useAiReviewUnitSettings()
  const remove = useDeleteAiReviewUnitSetting()
  const [dialog, setDialog] = useState<{ row?: AiReviewUnitSetting } | null>(null)
  const [removing, setRemoving] = useState<AiReviewUnitSetting | null>(null)
  const taken = new Set(rows.map(r => r.orgUnitId))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-foreground)]">{t('AiUnitWeights.title')}</p>
          <p className="text-sm text-[var(--color-muted-foreground)]">{t('AiUnitWeights.description')}</p>
          {!companyEnabled && (
            <p className="mt-1 text-xs text-[var(--color-warning)]">{t('AiUnitWeights.companyOff')}</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setDialog({})}>
          <Plus aria-hidden="true" /> {t('AiUnitWeights.add')}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="animate-spin text-[var(--color-muted-foreground)]" /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-control border border-dashed border-[var(--color-border)] px-3 py-3 text-sm text-[var(--color-muted-foreground)]">
          {t('AiUnitWeights.empty')}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)] rounded-control border border-[var(--color-border)]">
          {rows.map(r => (
            <li key={r.orgUnitId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium">{r.orgUnitName ?? r.orgUnitId}</span>
              <Badge variant={r.enabled ? 'secondary' : 'warning'}>
                {r.enabled ? t('AiUnitWeights.ownWeights') : t('AiUnitWeights.aiOff')}
              </Badge>
              {r.enabled && (
                <span className="basis-full text-xs text-[var(--color-muted-foreground)] sm:basis-auto">
                  {t('AiUnitWeights.summary', { target: r.weightTarget, quality: r.weightQuality, onTime: r.weightOnTime })}
                </span>
              )}
              <span className="ml-auto flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setDialog({ row: r })}>
                  <Pencil aria-hidden="true" /> {t('AiUnitWeights.edit')}
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={t('AiUnitWeights.removeAria', { unit: r.orgUnitName ?? '' })}
                        onClick={() => setRemoving(r)}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {dialog && (
        <AiUnitWeightDialog
          unit={dialog.row && {
            id: dialog.row.orgUnitId,
            name: dialog.row.orgUnitName ?? dialog.row.orgUnitId,
            enabled: dialog.row.enabled,
            weights: {
              weightTarget: dialog.row.weightTarget,
              weightQuality: dialog.row.weightQuality,
              weightOnTime: dialog.row.weightOnTime,
            },
          }}
          companyWeights={companyWeights}
          taken={taken}
          onClose={() => setDialog(null)}
        />
      )}

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing.orgUnitId, { onSuccess: () => setRemoving(null) })}
        title={t('AiUnitWeights.removeTitle')}
        description={t('AiUnitWeights.removeDescription', { unit: removing?.orgUnitName ?? '' })}
        confirmLabel={t('AiUnitWeights.removeConfirm')}
        loading={remove.isPending}
      />
    </div>
  )
}
