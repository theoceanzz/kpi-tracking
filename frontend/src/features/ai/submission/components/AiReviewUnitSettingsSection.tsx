import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import AiUnitOffDialog from './AiUnitOffDialog'
import { useAiReviewUnitSettings, useDeleteAiReviewUnitSetting } from '../hooks/useAiReview'
import type { AiReviewUnitSetting } from '../api/aiReviewApi'

/**
 * Đơn vị tắt AI — phần dưới của thẻ "AI gợi ý điểm khi chấm". Công ty tắt thì mọi đơn vị tắt; công ty bật thì đơn vị
 * có dòng ở đây (và đơn vị con) tắt. Từ 13/10 không còn trọng số riêng.
 */
export default function AiReviewUnitSettingsSection({ companyEnabled }: { companyEnabled: boolean }) {
  const { t } = useTranslation('submissions')
  const { data: rows = [], isLoading } = useAiReviewUnitSettings()
  const remove = useDeleteAiReviewUnitSetting()
  const [adding, setAdding] = useState(false)
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
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
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
              <Badge variant="warning">{t('AiUnitWeights.aiOff')}</Badge>
              <span className="ml-auto flex gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={t('AiUnitWeights.removeAria', { unit: r.orgUnitName ?? '' })}
                        onClick={() => setRemoving(r)}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {adding && <AiUnitOffDialog taken={taken} onClose={() => setAdding(false)} />}

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
