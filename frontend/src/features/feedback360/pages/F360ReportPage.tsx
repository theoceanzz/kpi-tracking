import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, EyeOff, Lightbulb, MessageSquareQuote, Printer, RefreshCw, Scale, ShieldAlert, TrendingDown, TrendingUp, UserX } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import UserAvatar from '@/components/common/UserAvatar'
import DumbbellDotPlot from '@/components/charts/primitives/DumbbellDotPlot'
import ChartTooltip from '@/components/charts/ChartTooltip'
import { xAxisLabel } from '@/components/charts/axisLabel'
import { AXIS_COLORS, seriesColor } from '@/components/charts/chartPalette'
import { getApiErrorMessage } from '@/lib/apiError'
import type { F360Report, F360Result } from '../api/feedback360Api'
import { useF360CampaignMutations, useF360HideAnswer, useF360Report } from '../hooks/useFeedback360'
import { CampaignStatusBadge } from '../components/F360Common'
import { fmtDate, fmtScore } from '../utils/f360Format'
import { useTranslation } from 'react-i18next'

/**
 * Báo cáo 360 của một người. Mọi số đã qua ngưỡng ẩn danh ở backend — trang này chỉ trình bày,
 * không tự tính lại gì từ dữ liệu thô (vốn không bao giờ được gửi xuống).
 */
export default function F360ReportPage() {
  const { t } = useTranslation('feedback360')
  const { subjectId = '' } = useParams()
  const navigate = useNavigate()
  const { data: report, isLoading, error } = useF360Report(subjectId)
  const hide = useF360HideAnswer(subjectId)
  const campaignMutations = useF360CampaignMutations()
  const [hiding, setHiding] = useState<{ id: string; text: string } | null>(null)
  const [reason, setReason] = useState('')

  if (isLoading) return <div className="mx-auto max-w-5xl p-4"><LoadingSkeleton rows={8} /></div>
  if (error || !report) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <EmptyState icon={UserX} title={t('F360ReportPage.cannotViewTheReport')} description={getApiErrorMessage(error, t('F360ReportPage.theReportHasNotBeenPublished'))}
          action={<Button variant="outline" onClick={() => navigate(-1)}>{t('F360ReportPage.back')}</Button>} />
      </div>
    )
  }

  const r = report.result
  const back = report.selfView ? '/me?section=my-feedback360' : `/performance?section=feedback360&campaign=${report.campaignId}`

  // "Xuất PDF" = lệnh in của trình duyệt với CSS in riêng (index.css, .f360-print-root): không thêm
  // thư viện PDF, và bản in giống hệt thứ người xem đang thấy — đã qua ngưỡng ẩn danh.
  const print = () => {
    document.body.classList.add('f360-printing')
    const done = () => {
      document.body.classList.remove('f360-printing')
      window.removeEventListener('afterprint', done)
    }
    window.addEventListener('afterprint', done)
    window.print()
  }

  return (
    <div className="f360-print-root mx-auto max-w-5xl space-y-4 pb-16">
      <div className="f360-no-print flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm"><Link to={back}><ArrowLeft /> {t('F360ReportPage.back')}</Link></Button>
        <Button variant="outline" size="sm" onClick={print}><Printer /> {t('F360ReportPage.exportPdf')}</Button>
      </div>

      <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="flex flex-wrap items-center gap-4">
          <UserAvatar fullName={report.fullName} avatarUrl={report.avatarUrl} className="h-14 w-14 rounded-full text-lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-page-title">{t('F360ReportPage.n360Report')} {report.fullName}</h1>
            <p className="text-caption">
              {report.orgUnitName ?? ''} · {report.campaignName} {t('F360ReportPage.closed')} {fmtDate(report.closedAt)}
            </p>
          </div>
          <CampaignStatusBadge status={report.campaignStatus} />
        </div>
        {r && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label={t('F360ReportPage.othersAssessment')} value={`${fmtScore(r.othersScore)}/${r.scaleMax}`} />
            <Tile label={t('F360ReportPage.selfAssessment')} value={r.selfScore != null ? `${fmtScore(r.selfScore)}/${r.scaleMax}` : '-'} />
            <Tile label={t('F360ReportPage.n360Score')} value={`${fmtScore(r.overallScore)}/${r.scaleMax}`} />
            <Tile label={t('F360ReportPage.respondents')} value={r.responseCount} />
          </div>
        )}
      </div>

      {!r && (
        <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
          <EmptyState icon={ShieldAlert} title={t('F360ReportPage.noResultsYet')} description={t('F360ReportPage.resultsAreComputedWhenTheCampaign')} />
        </div>
      )}

      {r && (
        <>
          {r.insufficient && (
            <Notice tone="warning">
              {t('F360ReportPage.notEnoughResponsesFromOthersTo')} {r.anonymityThreshold} {t('F360ReportPage.peoplePerGroupAreNeeded')}
            </Notice>
          )}
          <GroupsNotice result={r} />

          <CompetencyGapCard result={r} />
          {report.comparison && <ComparisonCard result={r} comparison={report.comparison} />}
          <GroupCompareCard result={r} />

          <div className="grid gap-4 md:grid-cols-2">
            <HighlightCard title={t('F360ReportPage.ratedHighest')} icon={<TrendingUp size={16} className="text-slate-400" />} items={r.top} scaleMax={r.scaleMax} />
            <HighlightCard title={t('F360ReportPage.mostInNeedOfDevelopment')} icon={<TrendingDown size={16} className="text-slate-400" />} items={r.bottom} scaleMax={r.scaleMax} />
          </div>

          {(r.blindSpots.length > 0 || r.hiddenStrengths.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              <GapList title={t('F360ReportPage.blindSpotYouRateYourselfHigher')} items={r.blindSpots} />
              <GapList title={t('F360ReportPage.hiddenStrengthOthersRateYouHigher')} items={r.hiddenStrengths} />
            </div>
          )}
        </>
      )}

      {(report.aiSummary || report.canHideComments) && (
        <Card title={t('F360ReportPage.commentSummary')} icon={<Lightbulb size={16} className="text-slate-400" />}>
          {report.aiSummary
            ? <p className="whitespace-pre-line text-sm">{report.aiSummary.replace(/\*\*/g, '')}</p>
            : <p className="text-sm text-[var(--color-muted-foreground)]">{t('F360ReportPage.noSummaryYetTheCampaignHas')}</p>}
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-caption">{t('F360ReportPage.aiGeneratedForReferenceOnly')}</p>
            {report.canHideComments && (
              <Button size="sm" variant="ghost" className="f360-no-print" disabled={campaignMutations.regenerateSummary.isPending}
                onClick={() => campaignMutations.regenerateSummary.mutate({ id: report.campaignId, subjectId: report.subjectId })}>
                <RefreshCw /> {t('F360ReportPage.regenerate')}
              </Button>
            )}
          </div>
        </Card>
      )}

      <Card title={t('F360ReportPage.comments')} icon={<MessageSquareQuote size={16} className="text-slate-400" />}>
        <p className="mb-3 text-caption">{t('F360ReportPage.shownWithoutTheWritersNameAnd')}</p>
        {report.comments.length === 0 && <p className="text-sm text-[var(--color-muted-foreground)]">{t('F360ReportPage.noCommentsYet')}</p>}
        <div className="space-y-5">
          {report.comments.map(block => (
            <div key={block.questionId} className="space-y-2">
              <h4 className="text-sm font-semibold">{block.question}</h4>
              <ul className="space-y-2">
                {block.items.map(c => (
                  <li key={c.id} className={`rounded-control border border-[var(--color-border)] p-3 text-sm ${c.hidden ? 'opacity-50' : ''}`}>
                    <p className="whitespace-pre-line">{c.text}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="secondary">{c.groupLabel}</Badge>
                      {c.hidden && <Badge variant="warning"><EyeOff size={10} /> {t('F360ReportPage.hidden')}</Badge>}
                      {report.canHideComments && !c.hidden && (
                        <Button size="sm" variant="ghost" className="f360-no-print ml-auto" onClick={() => { setHiding({ id: c.id, text: c.text }); setReason('') }}>
                          <EyeOff /> {t('F360ReportPage.hide')}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {hiding && (
        <Dialog open onClose={() => setHiding(null)} size="sm" title={t('F360ReportPage.hideInappropriateComment')}
          description={t('F360ReportPage.theCommentIsHiddenFromThe')}
          footer={<DialogFooter
            secondary={<Button variant="outline" onClick={() => setHiding(null)}>{t('F360ReportPage.cancel')}</Button>}
            primary={<Button disabled={!reason.trim() || hide.isPending}
              onClick={() => hide.mutate({ answerId: hiding.id, reason: reason.trim() }, { onSuccess: () => setHiding(null) })}>
              {t('F360ReportPage.hideComment')}
            </Button>}
          />}>
          <p className="mb-3 line-clamp-3 text-sm text-[var(--color-muted-foreground)]">"{hiding.text}"</p>
          <Input value={reason} onChange={e => setReason(e.target.value)} placeholder={t('F360ReportPage.reasonRequired')} />
        </Dialog>
      )}
    </div>
  )
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-control bg-[var(--color-muted)] px-3 py-2">
      <p className="text-caption">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">{icon}{title}</h3>
      {children}
    </section>
  )
}

function Notice({ tone, children }: { tone: 'warning' | 'info'; children: React.ReactNode }) {
  const cls = tone === 'warning'
    ? 'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
    : 'border-[var(--color-info-border)] bg-[var(--color-info-bg)] text-[var(--color-info)]'
  return <p className={`flex items-start gap-2 rounded-card border p-3 text-sm ${cls}`}><ShieldAlert size={16} className="mt-0.5 shrink-0" /><span>{children}</span></p>
}

/** Nói rõ nhóm nào bị gộp/ẩn — người đọc cần biết vì sao không thấy cột "Đồng nghiệp". */
function GroupsNotice({ result }: { result: F360Result }) {
  const { t } = useTranslation('feedback360')
  const hidden = result.groups.filter(g => !g.visible)
  const merged = result.groups.find(g => g.key === 'OTHERS' && g.visible)
  if (hidden.length === 0 && !merged) return null
  return (
    <Notice tone="info">
      {merged && <>{t('F360ReportPage.theOthersGroupMergesGroupsWith')} {result.anonymityThreshold} {t('F360ReportPage.peopleToKeepAnonymity')} </>}
      {hidden.length > 0 && <>{t('F360ReportPage.someResponsesDoNotReach')} {result.anonymityThreshold} {t('F360ReportPage.peopleSoTheyAreNotIncluded')}</>}
    </Notice>
  )
}

/** So tự đánh giá với người khác theo từng năng lực — độ dài đoạn nối là khoảng lệch. */
function CompetencyGapCard({ result }: { result: F360Result }) {
  const { t } = useTranslation('feedback360')
  const both = result.competencies.filter(c => c.self != null && c.others != null)
  const othersOnly = result.competencies.filter(c => c.others != null)
  if (othersOnly.length === 0) return null

  if (both.length === 0) {
    // Không có tự đánh giá: chỉ một chuỗi, dùng cột theo năng lực.
    return (
      <Card title={t('F360ReportPage.eachCompetencyOthersScores')}>
        <SimpleCompetencyBars result={result} />
      </Card>
    )
  }
  return (
    <Card title={t('F360ReportPage.eachCompetencySelfAssessmentVsOthers')}>
      <DumbbellDotPlot
        data={both.map(c => ({ id: c.key, name: c.name, from: c.self!, to: c.others!, subText: c.divergent ? t('F360ReportPage.dividedOpinions') : undefined }))}
        fromLabel={t('F360ReportPage.selfAssessment')}
        toLabel={t('F360ReportPage.others')}
        xLabel={t('F360ReportPage.scoreScale1', { scaleMax: result.scaleMax })}
        domainMax={result.scaleMax}
      />
      {both.some(c => c.divergent) && (
        <p className="mt-2 text-caption">
          {t('F360ReportPage.dividedOpinionsOn')} {both.filter(c => c.divergent).map(c => c.name).join(', ')}{t('F360ReportPage.averageScoresForTheseCompetenciesShould')}
        </p>
      )}
    </Card>
  )
}

function SimpleCompetencyBars({ result }: { result: F360Result }) {
  const { t } = useTranslation('feedback360')
  const data = result.competencies.filter(c => c.others != null).map(c => ({ name: c.name, value: c.others! }))
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 40 + 50)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 36, left: 8, bottom: 30 }}>
        <CartesianGrid stroke="var(--color-border)" horizontal={false} />
        <XAxis type="number" domain={[0, result.scaleMax]} label={xAxisLabel(t('F360ReportPage.scoreScale1', { scaleMax: result.scaleMax }))}
          axisLine={false} tickLine={false} tick={{ fill: AXIS_COLORS.tick, fontSize: 12 }} />
        <YAxis type="category" dataKey="name" width={150} axisLine={false} tickLine={false} tick={{ fill: AXIS_COLORS.tick, fontSize: 12 }} />
        <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} content={({ active, payload }) => {
          const row = payload?.[0]?.payload as { name: string; value: number } | undefined
          return active && row
            ? <ChartTooltip title={row.name} rows={[{ color: seriesColor(0), label: t('F360ReportPage.others'), value: `${fmtScore(row.value)} điểm` }]} />
            : null
        }} />
        <Bar dataKey="value" fill={seriesColor(0)} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList dataKey="value" position="right" formatter={v => fmtScore(Number(v))} style={{ fill: AXIS_COLORS.tick, fontSize: 12 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Từng năng lực theo nhóm người chấm (chỉ các nhóm được hiện, trừ tự đánh giá). */
function GroupCompareCard({ result }: { result: F360Result }) {
  const { t } = useTranslation('feedback360')
  const groups = result.groups.filter(g => g.visible && g.key !== 'SELF')
  if (groups.length < 2) return null
  const data = result.competencies
    .filter(c => groups.some(g => c.byGroup[g.key] != null))
    .map(c => ({ name: c.name, ...Object.fromEntries(groups.map(g => [g.key, c.byGroup[g.key] ?? null])) }))
  // In số lên thanh chỉ khi ít mốc (≤ 12 thanh) — nhiều hơn thì đọc số ở tooltip.
  const showLabels = data.length * groups.length <= 12

  return (
    <Card title={t('F360ReportPage.eachCompetencyScoresByRaterGroup')}>
      <div className="mb-2 flex flex-wrap justify-center gap-4 text-xs text-[var(--color-muted-foreground)]">
        {groups.map((g, i) => (
          <span key={g.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seriesColor(i) }} /> {g.label} ({g.raterCount})
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * groups.length * 18 + data.length * 16 + 60)}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 36, left: 8, bottom: 30 }} barGap={2}>
          <CartesianGrid stroke="var(--color-border)" horizontal={false} />
          <XAxis type="number" domain={[0, result.scaleMax]} label={xAxisLabel(t('F360ReportPage.scoreScale1', { scaleMax: result.scaleMax }))}
            axisLine={false} tickLine={false} tick={{ fill: AXIS_COLORS.tick, fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={150} axisLine={false} tickLine={false} tick={{ fill: AXIS_COLORS.tick, fontSize: 12 }} />
          <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} content={({ active, payload, label }) => active && payload?.length
            ? <ChartTooltip title={String(label)} rows={payload.filter(p => p.value != null).map(p => ({
                color: String(p.color), label: groups.find(g => g.key === p.dataKey)?.label ?? String(p.dataKey), value: `${fmtScore(Number(p.value))} điểm`,
              }))} />
            : null} />
          {groups.map((g, i) => (
            <Bar key={g.key} dataKey={g.key} fill={seriesColor(i)} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {showLabels && <LabelList dataKey={g.key} position="right" formatter={v => fmtScore(Number(v))} style={{ fill: AXIS_COLORS.tick, fontSize: 12 }} />}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

/**
 * So điểm người này với trung bình NHÓM ĐƠN VỊ của họ trong cùng chiến dịch (nhóm đã đủ ngưỡng k).
 * Chỉ quản lý/HR thấy — người được đánh giá không nhận số này để không suy ngược điểm người khác.
 */
function ComparisonCard({ result, comparison }: { result: F360Result; comparison: NonNullable<F360Report['comparison']> }) {
  const { t } = useTranslation('feedback360')
  const rows = result.competencies.filter(c => c.others != null)
  return (
    <Card title={t('F360ReportPage.comparedWithTheAveragePeople', { label: comparison.label, subjectCount: comparison.subjectCount })} icon={<Scale size={16} className="text-slate-400" />}>
      <table className="w-full text-sm">
        <thead className="text-left text-caption">
          <tr>
            <th className="py-1 font-medium">{t('F360ReportPage.competency')}</th>
            <th className="py-1 text-right font-medium">{t('F360ReportPage.thisPerson')}</th>
            <th className="py-1 text-right font-medium">{t('F360ReportPage.groupAverage')}</th>
            <th className="py-1 text-right font-medium">{t('F360ReportPage.difference')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(c => {
            const avg = comparison.byCompetency[c.key]
            const diff = avg != null && c.others != null ? c.others - avg : null
            return (
              <tr key={c.key} className="border-t border-[var(--color-border)]">
                <td className="py-1.5">{c.name}</td>
                <td className="py-1.5 text-right tabular-nums">{fmtScore(c.others)}</td>
                <td className="py-1.5 text-right tabular-nums">{fmtScore(avg)}</td>
                <td className={`py-1.5 text-right tabular-nums ${diff == null ? '' : diff >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                  {diff == null ? '-' : `${diff > 0 ? '+' : ''}${fmtScore(diff)}`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 text-caption">{t('F360ReportPage.scaleRange', { max: result.scaleMax })}{t('F360ReportPage.unitsWithFewerThan')} {result.anonymityThreshold} {t('F360ReportPage.peopleAreMergedIntoTheParent')}</p>
    </Card>
  )
}

function HighlightCard({ title, icon, items, scaleMax }: {
  title: string; icon: React.ReactNode; items: F360Result['top']; scaleMax: number
}) {
  const { t } = useTranslation('feedback360')
  return (
    <Card title={title} icon={icon}>
      {items.length === 0 ? <p className="text-sm text-[var(--color-muted-foreground)]">{t('F360ReportPage.notEnoughData')}</p> : (
        <ol className="space-y-2">
          {items.map((h, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="w-12 shrink-0 font-semibold tabular-nums">{fmtScore(h.score)}/{scaleMax}</span>
              <span>
                {h.text}
                {h.competencyName && <span className="block text-caption">{h.competencyName}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

function GapList({ title, items }: { title: string; items: F360Result['blindSpots'] }) {
  const { t } = useTranslation('feedback360')
  return (
    <Card title={title}>
      {items.length === 0 ? <p className="text-sm text-[var(--color-muted-foreground)]">{t('F360ReportPage.none')}</p> : (
        <ul className="space-y-2">
          {items.map(g => (
            <li key={g.name} className="flex items-center justify-between gap-3 text-sm">
              <span>{g.name}</span>
              <span className="tabular-nums text-caption">
                {t('F360ReportPage.self')} {fmtScore(g.self)} {t('F360ReportPage.others2')} {fmtScore(g.others)} ({g.gap > 0 ? '+' : ''}{fmtScore(g.gap)})
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
