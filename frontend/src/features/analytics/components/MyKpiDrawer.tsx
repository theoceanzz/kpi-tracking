import React, { useState, useMemo } from 'react'

import { personalObjectiveApi } from '@/features/dashboard/api/personalObjectiveApi'
import { useQuery } from '@tanstack/react-query'
import { Users, Target, Activity } from 'lucide-react'
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from 'recharts'
import { cn } from '@/lib/utils'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import ObjectiveDrawer from './ObjectiveDrawer'
import { subDays, subMonths, startOfYear } from 'date-fns'

type DateFilterType = 'GLOBAL' | 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_QUARTER' | '6_MONTHS' | 'THIS_YEAR' | 'CUSTOM'

function DrawerChartTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-lg">
        <p className="font-bold text-slate-900 dark:text-white mb-3">{label}</p>
        <div className="space-y-2">
          {payload.map((p: any, i: number) => {
            const valStr = p.name.includes('%') ? `${Math.round(p.value)}%` : p.value?.toLocaleString('vi-VN')
            return (
              <div key={i} className="flex items-center gap-3 text-sm">
                <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-slate-500 font-medium min-w-[120px]">{p.name}:</span>
                <span className="font-bold text-slate-900 dark:text-white">{valStr}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
  return null
}

export default function MyKpiDrawer({
  kpiId,
  onClose,
  globalFrom,
  globalTo,
}: {
  kpiId: string
  onClose: () => void
  globalFrom?: string
  globalTo?: string
}) {
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('GLOBAL')
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>({ from: '', to: '' })
  const [activeTeammates, setActiveTeammates] = useState<string[]>([])

  const { from, to } = useMemo(() => {
    if (dateFilterType === 'GLOBAL') return { from: globalFrom, to: globalTo }
    const now = new Date()
    switch (dateFilterType) {
      case 'THIS_WEEK':    return { from: subDays(now, 7).toISOString(),   to: now.toISOString() }
      case 'THIS_MONTH':   return { from: subDays(now, 30).toISOString(),  to: now.toISOString() }
      case 'THIS_QUARTER': return { from: subDays(now, 90).toISOString(),  to: now.toISOString() }
      case '6_MONTHS':     return { from: subMonths(now, 6).toISOString(), to: now.toISOString() }
      case 'THIS_YEAR':    return { from: startOfYear(now).toISOString(),  to: now.toISOString() }
      case 'CUSTOM':
        return {
          from: customRange.from ? new Date(customRange.from).toISOString() : undefined,
          to:   customRange.to   ? new Date(customRange.to).toISOString()   : undefined,
        }
      default: return { from: undefined, to: undefined }
    }
  }, [dateFilterType, customRange, globalFrom, globalTo])

  const { data, isLoading } = useQuery({
    queryKey: ['personalKpi', 'drawer', kpiId, from, to],
    queryFn: () => personalObjectiveApi.getKpiDrawerData(kpiId, { from, to }),
  })

  const chartData = useMemo(() => {
    if (!data?.chartData?.points) return []
    return data.chartData.points.map(p => {
      const result: any = {
        label: p.label,
        targetValue: p.targetValue,
        teamTotalActual: p.teamTotalActual,
        myActual: p.myActual,
        myPerformance: p.myPerformance,
      }
      if (p.teammateValues) {
        Object.keys(p.teammateValues).forEach(tid => {
          if (activeTeammates.includes(tid) && p.teammateValues) {
            result[`tm_act_${tid}`] = p.teammateValues[tid]?.actual
            result[`tm_prf_${tid}`] = p.teammateValues[tid]?.performance
          }
        })
      }
      return result
    })
  }, [data, activeTeammates])

  const toggleTeammate = (id: string) => {
    setActiveTeammates(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const contributions = useMemo(() => {
    if (!data?.contributions) return []
    return [...data.contributions].sort((a, b) => b.contributionPercentage - a.contributionPercentage)
  }, [data])

  const customTitle = (
    <div className="flex flex-col gap-1">
      <div className="flex items-center flex-wrap gap-2">
        <span className="text-base font-bold text-slate-900 dark:text-white leading-snug">
          {data?.kpiName || 'Chi tiết KPI'}
        </span>
        {data?.shared && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 text-[10px] font-black uppercase border border-purple-200 dark:border-purple-500/30 flex-shrink-0">
            <Users size={10} /> KPI chung
          </span>
        )}
      </div>
    </div>
  )

  return (
    <ObjectiveDrawer isOpen={true} onClose={onClose} title={customTitle}>
      {isLoading ? (
        <div className="w-full min-h-[400px] flex items-center justify-center">
          <LoadingSkeleton rows={15} />
        </div>
      ) : (
        <div className="space-y-6 pb-10">
          {/* Local Date Filter */}
          <div className="flex justify-end">
            <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-white/10 shadow-sm text-sm">
              <select
                value={dateFilterType}
                onChange={e => setDateFilterType(e.target.value as DateFilterType)}
                className="bg-transparent border-none outline-none text-slate-700 dark:text-slate-300 px-2 py-1 cursor-pointer font-medium"
              >
                <option value="GLOBAL">Theo bộ lọc KPI của tôi</option>
                <option value="THIS_WEEK">Tuần này</option>
                <option value="THIS_MONTH">Tháng này</option>
                <option value="THIS_QUARTER">Quý này</option>
                <option value="6_MONTHS">6 tháng qua</option>
                <option value="THIS_YEAR">Năm nay</option>
                <option value="CUSTOM">Tùy chỉnh</option>
              </select>
              {dateFilterType === 'CUSTOM' && (
                <div className="flex items-center gap-2 px-2 border-l border-slate-200 dark:border-white/10">
                  <input
                    type="date"
                    className="bg-transparent border-none outline-none text-slate-700 dark:text-slate-300 text-xs"
                    value={customRange.from}
                    onChange={e => setCustomRange(prev => ({ ...prev, from: e.target.value }))}
                  />
                  <span className="text-slate-400">-</span>
                  <input
                    type="date"
                    className="bg-transparent border-none outline-none text-slate-700 dark:text-slate-300 text-xs"
                    value={customRange.to}
                    onChange={e => setCustomRange(prev => ({ ...prev, to: e.target.value }))}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-500 mb-1">Mục tiêu yêu cầu</p>
              <p className="text-xl font-black text-slate-900 dark:text-white">{data?.targetValue?.toLocaleString('vi-VN')}</p>
            </div>
            <div className="bg-violet-50 dark:bg-violet-900/20 p-4 rounded-2xl border border-violet-100 dark:border-violet-900/30">
              <p className="text-[10px] font-bold text-violet-500 mb-1">Cá nhân: Lũy kế</p>
              <p className="text-xl font-black text-violet-700 dark:text-violet-400">{data?.myActualValue?.toLocaleString('vi-VN')}</p>
              <p className="text-[10px] font-bold text-violet-500 mt-1">Đạt {data?.myProgress?.toFixed(1)}%</p>
            </div>
            {data?.shared && (
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-2xl border border-purple-100 dark:border-purple-900/30">
                <p className="text-[10px] font-bold text-purple-500 mb-1">Nhóm: Lũy kế tổng</p>
                <p className="text-xl font-black text-purple-700 dark:text-purple-400">{data?.totalActualValue?.toLocaleString('vi-VN')}</p>
                <p className="text-[10px] font-bold text-purple-500 mt-1">Đạt {data?.totalProgress?.toFixed(1)}%</p>
              </div>
            )}
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
              <p className="text-[10px] font-bold text-emerald-500 mb-1">Hiệu suất cá nhân</p>
              <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">{data?.myPerformance?.toFixed(1)}%</p>
              {data?.shared && (
                <p className="text-[10px] font-bold text-emerald-500 mt-1">Nhóm: {data?.teamPerformance?.toFixed(1)}%</p>
              )}
            </div>
          </div>

          {/* Multi-axis Chart */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <h3 className="text-sm font-black flex items-center gap-2">
                <Activity size={18} className="text-violet-500" />
                Biểu đồ phân tích chuyên sâu
              </h3>
              {data?.shared && data.chartData.availableTeammates && data.chartData.availableTeammates.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {data.chartData.availableTeammates.map(tm => (
                    <button
                      key={tm.userId}
                      onClick={() => toggleTeammate(tm.userId)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border',
                        activeTeammates.includes(tm.userId)
                          ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900 dark:border-white'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-700'
                      )}
                    >
                      {activeTeammates.includes(tm.userId) && '✓'} {tm.fullName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 px-1">
              <span>Đơn vị ({data?.unit || ''})</span>
              <span>Hiệu suất (%)</span>
            </div>

            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={val => `${Math.round(val)}%`} />
                  <Tooltip content={<DrawerChartTooltip />} cursor={{ fill: '#94a3b8', opacity: 0.06 }} />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />

                  <Line yAxisId="left" type="step" dataKey="targetValue" name="Mục tiêu" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                  {data?.shared && (
                    <Line yAxisId="left" type="monotone" dataKey="teamTotalActual" name="Tổng Lũy kế Nhóm" stroke="#93c5fd" strokeWidth={2} strokeDasharray="3 3" dot={false} />
                  )}
                  <Line yAxisId="left" type="monotone" dataKey="myActual" name="Lũy kế của Tôi" stroke="#7c3aed" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line yAxisId="right" type="monotone" dataKey="myPerformance" name="Hiệu suất của Tôi (%)" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />

                  {activeTeammates.map((tid, idx) => {
                    const colors = ['#f59e0b', '#8b5cf6', '#ec4899', '#0ea5e9', '#14b8a6']
                    const color = colors[idx % colors.length]
                    const tmName = data?.chartData?.availableTeammates?.find(t => t.userId === tid)?.fullName || 'Teammate'
                    return (
                      <React.Fragment key={tid}>
                        <Line yAxisId="left" type="monotone" dataKey={`tm_act_${tid}`} name={`Lũy kế - ${tmName}`} stroke={color} strokeWidth={1.5} dot={{ r: 2 }} opacity={0.7} />
                        <Line yAxisId="right" type="monotone" dataKey={`tm_prf_${tid}`} name={`Hiệu suất - ${tmName} (%)`} stroke={color} strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 4" opacity={0.7} />
                      </React.Fragment>
                    )
                  })}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Contribution Bar Chart */}
          {data?.shared && contributions.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-black mb-6 flex items-center gap-2">
                <Target size={18} className="text-purple-500" />
                Mức độ đóng góp của từng thành viên
              </h3>
              <div className="space-y-4">
                {contributions.map((c, i) => (
                  <div key={c.userId}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] text-slate-500">{i + 1}</span>
                        {c.fullName}
                      </span>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 mr-2">{c.actualValue?.toLocaleString('vi-VN')}</span>
                        <span className="text-xs font-black text-violet-600 dark:text-violet-400">{c.contributionPercentage?.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600"
                        style={{ width: `${Math.min(c.contributionPercentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </ObjectiveDrawer>
  )
}
