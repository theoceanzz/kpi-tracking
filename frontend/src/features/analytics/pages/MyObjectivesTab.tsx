import { useState, useMemo } from 'react'
import { personalObjectiveApi } from '@/features/dashboard/api/personalObjectiveApi'
import { useQuery } from '@tanstack/react-query'
import { Target, TrendingUp, AlertTriangle, CheckCircle, ChevronDown, ChevronRight, User, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

import MyObjectiveDrawer from '../components/MyObjectiveDrawer' 
import AnalyticsComboChart from '../components/AnalyticsComboChart'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'

import { subDays, subMonths, startOfYear } from 'date-fns'

type DateFilterType = 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_QUARTER' | '6_MONTHS' | 'THIS_YEAR' | 'CUSTOM'

export default function MyObjectivesTab() {
  const [filterType, setFilterType] = useState<DateFilterType>('THIS_YEAR')
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>({ from: '', to: '' })
  const [onlyApproved, setOnlyApproved] = useState<boolean>(false)
  const [selectedKpiId, setSelectedKpiId] = useState<string | null>(null)
  
  const { from, to } = useMemo(() => {
    const now = new Date()
    switch (filterType) {
      case 'THIS_WEEK':
        return { from: subDays(now, 7).toISOString(), to: now.toISOString() }
      case 'THIS_MONTH':
        return { from: subDays(now, 30).toISOString(), to: now.toISOString() }
      case 'THIS_QUARTER':
        return { from: subDays(now, 90).toISOString(), to: now.toISOString() }
      case '6_MONTHS':
        return { from: subMonths(now, 6).toISOString(), to: now.toISOString() }
      case 'THIS_YEAR':
        return { from: startOfYear(now).toISOString(), to: now.toISOString() }
      case 'CUSTOM':
        return {
          from: customRange.from ? new Date(customRange.from).toISOString() : undefined,
          to: customRange.to ? new Date(customRange.to).toISOString() : undefined
        }
      default:
        return { from: undefined, to: undefined }
    }
  }, [filterType, customRange])

  const { data: metrics, isLoading: isMetricsLoading } = useQuery({
    queryKey: ['personalObjective', 'metrics', from, to, onlyApproved],
    queryFn: () => personalObjectiveApi.getMetrics({ from, to, onlyApproved })
  })

  const { data: chartData, isLoading: isChartLoading } = useQuery({
    queryKey: ['personalObjective', 'chart', from, to, onlyApproved],
    queryFn: () => personalObjectiveApi.getComboChart({ from, to, onlyApproved })
  })

  const { data: kpis, isLoading: isKpisLoading } = useQuery({
    queryKey: ['personalObjective', 'details', from, to, onlyApproved],
    queryFn: () => personalObjectiveApi.getDetailedKpis({ from, to, onlyApproved })
  })

  if (isMetricsLoading || isChartLoading || isKpisLoading) return <div className="p-8"><LoadingSkeleton rows={10} /></div>

  return (
    <div className="space-y-6">
      {/* Global Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex flex-wrap items-center gap-4 justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
            <Target size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Bộ lọc mục tiêu của tôi</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Lọc dữ liệu đồng bộ cho tất cả biểu đồ</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5">
          {/* Approved submissions only toggle */}
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
            <input 
              type="checkbox"
              className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800"
              checked={onlyApproved}
              onChange={(e) => setOnlyApproved(e.target.checked)}
            />
            Chỉ tính bài nộp đã duyệt
          </label>

          <select 
            className="h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as DateFilterType)}
          >
            <option value="THIS_WEEK">Tuần này</option>
            <option value="THIS_MONTH">Tháng này</option>
            <option value="THIS_QUARTER">Quý này</option>
            <option value="6_MONTHS">6 tháng gần đây</option>
            <option value="THIS_YEAR">Năm nay</option>
            <option value="CUSTOM">Tùy chỉnh...</option>
          </select>

          {filterType === 'CUSTOM' && (
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                className="h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50"
                value={customRange.from}
                onChange={(e) => setCustomRange(prev => ({ ...prev, from: e.target.value }))}
              />
              <span className="text-slate-400">-</span>
              <input 
                type="date" 
                className="h-10 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50"
                value={customRange.to}
                onChange={(e) => setCustomRange(prev => ({ ...prev, to: e.target.value }))}
              />
            </div>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Tiến độ trung bình</p>
            <p className="text-2xl font-black">{metrics?.averageProgress?.toFixed(1) ?? 0}%</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Target size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Hiệu suất trung bình</p>
            <p className="text-2xl font-black">{metrics?.averagePerformance?.toFixed(1) ?? 0}%</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Trạng thái KPI</p>
            <p className="text-lg font-black">{metrics?.runningKpis ?? 0} Đang chạy | {metrics?.completedKpis ?? 0} Hoàn thành</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">KPI Rủi ro / Chậm</p>
            <p className="text-2xl font-black">{metrics?.riskKpis ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Combo Chart */}
      <div className="pt-4">
        <AnalyticsComboChart 
          data={chartData?.points || []} 
          isLoading={isChartLoading} 
          itemName="KPI đảm nhiệm"
        />
      </div>

      {/* KPI Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-black">Bảng chi tiết KPI đang đảm nhiệm</h3>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr className="text-xs font-black uppercase text-slate-500">
                <th className="px-6 py-4 w-10"></th>
                <th className="px-6 py-4">Mục tiêu hướng tới</th>
                <th className="px-6 py-4">Kết quả chính (KR)</th>
                <th className="px-6 py-4 min-w-[250px]">Tiến độ KPI</th>
                <th className="px-6 py-4 text-center">Hiệu suất</th>
                <th className="px-6 py-4">Phân loại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {kpis?.map(kpi => (
                <ExpandableKpiRow 
                  key={kpi.kpiId} 
                  kpi={kpi} 
                  onExpand={() => setSelectedKpiId(kpi.kpiId)} 
                />
              ))}
              {kpis?.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Không có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedKpiId && (
        <MyObjectiveDrawer 
          kpiId={selectedKpiId} 
          onClose={() => setSelectedKpiId(null)} 
          globalFrom={from}
          globalTo={to}
        />
      )}
    </div>
  )
}

function ExpandableKpiRow({ kpi, onExpand }: { kpi: any, onExpand: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const pct = Math.round(kpi.progress || 0)
  const perf = Math.round(kpi.performance || 0)

  return (
    <>
      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
        <td className="px-6 py-4">
          <button onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">
            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
        </td>
        <td className="px-6 py-4 cursor-pointer" onClick={onExpand}>
          <div className="font-bold text-sm text-slate-900 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors dark:text-white truncate max-w-[200px]">{kpi.kpiName}</div>
          <div className="text-[11px] text-slate-500 mt-1">{kpi.objectiveName} ({kpi.objectiveCode})</div>
        </td>
        <td className="px-6 py-4">
          <div className="text-sm font-medium">{kpi.keyResultName}</div>
          <div className="text-[11px] text-slate-500 mt-1">{kpi.keyResultCode}</div>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-emerald-500" : "bg-indigo-500")} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className="text-xs font-black">{pct}%</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Đã hoàn thành {kpi.actualValue?.toLocaleString('vi-VN')} / {kpi.targetValue?.toLocaleString('vi-VN')} {kpi.unit}</div>
        </td>
        <td className="px-6 py-4 text-center">
          <div className="inline-flex relative items-center justify-center w-12 h-12">
            <svg className="w-12 h-12 transform -rotate-90">
              <circle className="text-slate-100 dark:text-slate-800" strokeWidth="4" stroke="currentColor" fill="transparent" r="20" cx="24" cy="24" />
              <circle className={cn(perf >= 100 ? "text-emerald-500" : perf >= 80 ? "text-indigo-500" : perf >= 50 ? "text-amber-500" : "text-red-500")} strokeWidth="4" strokeDasharray={125.6} strokeDashoffset={125.6 - (Math.min(perf, 100) / 100) * 125.6} strokeLinecap="round" stroke="currentColor" fill="transparent" r="20" cx="24" cy="24" />
            </svg>
            <span className="absolute text-[10px] font-black">{perf}%</span>
          </div>
        </td>
        <td className="px-6 py-4">
          {kpi.shared ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px] font-black uppercase">
              <Users size={12} /> Mục tiêu chung ({kpi.participantCount})
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase">
              <User size={12} /> Mục tiêu riêng
            </div>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="p-0 border-b border-slate-100 dark:border-slate-800">
            <div className="bg-slate-50/50 dark:bg-slate-900/50 p-6 flex flex-col gap-6 border-l-4 border-indigo-500">
              <div className="w-full space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Lịch sử bài nộp của tôi</h4>
                {kpi.mySubmissions && kpi.mySubmissions.length > 0 ? (
                  <div className="space-y-3">
                    {kpi.mySubmissions.map((sub: any) => (
                      <div key={sub.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between gap-4">
                        <div className="w-[120px]">
                          <p className="text-sm font-bold">{sub.code}</p>
                        </div>
                        <div className="w-[150px]">
                          <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Thời gian nộp</p>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {new Date(sub.submitDate).toLocaleString('vi-VN', {
                              hour: '2-digit', minute: '2-digit',
                              day: '2-digit', month: '2-digit', year: 'numeric'
                            })}
                          </p>
                        </div>
                        <div className="flex-1 max-w-[200px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-slate-500">Đóng góp</span>
                            <span className="text-[10px] font-black">{sub.contributionProgress?.toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(sub.contributionProgress, 100)}%` }} />
                          </div>
                          <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-1">+{sub.actualValue?.toLocaleString('vi-VN')} {kpi.unit}</p>
                        </div>
                        <div className="text-center w-[100px]">
                          <p className="text-[10px] text-slate-500">Hiệu suất</p>
                          <p className="text-sm font-black text-indigo-500">{sub.performance?.toFixed(1)}%</p>
                        </div>
                        <div>
                          <span className={cn("px-2 py-1 rounded text-[10px] font-black uppercase", sub.status === 'APPROVED' ? "bg-emerald-100 text-emerald-700" : sub.status === 'REJECTED' ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")}>
                            {sub.status === 'APPROVED' ? 'ĐÃ DUYỆT' : sub.status === 'REJECTED' ? 'TỪ CHỐI' : 'CHỜ DUYỆT'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">Chưa có bài nộp nào.</div>
                )}
              </div>
              
              {kpi.shared && (
                <div className="w-full space-y-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Đồng đội cùng thực hiện</h4>
                  <div className="space-y-3">
                    {kpi.teammates?.map((tm: any) => (
                      <div key={tm.userId} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        
                        <div className="flex items-center gap-3 w-[250px]">
                          {tm.avatarUrl ? (
                            <img src={tm.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-bold">{tm.fullName.charAt(0)}</div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate">{tm.fullName}</p>
                            <p className="text-[10px] text-slate-500">{tm.employeeCode}</p>
                          </div>
                        </div>

                        <div className="w-[150px]">
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{tm.role}</p>
                          <p className="text-[10px] text-slate-500">{tm.department}</p>
                        </div>

                        <div className="flex-1 max-w-[250px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-slate-500">Tiến độ cá nhân</span>
                            <span className="text-[10px] font-black">{tm.progress?.toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(tm.progress, 100)}%` }} />
                          </div>
                          <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 mt-1">{tm.actualValue?.toLocaleString('vi-VN')} {kpi.unit}</p>
                        </div>

                        <div className="text-center sm:text-right w-[100px]">
                          <p className="text-[10px] text-slate-500">Hiệu suất</p>
                          <p className="text-sm font-black text-indigo-500">{tm.performance?.toFixed(1)}%</p>
                        </div>
                        
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
