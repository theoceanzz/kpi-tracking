import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFormat } from '@/i18n/useFormat'
import { ScoreBlock, TREE_CHILD_ROW, TreeRow, type Tile } from '../detail/treeParts'
import { RatingPill } from '../leaderboard/rankStyle'
import type { UnitCycle, UnitCycleEvaluation, UnitPeriod } from '../../api/unitDetailApi'

/**
 * Sổ đánh giá của một ĐƠN VỊ, dạng cây gập: kỳ → đợt.
 *
 * <p>Cố ý KHÔNG có danh sách KPI như cây của một người: câu hỏi về một đơn vị là "lĩnh vực nào đang
 * kéo lùi", nên mỗi đợt mở ra là %đạt BSC và bốn lĩnh vực, chứ không phải danh sách chỉ tiêu.
 *
 * <p>Khung hàng và ô chỉ số dùng chung với cây của người (`../detail/treeParts`).
 */
export default function UnitEvaluationTree({ cycles }: { cycles: UnitCycle[] }) {
  const { t } = useTranslation('analytics')
  const [open, setOpen] = useState<Set<string>>(() => initialOpen(cycles))
  const toggle = (key: string) => setOpen(prev => {
    const next = new Set(prev)
    if (!next.delete(key)) next.add(key)
    return next
  })

  if (!cycles.length) {
    return <p className="py-8 text-center text-sm text-slate-400">{t('detail.noCycle')}</p>
  }

  return (
    <ul className="space-y-2">
      {cycles.map(c => {
        const key = cycleKey(c)
        const expanded = open.has(key)
        return (
          <li key={key} className="overflow-hidden rounded-widget border border-[var(--color-border)]">
            <TreeRow
              label={c.name ?? t('detail.outOfCycle')}
              expanded={expanded}
              onToggle={() => toggle(key)}
              meta={<CycleMeta evaluation={c.evaluation} />}
              strong
            />
            {expanded && (
              <div className="space-y-3 border-t border-[var(--color-border)] px-3 py-3">
                <CycleScores evaluation={c.evaluation} />
                <ul className="ml-2 space-y-2 border-l border-[var(--color-border)] pl-4">
                  {c.periods.map(p => {
                    const pKey = `p:${p.periodId}`
                    const pOpen = open.has(pKey)
                    return (
                      <li key={p.periodId} className={TREE_CHILD_ROW}>
                        <TreeRow
                          label={p.name ?? '—'}
                          expanded={pOpen}
                          onToggle={() => toggle(pKey)}
                          meta={<PeriodMeta period={p} />}
                        />
                        {pOpen && (
                          <div className="border-t border-[var(--color-border)] px-3 py-3">
                            <PeriodScores period={p} />
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// ============================================================
// Tóm tắt bên phải hàng
// ============================================================

function CycleMeta({ evaluation }: { evaluation?: UnitCycleEvaluation | null }) {
  const { t } = useTranslation('analytics')
  const fmt = useFormat()
  const e = evaluation

  if (!e || (e.managerScore == null && e.matrixRating == null && !e.classification)) {
    return <span className="shrink-0 text-xs text-slate-400">{t('detail.noEval')}</span>
  }
  return (
    <span className="flex shrink-0 items-center gap-3 text-xs text-slate-400">
      {e.memberCount ? <span className="tabular-nums">{t('detail.members', { count: e.memberCount })}</span> : null}
      {e.managerScore != null && <span className="tabular-nums">{fmt.number(e.managerScore)}</span>}
      {e.classification && <RatingPill name={e.classification} color={e.classificationColor} />}
    </span>
  )
}

function PeriodMeta({ period }: { period: UnitPeriod }) {
  const { t } = useTranslation('analytics')
  const fmt = useFormat()

  if (!hasScore(period)) {
    return <span className="shrink-0 text-xs text-slate-400">{t('detail.noEval')}</span>
  }
  return (
    <span className="flex shrink-0 items-center gap-3 text-xs text-slate-400">
      {period.gatePassed === false && (
        <span className="font-semibold text-[var(--color-danger)]">{t('detail.gateFailed')}</span>
      )}
      {period.bscPercent != null && <span className="tabular-nums">{fmt.percent(period.bscPercent)}</span>}
      {period.ratingName && <RatingPill name={period.ratingName} color={period.ratingColor} />}
    </span>
  )
}

// ============================================================
// Khối điểm
// ============================================================

function CycleScores({ evaluation }: { evaluation?: UnitCycleEvaluation | null }) {
  const { t } = useTranslation('analytics')
  const fmt = useFormat()
  const e = evaluation
  const num = (v?: number | null) => (v == null ? null : fmt.number(v))

  return (
    <ScoreBlock
      title={t('detail.cycleEval')}
      tiles={[
        { label: t('detail.selfScore'), value: num(e?.selfScore) },
        { label: t('detail.managerScore'), value: num(e?.managerScore) },
        { label: t('detail.autoScore'), value: num(e?.autoScore) },
        { label: t('detail.qualScore'), value: num(e?.qualScore) },
        { label: t('detail.matrixRating'), value: e?.matrixRating == null ? null : t('detail.matrixValue', { rating: fmt.number(e.matrixRating) }) },
        { label: t('detail.memberCount'), value: e?.memberCount ? fmt.number(e.memberCount) : null },
        {
          label: t('detail.unitClassification'),
          value: e?.classification ?? null,
          accent: e?.classification
            ? <div className="mt-0.5"><RatingPill name={e.classification} color={e.classificationColor} /></div>
            : undefined,
        },
      ]}
      footer={e?.finalizedByName ? (
        <p className="mt-2 text-xs text-slate-400">
          {t('detail.scoredBy')}: {e.finalizedByName}
          {e.finalizedAt ? ` · ${fmt.dateTime(e.finalizedAt)}` : ''}
          {e.comment ? ` · ${e.comment}` : ''}
        </p>
      ) : undefined}
    />
  )
}

/** Đợt của đơn vị: %đạt chung rồi tới từng lĩnh vực BSC — không có KPI. */
function PeriodScores({ period }: { period: UnitPeriod }) {
  const { t } = useTranslation('analytics')
  const fmt = useFormat()

  const tiles: Tile[] = [
    { label: t('detail.bscContribution'), value: period.bscPercent == null ? null : fmt.percent(period.bscPercent) },
    {
      label: t('detail.rating'),
      value: period.ratingName ?? null,
      accent: period.ratingName
        ? <div className="mt-0.5"><RatingPill name={period.ratingName} color={period.ratingColor} /></div>
        : undefined,
    },
    ...period.axes.map(a => ({
      label: a.name ?? a.code ?? '',
      value: a.percent == null ? null : fmt.percent(a.percent),
    })),
  ]

  return (
    <ScoreBlock
      title={t('detail.periodEval')}
      tiles={tiles}
      footer={period.provisional ? (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{t('detail.provisional')}</p>
      ) : undefined}
    />
  )
}

// ============================================================
// Phụ trợ
// ============================================================

function cycleKey(c: UnitCycle) {
  return `c:${c.cycleId ?? 'loose'}`
}

function hasScore(p: UnitPeriod) {
  return p.bscPercent != null || p.axes.some(a => a.percent != null)
}

/** Kỳ có số cuối cùng, cùng đợt có số cuối cùng của chính kỳ đó. */
function initialOpen(cycles: UnitCycle[]): Set<string> {
  const out = new Set<string>()
  for (let i = cycles.length - 1; i >= 0; i--) {
    const c = cycles[i]
    if (!c || !c.periods.some(hasScore)) continue
    out.add(cycleKey(c))
    for (let j = c.periods.length - 1; j >= 0; j--) {
      const p = c.periods[j]
      if (p && hasScore(p)) { out.add(`p:${p.periodId}`); break }
    }
    break
  }
  return out
}
