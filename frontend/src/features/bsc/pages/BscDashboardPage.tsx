import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts'
import { useAuthStore } from '@/store/authStore'
import { useScorecards, useBscDashboard } from '../hooks/useBsc'
import { Layers, Target, TrendingUp, Calendar, Gauge } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BscScoringMode } from '../types'

function PerspectiveTick({ payload, x, y, textAnchor }: any) {
  const label: string = payload?.value ?? ''
  const words = label.split(' ')
  const lines: string[] = []
  let cur = ''
  words.forEach(w => {
    const next = (cur ? `${cur} ${w}` : w)
    if (next.length <= 9) cur = next
    else { if (cur) lines.push(cur); cur = w }
  })
  if (cur) lines.push(cur)

  return (
    <text x={x} y={y} textAnchor={textAnchor} className="fill-slate-500 dark:fill-slate-400" fontSize={10} fontWeight={700}>
      {lines.map((ln, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : 12}>{ln}</tspan>
      ))}
    </text>
  )
}

const scoreColor = (v?: number | null) => {
  if (v == null) return 'text-slate-400'
  if (v < 50) return 'text-rose-500'
  if (v < 70) return 'text-amber-500'
  if (v < 90) return 'text-emerald-500'
  return 'text-blue-600 dark:text-blue-400'
}

export default function BscDashboardPage() {
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: scorecards } = useScorecards(organizationId)
  const [searchParams, setSearchParams] = useSearchParams()
  const [scorecardId, setScorecardId] = useState<string>('')

  useEffect(() => {
    const fromUrl = searchParams.get('scorecard')
    if (fromUrl) setScorecardId(fromUrl)
    else {
      const first = scorecards?.[0]
      if (first) setScorecardId(first.id)
    }
  }, [scorecards, searchParams])

  const { data: dashboard, isLoading } = useBscDashboard(scorecardId || undefined)

  const fixedGroups = useMemo(() => {
    const order = ['FINANCIAL', 'CUSTOMER', 'INTERNAL_PROCESS', 'LEARNING_GROWTH']
    const list = dashboard?.perspectives || []
    type Group = { code: string; name: string; color?: string; items: typeof list }
    const groups = new Map<string, Group>()
    for (const p of list) {
      const key = p.fixedPerspective || 'INTERNAL_PROCESS'
      if (!groups.has(key)) groups.set(key, { code: key, name: p.fixedPerspectiveName || key, color: p.fixedPerspectiveColor || p.color, items: [] })
      groups.get(key)!.items.push(p)
    }
    return order.filter(k => groups.has(k)).map(k => groups.get(k)!)
  }, [dashboard])

  const radarData = useMemo(() => fixedGroups.map(g => {
    const withAch = g.items.filter(p => p.achievementPercent != null)
    const wSum = withAch.reduce((s, p) => s + (p.weightPercentage || 0), 0)
    const ach = wSum > 0
      ? withAch.reduce((s, p) => s + (p.achievementPercent! * (p.weightPercentage || 0)), 0) / wSum
      : 0
    return { name: g.name, achievement: Math.round(ach * 10) / 10 }
  }), [fixedGroups])

  const onSelect = (id: string) => {
    setScorecardId(id)
    setSearchParams({ scorecard: id })
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Gauge className="text-indigo-600" size={32} /> Thẻ điểm cân bằng
          </h1>
          <p className="text-slate-500 font-medium mt-1">Tổng hợp kết quả theo các viễn cảnh chiến lược</p>
        </div>
        <div className="min-w-[240px]">
          <Select value={scorecardId} onValueChange={onSelect}>
            <SelectTrigger className="w-full h-11 rounded-2xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm font-black text-sm">
              <Calendar size={16} className="text-indigo-500 mr-2 shrink-0" />
              <SelectValue placeholder="Chọn thẻ điểm" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 max-h-[300px]">
              {scorecards?.map(sc => <SelectItem key={sc.id} value={sc.id} className="text-sm font-bold">{sc.name} · {sc.kpiPeriodName} · {sc.orgUnitName || 'Toàn tổ chức'}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && <div className="p-16 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>}

      {!isLoading && !dashboard && (
        <div className="flex flex-col items-center justify-center p-20 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 mb-4"><Target size={32} /></div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Chưa chọn thẻ điểm</h3>
          <p className="text-slate-500 max-w-sm mt-2">Hãy tạo và chọn một thẻ điểm để xem dashboard cân bằng.</p>
        </div>
      )}

      {!isLoading && dashboard && (
        <>
          {/* Overall + Vision */}
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-8 text-white shadow-xl shadow-indigo-500/20">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/3 blur-3xl" />
            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="max-w-xl">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-indigo-200">Chiến lược</p>
                <h2 className="text-2xl font-black mt-1">{dashboard.name}</h2>
                <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-wider bg-white/15 px-2.5 py-1 rounded-full">{dashboard.orgUnitName || 'Toàn tổ chức'}</span>
                {dashboard.vision && <p className="text-sm text-indigo-100/80 mt-2 italic leading-relaxed">"{dashboard.vision}"</p>}
                {dashboard.scoringMode === BscScoringMode.SHADOW && (
                  <span className="inline-block mt-3 text-[10px] font-black uppercase tracking-wider bg-white/15 px-2.5 py-1 rounded-full">Chạy song song (chưa chính thức)</span>
                )}
              </div>
              <div className="text-center shrink-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-indigo-200">Điểm BSC tổng hợp</p>
                <p className="text-6xl font-black mt-1 tabular-nums">{dashboard.overallScore != null ? dashboard.overallScore.toFixed(1) : '—'}</p>
                <p className="text-xs text-indigo-200 font-bold">/ 100</p>
              </div>
            </div>
          </div>

          {/* 4 ô viễn cảnh cố định, mỗi ô liệt kê các hạng mục con + radar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fixedGroups.map(group => {
                const groupWeight = group.items.reduce((s, p) => s + (p.weightPercentage || 0), 0)
                const groupContribution = group.items.reduce((s, p) => s + (p.weightedScore || 0), 0)
                return (
                  <div key={group.code} className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                    <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: group.color || '#8b5cf6' }} />
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color || '#8b5cf6' }} />
                        <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">{group.name}</h3>
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase shrink-0">{Math.round(groupWeight)}% · {group.items.length} hạng mục</span>
                    </div>
                    <div className="space-y-3">
                      {group.items.map(p => {
                        const ach = p.achievementPercent
                        return (
                          <div key={p.perspectiveId}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{p.name}</span>
                              <span className="text-[10px] font-bold text-slate-400 shrink-0">{p.weightPercentage}% · {p.kpiCount} KPI</span>
                              <span className={cn('text-sm font-black tabular-nums shrink-0', scoreColor(ach))}>{ach != null ? `${ach.toFixed(0)}%` : '—'}</span>
                            </div>
                            <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, ach || 0)}%`, backgroundColor: p.color || group.color || '#8b5cf6' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400">
                      <span>Đóng góp viễn cảnh</span>
                      <span className="text-slate-600 dark:text-slate-300">{groupContribution.toFixed(1)} đ</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Radar */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-2"><TrendingUp size={14} className="text-indigo-500" /> Biểu đồ radar</h3>
              <div className="flex-1 min-h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="82%" margin={{ top: 14, right: 34, bottom: 14, left: 34 }}>
                    <PolarGrid strokeOpacity={0.25} />
                    <PolarAngleAxis dataKey="name" tick={<PerspectiveTick />} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                    <Radar name="Đạt %" dataKey="achievement" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.35} strokeWidth={2} />
                    <Tooltip formatter={(v: any) => [`${v}%`, 'Đạt']} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
            <Layers size={12} /> Điểm mỗi hạng mục = trung bình có trọng số các KPI thuộc hạng mục đó; các hạng mục được gộp vào 4 viễn cảnh cố định.
          </p>
        </>
      )}
    </div>
  )
}
