import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Bot, Edit3, Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { InfoHint } from '@/components/common/InfoHint'
import { useFormat } from '@/i18n/useFormat'
import AiReviewUnitSettingsSection from './AiReviewUnitSettingsSection'
import { useAiReviewSettings, useUpdateAiReviewSettings } from '../hooks/useAiReview'
import type { AiReviewLevel } from '../api/aiReviewApi'
import { tourAnchor } from '@/components/common/tours/anchors'

/** Cùng dải màu mặc định với thang định lượng / định tính (thấp → cao). */
const DEFAULT_COLORS = ['#ef4444', '#f59e0b', '#6366f1', '#3b82f6', '#10b981']

/** Thang mặc định: 5 mức trên thang 10, chữ theo ngôn ngữ đang dùng. */
function defaultLevels(t: TFunction): AiReviewLevel[] {
  return (['poor', 'weak', 'average', 'fair', 'good'] as const).map((k, i) => ({
    name: t(`AiScale.defaults.${k}.name`),
    description: t(`AiScale.defaults.${k}.description`),
    points: i * 2.5,
    color: DEFAULT_COLORS[i],
  }))
}

/** Cùng luật với máy chủ (`SubmissionReviewService.updateSettings`): 2–10 mức, tên không trùng, mức cao nhất > 0. */
function scaleError(levels: AiReviewLevel[], t: TFunction): string | null {
  if (levels.length < 2 || levels.length > 10) return t('AiScale.errors.count')
  if (levels.some(l => !l.name.trim())) return t('AiScale.errors.name')
  const names = levels.map(l => l.name.trim().toLowerCase())
  if (new Set(names).size !== names.length) return t('AiScale.errors.duplicate')
  if (levels.some(l => !(l.points >= 0) || l.points > 1000)) return t('AiScale.errors.points')
  if (Math.max(...levels.map(l => l.points)) <= 0) return t('AiScale.errors.top')
  return null
}

/**
 * Một thẻ duy nhất cho "AI gợi ý điểm khi chấm": bật/tắt cho công ty, THANG ĐIỂM AI (các mức AI chọn khi chấm chất
 * lượng bài nộp — điểm AI = điểm của mức, tối đa = mức cao nhất), rồi danh sách đơn vị tắt AI. Thang sửa theo đúng nếp
 * màn "Thang điểm" định lượng / định tính. Chỉ người có quyền `AI_REVIEW:CONFIG` sửa được.
 */
export default function AiReviewSettingsSection() {
  const { t } = useTranslation('submissions')
  const fmt = useFormat()
  const { hasPermission } = useHasPermission()
  const canConfig = hasPermission('AI_REVIEW:CONFIG')
  const { data, isLoading } = useAiReviewSettings(canConfig)
  const save = useUpdateAiReviewSettings()
  // null = đang xem; mảng = đang sửa (bản nháp).
  const [editing, setEditing] = useState<AiReviewLevel[] | null>(null)

  if (!canConfig) return null
  if (isLoading || !data) {
    return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[var(--color-muted-foreground)]" /></div>
  }

  const levels = data.levels ?? []
  const max = Math.max(0, ...levels.map(l => l.points))
  const error = editing ? scaleError(editing, t) : null
  const setRow = (i: number, patch: Partial<AiReviewLevel>) =>
    setEditing(rows => rows && rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const saveLevels = (next: AiReviewLevel[]) =>
    save.mutate({ enabled: data.enabled, levels: [...next].sort((a, b) => a.points - b.points) },
      { onSuccess: () => setEditing(null) })

  return (
    <div {...tourAnchor('aireview.settings')} className="space-y-5 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Bot size={20} className="mt-0.5 text-[var(--color-ai)]" aria-hidden="true" />
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-foreground)]">
              {t('AiReviewSettings.title')}
              <InfoHint>{t('AiReviewSettings.titleHint')}</InfoHint>
            </p>
            <p className="text-sm text-[var(--color-muted-foreground)]">{t('AiReviewSettings.subtitle')}</p>
          </div>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
          {data.enabled ? t('AiReviewSettings.on') : t('AiReviewSettings.off')}
          <Switch {...tourAnchor('aireview.toggle')} checked={data.enabled} disabled={save.isPending || levels.length < 2}
                  onCheckedChange={enabled => save.mutate({ enabled, levels })}
                  aria-label={t('AiReviewSettings.toggleAria')} />
        </label>
      </div>

      <section {...tourAnchor('aireview.weights')} className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-foreground)]">
              {t('AiScale.title')}
              <InfoHint>{t('AiScale.hint')}</InfoHint>
            </p>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {levels.length ? t('AiScale.description', { max: fmt.number(max) }) : t('AiScale.empty')}
            </p>
          </div>
          {!editing && (
            <div className="flex gap-2">
              <Button variant="outline" size="icon" disabled={save.isPending} onClick={() => saveLevels(defaultLevels(t))}
                      aria-label={t('AiScale.reset')} title={t('AiScale.reset')}>
                <RotateCcw aria-hidden="true" />
              </Button>
              <Button {...tourAnchor('aireview.save')} onClick={() => setEditing(levels.length ? levels : defaultLevels(t))}>
                <Edit3 aria-hidden="true" /> {t('AiScale.edit')}
              </Button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            <div className="hidden grid-cols-[minmax(0,10rem)_6rem_3.5rem_minmax(0,1fr)_2.25rem] gap-3 px-1 sm:grid">
              <span className="text-eyebrow">{t('AiScale.name')}</span>
              <span className="text-eyebrow">{t('AiScale.points')}</span>
              <span className="text-eyebrow">{t('AiScale.color')}</span>
              <span className="text-eyebrow">{t('AiScale.levelDescription')}</span>
              <span className="sr-only">{t('AiScale.remove')}</span>
            </div>
            <ol className="space-y-2">
              {editing.map((l, i) => (
                <li key={i} className="grid grid-cols-[1fr_6rem_3.5rem_2.25rem] items-center gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] p-3 sm:grid-cols-[minmax(0,10rem)_6rem_3.5rem_minmax(0,1fr)_2.25rem] sm:border-0 sm:bg-transparent sm:p-0 sm:px-1">
                  <Input size="sm" value={l.name} onChange={e => setRow(i, { name: e.target.value })}
                         aria-label={t('AiScale.nameOf', { n: i + 1 })} />
                  <Input size="sm" type="number" min={0} max={1000} step="any" value={Number.isNaN(l.points) ? '' : l.points}
                         onChange={e => setRow(i, { points: e.target.value === '' ? Number.NaN : Number(e.target.value) })}
                         onWheel={e => e.currentTarget.blur()} inputClassName="tabular-nums"
                         aria-label={t('AiScale.pointsOf', { n: i + 1 })} />
                  <input type="color" value={l.color ?? DEFAULT_COLORS[2]} onChange={e => setRow(i, { color: e.target.value })}
                         className="h-8 w-full cursor-pointer rounded-control border border-[var(--color-border)] bg-[var(--color-card)] p-0.5"
                         aria-label={t('AiScale.colorOf', { n: i + 1 })} />
                  <Input size="sm" value={l.description ?? ''} onChange={e => setRow(i, { description: e.target.value })}
                         placeholder={t('AiScale.descriptionPlaceholder')} className="col-span-3 sm:col-span-1 sm:order-none order-last"
                         aria-label={t('AiScale.descriptionOf', { n: i + 1 })} />
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditing(rows => rows && rows.filter((_, j) => j !== i))}
                          aria-label={t('AiScale.removeOf', { n: i + 1 })} title={t('AiScale.remove')}
                          className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]">
                    <Trash2 aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ol>
            {editing.length < 10 && (
              <Button variant="outline" size="sm" type="button" className="w-full border-dashed"
                      onClick={() => setEditing(rows => rows && [...rows, { name: '', points: Math.max(0, ...rows.map(r => r.points || 0)) + 1, color: DEFAULT_COLORS[4], description: '' }])}>
                <Plus aria-hidden="true" /> {t('AiScale.add')}
              </Button>
            )}
            {error && <p className="text-xs font-medium text-[var(--color-error)]">{error}</p>}
            <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-3">
              <Button variant="outline" disabled={save.isPending} onClick={() => setEditing(null)}>{t('AiReviewSettings.discard')}</Button>
              <Button {...tourAnchor('aireview.save')} disabled={!!error || save.isPending} onClick={() => saveLevels(editing)}>
                {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />} {t('AiReviewSettings.save')}
              </Button>
            </div>
          </div>
        ) : levels.length > 0 && (
          <ol className="divide-y divide-[var(--color-border)] overflow-hidden rounded-card border border-[var(--color-border)]">
            {levels.map(l => (
              <li key={l.name} className="flex items-center gap-3 px-4 py-2.5">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: l.color || '#cbd5e1' }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--color-foreground)]">{l.name}</span>
                  {l.description && <span className="block truncate text-xs text-[var(--color-muted-foreground)]" title={l.description}>{l.description}</span>}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-[var(--color-muted-foreground)]">
                  <span className="font-medium text-[var(--color-foreground)]">{fmt.number(l.points)}</span> {t('AiScale.pointsUnit')}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="border-t border-[var(--color-border)] pt-5">
        <AiReviewUnitSettingsSection companyEnabled={data.enabled} />
      </div>
    </div>
  )
}
