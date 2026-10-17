import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScoreBlock, TREE_CHILD_ROW, TreeRow } from '../detail/treeParts'
import { useFormat } from '@/i18n/useFormat'
import { RatingPill } from '../leaderboard/rankStyle'
import type { CycleEvaluation, EvaluatorScore, PersonCycle, PersonPeriod } from '../../api/personDetailApi'

/**
 * Sổ đánh giá của một người, dạng CÂY GẬP: kỳ → đợt → KPI.
 *
 * <p>Thay cho một bảng KPI phẳng trộn lẫn mọi đợt — bảng đó nói được "họ gánh gì" nhưng không nói
 * được trong một đợt họ bị chấm bao nhiêu và ai chấm, mà đó mới là câu hỏi người xem mở trang này
 * để hỏi.
 *
 * <p>Cây chứ không phải tab: tab chỉ cho thấy MỘT kỳ một lúc và che mất việc so kỳ này với kỳ kia,
 * còn cây thì mọi kỳ nằm sẵn đó, mỗi hàng đã mang đủ % hoàn thành và xếp loại để quyết định có cần
 * mở ra không, và mở được nhiều nhánh cùng lúc.
 */
export default function PersonEvaluationTree({ cycles }: { cycles: PersonCycle[] }) {
  const { t } = useTranslation('analytics')
  // Mở sẵn nhánh MỚI NHẤT CÓ SỐ: tổ chức nào cũng có kỳ vừa mở chưa ai chấm, mở thẳng vào đó thì
  // cả khối trông như chưa có dữ liệu.
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
                {/* Nét dọc của cây; mỗi đợt tự kẻ nét ngang nối vào nét này. */}
                <ul className="ml-2 space-y-2 border-l border-[var(--color-border)] pl-4">
                  {c.periods.map(p => {
                    const pKey = `p:${p.periodId}`
                    const pOpen = open.has(pKey)
                    return (
                      <li
                        key={p.periodId}
                        className={TREE_CHILD_ROW}
                      >
                        <TreeRow
                          label={p.name ?? '—'}
                          expanded={pOpen}
                          onToggle={() => toggle(pKey)}
                          meta={<PeriodMeta period={p} />}
                        />
                        {pOpen && (
                          <div className="space-y-4 border-t border-[var(--color-border)] px-3 py-3">
                            <PeriodScores period={p} />
                            <PeriodKpis period={p} />
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
// Hàng của cây
function CycleMeta({ evaluation }: { evaluation?: CycleEvaluation | null }) {
  const { t } = useTranslation('analytics')
  const fmt = useFormat()
  const e = evaluation

  if (!e || (e.avgCompletionPercent == null && e.finalScore == null && e.matrixRating == null)) {
    return <span className="shrink-0 text-xs text-slate-400">{t('detail.noEval')}</span>
  }
  return (
    <span className="flex shrink-0 items-center gap-3 text-xs text-slate-400">
      {e.avgCompletionPercent != null && (
        <span className="tabular-nums">{fmt.percent(e.avgCompletionPercent)}</span>
      )}
      {e.finalScore != null && (
        <span className="tabular-nums">{t('detail.finalScore')} {fmt.number(e.finalScore)}</span>
      )}
      {e.matrixRating != null && (
        <span className="tabular-nums">{t('detail.matrixValue', { rating: e.matrixRating })}</span>
      )}
    </span>
  )
}

function PeriodMeta({ period }: { period: PersonPeriod }) {
  const { t } = useTranslation('analytics')
  const fmt = useFormat()

  if (!hasScore(period)) {
    return <span className="shrink-0 text-xs text-slate-400">{t('detail.noEval')}</span>
  }
  return (
    <span className="flex shrink-0 items-center gap-3 text-xs text-slate-400">
      {period.kpis.length > 0 && (
        <span className="tabular-nums">{t('detail.kpiCount', { count: period.kpis.length })}</span>
      )}
      {period.completionPercent != null && (
        <span className="tabular-nums">{fmt.percent(period.completionPercent)}</span>
      )}
      {period.ratingName && <RatingPill name={period.ratingName} color={period.ratingColor} />}
    </span>
  )
}

// ============================================================
// Khối điểm
function CycleScores({ evaluation }: { evaluation?: CycleEvaluation | null }) {
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
        { label: t('detail.finalScore'), value: num(e?.finalScore) },
        { label: t('detail.qualScore'), value: num(e?.qualScore) },
        { label: t('detail.matrixRating'), value: e?.matrixRating == null ? null : t('detail.matrixValue', { rating: e.matrixRating }) },
        { label: t('detail.completionPercent'), value: e?.avgCompletionPercent == null ? null : fmt.percent(e.avgCompletionPercent) },
        {
          label: t('detail.conductShort'),
          value: e?.conductScore == null ? null
            : `${fmt.number(e.conductScore)}${e.conductMaxScore ? `/${fmt.number(e.conductMaxScore)}` : ''}`,
        },
        { label: t('detail.feedback360'), value: num(e?.feedback360Score) },
      ]}
      footer={e?.evaluatedByName ? (
        <p className="mt-2 text-xs text-slate-400">
          {t('detail.scoredBy')}: {e.evaluatedByName}
          {e.evaluatedAt ? ` · ${fmt.dateTime(e.evaluatedAt)}` : ''}
          {e.comment ? ` · ${e.comment}` : ''}
        </p>
      ) : undefined}
    />
  )
}

function PeriodScores({ period }: { period: PersonPeriod }) {
  const { t } = useTranslation('analytics')
  const fmt = useFormat()
  const num = (v?: number | null) => (v == null ? null : fmt.number(v))

  return (
    <ScoreBlock
      title={t('detail.periodEval')}
      tiles={[
        { label: t('detail.completionPercent'), value: period.completionPercent == null ? null : fmt.percent(period.completionPercent) },
        { label: t('detail.selfScore'), value: num(period.selfScore) },
        { label: t('detail.managerScore'), value: num(period.managerScore) },
        { label: t('detail.quantScore'), value: num(period.quantScore) },
        { label: t('detail.qualScore'), value: num(period.qualScore) },
        {
          label: t('detail.rating'),
          value: period.ratingName ?? null,
          accent: period.ratingName
            ? <div className="mt-0.5"><RatingPill name={period.ratingName} color={period.ratingColor} /></div>
            : undefined,
        },
      ]}
      footer={<EvaluatorList rows={period.evaluators} />}
    />
  )
}

/** Ai chấm đợt này — mỗi người một dòng, theo thứ tự chấm (quản lý trước, cấp trên sau). */
function EvaluatorList({ rows }: { rows: EvaluatorScore[] }) {
  const { t } = useTranslation('analytics')
  const fmt = useFormat()

  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {t('detail.evaluators')}
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">{t('detail.noEvaluator')}</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map(r => (
            <li
              key={`${r.evaluatorId}`}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-control bg-[var(--color-muted)] px-3 py-1.5 text-sm"
            >
              <span className="font-medium text-[var(--color-foreground)]">{r.evaluatorName ?? '—'}</span>
              <span className="text-xs text-slate-400">
                {r.self ? t('detail.selfTag') : r.evaluatorRoleName ?? ''}
              </span>
              <span className="ml-auto tabular-nums text-[var(--color-foreground)]">
                {r.score == null ? t('detail.notScored') : fmt.number(r.score)}
              </span>
              {r.kpiCompletionPercent != null && (
                <span className="tabular-nums text-xs text-slate-400">· {fmt.percent(r.kpiCompletionPercent)}</span>
              )}
              {r.comment && <span className="w-full truncate text-xs text-slate-400" title={r.comment}>{r.comment}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ============================================================
// KPI của đợt
// ============================================================

function PeriodKpis({ period }: { period: PersonPeriod }) {
  const { t } = useTranslation('analytics')
  const fmt = useFormat()

  return (
    <section>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {t('detail.kpiOfPeriod')}
      </p>
      {period.kpis.length === 0 ? (
        <p className="rounded-widget border border-dashed border-[var(--color-border)] px-3 py-4 text-center text-sm text-slate-400">
          {t('detail.noKpiInPeriod')}
        </p>
      ) : (
        <div className="overflow-auto custom-scrollbar">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 text-left">{t('detail.kpiName')}</th>
                <th className="px-3 py-2 text-right">{t('detail.weight')}</th>
                <th className="px-3 py-2 text-right">{t('detail.actualTarget')}</th>
                <th className="px-3 py-2 text-right">{t('detail.attainment')}</th>
              </tr>
            </thead>
            <tbody>
              {period.kpis.map(k => (
                <tr key={k.kpiId} className="border-t border-[var(--color-border)]">
                  <td className="max-w-[26rem] truncate px-3 py-2 text-sm text-[var(--color-foreground)]" title={k.name ?? undefined}>
                    {k.name}
                  </td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-400">
                    {k.weight == null ? '—' : fmt.percent(k.weight)}
                  </td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-400">
                    {k.actualValue == null && k.targetValue == null ? '—'
                      : `${k.actualValue == null ? '—' : fmt.number(k.actualValue)} / ${k.targetValue == null ? '—' : fmt.number(k.targetValue)}${k.unit ? ` ${k.unit}` : ''}`}
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-[var(--color-foreground)]">
                    {k.attainmentPercent == null ? t('detail.notScored') : fmt.percent(k.attainmentPercent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ============================================================
// Phụ trợ
// ============================================================

function cycleKey(c: PersonCycle) {
  return `c:${c.cycleId ?? 'loose'}`
}

function hasScore(p: PersonPeriod) {
  return p.completionPercent != null || p.managerScore != null || p.evaluators.length > 0
}

/** Kỳ có số cuối cùng, cùng đợt có số cuối cùng của chính kỳ đó. */
function initialOpen(cycles: PersonCycle[]): Set<string> {
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
