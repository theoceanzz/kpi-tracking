import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ObjectiveDetailedDto } from '@/types/stats'
import { format } from 'date-fns'

const SparklineDonut = ({ value }: { value: number | null }) => {
  if (value === null) return <span className="text-slate-400 dark:text-slate-500 font-medium">-</span>
  const radius = 16
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (Math.min(value, 100) / 100) * circumference
  const color = value >= 100 ? '#10b981' : value >= 50 ? '#f59e0b' : '#ef4444'
  
  return (
    <div className="relative flex items-center justify-center w-10 h-10 mx-auto group-hover:scale-110 transition-transform">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-200 dark:text-slate-700/50" />
        <circle cx="20" cy="20" r="16" stroke={color} strokeWidth="4" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="transition-all duration-1000 ease-out" strokeLinecap="round" />
      </svg>
      <span className="absolute text-[9px] font-bold text-slate-700 dark:text-slate-300">{Math.round(value)}%</span>
    </div>
  )
}

const ProgressBar = ({ value, subText }: { value: number, subText: string }) => {
  const color = value >= 100 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="w-full flex flex-col gap-1.5 min-w-[150px]">
      <div className="flex justify-between items-center text-xs">
        <span className="text-slate-500 dark:text-slate-400">Tiến độ</span>
        <span className="font-bold text-slate-800 dark:text-slate-200">{Math.round(value)}%</span>
      </div>
      <div className="h-2 w-full bg-slate-200 dark:bg-slate-700/50 rounded-full overflow-hidden border border-slate-300 dark:border-white/5">
        <div className={`h-full ${color} transition-all duration-1000 rounded-full`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <div className="text-[10px] text-slate-500 font-medium mt-0.5">{subText}</div>
    </div>
  )
}

const StatusBadge = ({ status }: { status: string }) => {
  let bg = 'bg-slate-100 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-500/20'
  if (status === 'ĐÃ DUYỆT') bg = 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
  else if (status === 'CHỜ DUYỆT') bg = 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'
  else if (status === 'TỪ CHỐI') bg = 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20'
  else if (status === 'CHƯA NỘP' || status === 'OVERDUE') bg = 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
  else if (status === 'CHƯA ĐƯỢC GIAO') bg = 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-500 border-slate-300 dark:border-slate-700'
  
  return <span className={`px-2.5 py-1 rounded-md text-[10px] font-semibold border ${bg} whitespace-nowrap`}>{status}</span>
}

interface Props {
  data: ObjectiveDetailedDto[];
  onRowClick: (type: 'OBJECTIVE' | 'KR' | 'KPI', data: any) => void;
}

export default function ObjectiveDetailedTable({ data, onRowClick }: Props) {
  const [expandedObj, setExpandedObj] = useState<Record<string, boolean>>({})
  const [expandedKr, setExpandedKr] = useState<Record<string, boolean>>({})
  const [expandedKpi, setExpandedKpi] = useState<Record<string, boolean>>({})

  const toggleObj = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedObj(prev => ({ ...prev, [id]: !prev[id] }))
  }
  const toggleKr = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedKr(prev => ({ ...prev, [id]: !prev[id] }))
  }
  const toggleKpi = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedKpi(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const formatDate = (d: string | null) => d ? format(new Date(d), 'dd/MM/yyyy') : '---'

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 backdrop-blur-md shadow-sm dark:shadow-xl">
      <table className="w-full text-sm text-left whitespace-nowrap">
        <thead className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-white/10">
          <tr>
            <th className="px-6 py-4 w-[30%]">Tên Mục tiêu / Yếu tố</th>
            <th className="px-6 py-4 w-[20%]">Đơn vị / Người đảm nhiệm</th>
            <th className="px-6 py-4 w-[15%]">Chu kỳ thực hiện</th>
            <th className="px-6 py-4 w-[25%]">Tiến độ</th>
            <th className="px-6 py-4 text-center w-[10%]">Hiệu suất</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {data.map(obj => {
            const isObjExp = expandedObj[obj.id]
            return (
            <React.Fragment key={obj.id}>
              {/* LEVEL 0: OBJECTIVE */}
              <tr 
                className={`hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group ${isObjExp ? 'bg-slate-50 dark:bg-white/[0.02]' : ''}`} 
                onClick={() => onRowClick('OBJECTIVE', obj)}
              >
                <td className="px-6 py-4 align-top whitespace-normal">
                  <div className="flex items-start gap-3">
                    <button 
                      onClick={(e) => toggleObj(obj.id, e)} 
                      className="p-1 mt-0.5 rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shadow-sm"
                    >
                      {isObjExp ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-tight mb-1.5">{obj.name}</div>
                      <div className="text-[11px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800/50 inline-block px-1.5 rounded">{obj.code}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 align-top whitespace-normal">
                  <div className="font-semibold text-slate-800 dark:text-slate-300">{obj.unitName}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{obj.unitCode}</div>
                </td>
                <td className="px-6 py-4 align-top text-slate-600 dark:text-slate-400 text-[13px] font-medium">
                  {formatDate(obj.startDate)} <br/><span className="text-slate-400 dark:text-slate-600">-</span><br/> {formatDate(obj.endDate)}
                </td>
                <td className="px-6 py-4 align-top">
                  <ProgressBar 
                    value={obj.progress} 
                    subText={obj.completedKeyResults === obj.totalKeyResults 
                      ? "Tất cả KR đã hoàn thành" 
                      : `${obj.completedKeyResults} hoàn thành / ${obj.totalKeyResults - obj.completedKeyResults} chưa hoàn thành`} 
                  />
                </td>
                <td className="px-6 py-4 align-top text-center">
                  <SparklineDonut value={obj.performance} />
                </td>
              </tr>

              {/* LEVEL 1: KEY RESULTS */}
              {isObjExp && obj.keyResults?.map(kr => {
                const isKrExp = expandedKr[kr.id]
                return (
                <React.Fragment key={kr.id}>
                  <tr 
                    className={`bg-slate-50 dark:bg-slate-800/20 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group border-l-[3px] border-l-indigo-400 dark:border-l-indigo-500/40 ${isKrExp ? 'bg-slate-100 dark:bg-slate-800/40' : ''}`} 
                    onClick={() => onRowClick('KR', kr)}
                  >
                    <td className="px-6 py-4 align-top whitespace-normal pl-12">
                      <div className="flex items-start gap-3">
                        <button 
                          onClick={(e) => toggleKr(kr.id, e)} 
                          className="p-1 mt-0.5 rounded text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                        >
                          {isKrExp ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                        <div>
                          <div className="font-medium text-slate-800 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-tight mb-1.5">{kr.name}</div>
                          <div className="text-[10px] font-mono text-slate-500 bg-white dark:bg-slate-800/50 inline-block px-1.5 rounded border border-slate-200 dark:border-transparent">{kr.code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top whitespace-normal">
                      <div className="font-semibold text-slate-800 dark:text-slate-300">{kr.unitName || '---'}</div>
                      {kr.unitCode && <div className="text-[11px] text-slate-500 mt-1">{kr.unitCode}</div>}
                    </td>
                    <td className="px-6 py-4 align-top text-slate-600 dark:text-slate-400 text-[13px] font-medium">
                      {formatDate(kr.startDate)} <br/><span className="text-slate-400 dark:text-slate-600">-</span><br/> {formatDate(kr.endDate)}
                    </td>
                    <td className="px-6 py-4 align-top">
                      <ProgressBar 
                        value={kr.progress} 
                        subText={`${kr.kpis?.length || 0} KPI(s)`} 
                      />
                    </td>
                    <td className="px-6 py-4 align-top text-center">
                      <SparklineDonut value={kr.performance} />
                    </td>
                  </tr>

                  {/* LEVEL 2: KPIs */}
                  {isKrExp && kr.kpis?.map(kpi => {
                    const isKpiExp = expandedKpi[kpi.id]
                    const hasSubmissions = kpi.submissions && kpi.submissions.length > 0
                    return (
                      <React.Fragment key={kpi.id}>
                        <tr 
                          className="bg-white dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors border-l-[3px] border-l-indigo-200 dark:border-l-indigo-500/10 cursor-pointer group"
                          onClick={() => onRowClick('KPI', kpi)}
                        >
                          <td className="px-6 py-4 align-top whitespace-normal pl-20">
                            <div className="flex items-start gap-3">
                              {hasSubmissions ? (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleKpi(kpi.id, e)
                                  }} 
                                  className="p-1 mt-0.5 rounded text-slate-400 hover:text-slate-650 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                >
                                  {isKpiExp ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                </button>
                              ) : (
                                <div className="w-5 h-5 flex-shrink-0" />
                              )}
                              <div>
                                <div className="text-[13px] font-medium text-slate-700 dark:text-slate-300 leading-tight mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                  {kpi.name}
                                </div>
                                <div className="text-[9px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-800 inline-block px-1 rounded border border-slate-100 dark:border-transparent">
                                  KPI
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 align-top whitespace-normal">
                            <div className="font-semibold text-slate-700 dark:text-slate-400">{kpi.unitName || '---'}</div>
                            {kpi.unitCode && <div className="text-[11px] text-slate-500 mt-1">{kpi.unitCode}</div>}
                          </td>
                          <td className="px-6 py-4 align-top text-slate-600 dark:text-slate-400 text-[13px] font-medium">
                            {formatDate(kpi.startDate)} <br/><span className="text-slate-400 dark:text-slate-600">-</span><br/> {formatDate(kpi.endDate)}
                          </td>
                          <td className="px-6 py-4 align-top">
                            <ProgressBar 
                              value={kpi.progress} 
                              subText={`${kpi.submissions?.length || 0} bài nộp`} 
                            />
                          </td>
                          <td className="px-6 py-4 align-top text-center">
                            <SparklineDonut value={kpi.performance} />
                          </td>
                        </tr>

                        {/* LEVEL 3: SUBMISSIONS */}
                        {isKpiExp && hasSubmissions && kpi.submissions!.map(sub => (
                          <tr key={sub.id} className="bg-slate-50/40 dark:bg-slate-950/20 hover:bg-slate-100/30 dark:hover:bg-slate-900/10 border-l-[3px] border-l-slate-300 dark:border-l-slate-800">
                            <td className="px-6 py-3 whitespace-normal pl-32">
                              <div className="text-[12px] text-slate-500 dark:text-slate-400 leading-tight flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 dark:bg-indigo-500 flex-shrink-0" />
                                <span className="font-medium text-slate-600 dark:text-slate-350">{sub.note || `Bài nộp #${sub.id.substring(0, 4)}`}</span>
                              </div>
                            </td>
                            <td className="px-6 py-3 whitespace-normal">
                              <div className="font-semibold text-slate-750 dark:text-slate-300 text-[12.5px]">{sub.submittedByName || '---'}</div>
                              {sub.submittedByCode && <div className="text-[10px] font-mono text-slate-450 mt-0.5 bg-slate-100/80 dark:bg-slate-800/80 inline-block px-1 rounded">{sub.submittedByCode}</div>}
                            </td>
                            <td className="px-6 py-3 text-slate-500 dark:text-slate-450 text-[12px] font-medium">
                              {formatDate(sub.createdAt)}
                            </td>
                            <td className="px-6 py-3">
                              <StatusBadge status={sub.status === 'APPROVED' ? 'ĐÃ DUYỆT' : sub.status === 'PENDING' ? 'CHỜ DUYỆT' : sub.status === 'REJECTED' ? 'TỪ CHỐI' : sub.status} />
                            </td>
                            <td className="px-6 py-3 text-center text-slate-600 dark:text-slate-300 font-bold text-xs">
                              {sub.actualValue}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    )
                  })}
                </React.Fragment>
              )})}
            </React.Fragment>
          )})}
          {data.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-16 text-center text-slate-500 dark:text-slate-400">
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-white/5">
                    <ChevronDown className="w-6 h-6 opacity-50" />
                  </div>
                  <p>Không có dữ liệu mục tiêu để hiển thị</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
