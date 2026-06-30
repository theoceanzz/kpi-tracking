import React, { useState } from 'react'
import { ChevronDown, ChevronRight, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { ObjectiveDetailedDto } from '@/types/stats'
import { format } from 'date-fns'
import { KpiTypeTags } from './KpiTypeTags'
import { toChildNodes } from './KpiChildList'
import { KpiChildTableRows } from './KpiChildTableRows'
import { KpiResponsibleCell } from './KpiResponsibleCell'
import { KpiPeriodCell } from './KpiPeriodCell'
import { KpiWeightPill } from './KpiWeightPill'
import { cn } from '@/lib/utils'

type SortField = 'progress' | 'performance'
type SortDir = 'asc' | 'desc'

const SparklineDonut = ({ value }: { value: number | null }) => {
  if (value === null) return <span className="text-slate-400 dark:text-slate-500 font-medium">-</span>
  const radius = 16
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (Math.min(value, 100) / 100) * circumference
  const color = value >= 100 ? '#10b981' : value >= 80 ? '#6366f1' : value >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative flex items-center justify-center w-10 h-10 mx-auto group-hover:scale-110 transition-transform">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-100 dark:text-slate-800" />
        <circle cx="20" cy="20" r="16" stroke={color} strokeWidth="4" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="transition-all duration-1000 ease-out" strokeLinecap="round" />
      </svg>
      <span className="absolute text-[9px] font-black text-slate-700 dark:text-slate-300">{Math.round(value)}%</span>
    </div>
  )
}

const ProgressBar = ({ value, subText }: { value: number, subText: string }) => {
  const pct = Math.round(value)
  return (
    <div className="w-full flex flex-col gap-1 min-w-[150px]">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <span className="text-xs font-black text-slate-800 dark:text-slate-200">{pct}%</span>
      </div>
      <div className="text-[10px] text-slate-500 font-medium">{subText}</div>
    </div>
  )
}

function SortHeader({
  field, active, dir, onToggle, children,
}: {
  field: SortField
  active: SortField
  dir: SortDir
  onToggle: (f: SortField) => void
  children: React.ReactNode
}) {
  const isActive = active === field
  return (
    <button
      onClick={onToggle ? () => onToggle(field) : undefined}
      className="flex items-center gap-1 group hover:text-indigo-500 transition-colors uppercase"
    >
      {children}
      <span className="ml-0.5">
        {isActive
          ? dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
          : <ChevronsUpDown size={12} className="opacity-30 group-hover:opacity-60" />}
      </span>
    </button>
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
  sortBy: SortField;
  sortDir: SortDir;
  onToggleSort: (field: SortField) => void;
}

function MobileObjectiveCard({ obj, onRowClick }: { obj: ObjectiveDetailedDto; onRowClick: any }) {
  const pct = Math.round(obj.progress || 0)
  const perf = Math.round(obj.performance || 0)
  const formatDate = (d: string | null) => d ? format(new Date(d), 'dd/MM/yyyy') : '---'

  return (
    <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3 active:bg-slate-50 dark:active:bg-white/5 transition-colors" onClick={() => onRowClick('OBJECTIVE', obj)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-slate-900 dark:text-white leading-tight">{obj.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-slate-500 truncate">{obj.unitName}</span>
            <span className="text-[10px] text-slate-300 dark:text-slate-600">|</span>
            <span className="text-[10px] font-mono text-slate-400">{obj.unitCode}</span>
          </div>
          <div className="mt-2 inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50">
            <span className="text-[9px] font-bold text-slate-500 tracking-tight">{obj.code}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
        <span>{formatDate(obj.startDate)}</span>
        <span className="text-slate-200 dark:text-slate-800">—</span>
        <span>{formatDate(obj.endDate)}</span>
      </div>

      <div className="flex items-center gap-4 pt-1 border-t border-slate-50 dark:border-slate-800/50">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Tiến độ</span>
            <span className="text-[11px] font-black">{pct}%</span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
            <div className={cn('h-full rounded-full shadow-sm', pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500')} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        </div>
        <div className="text-right shrink-0 border-l border-slate-100 dark:border-slate-800 pl-4 py-1">
          <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Hiệu suất</p>
          <p className={cn('text-base font-black leading-none', perf >= 100 ? 'text-emerald-500' : perf >= 80 ? 'text-indigo-500' : perf >= 50 ? 'text-amber-500' : 'text-red-500')}>{perf}%</p>
        </div>
      </div>
    </div>
  )
}

export default function ObjectiveDetailedTable({ data, onRowClick, sortBy, sortDir, onToggleSort }: Props) {
  const [expandedObj, setExpandedObj] = useState<Record<string, boolean>>({})
  const [expandedKr, setExpandedKr] = useState<Record<string, boolean>>({})
  const [expandedKpi, setExpandedKpi] = useState<Record<string, boolean>>({})
  const [expandedParticipant, setExpandedParticipant] = useState<Record<string, boolean>>({})

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
  const toggleParticipant = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedParticipant(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const formatDate = (d: string | null) => d ? format(new Date(d), 'dd/MM/yyyy') : '---'

const DateRange = ({ start, end }: { start: string | null; end: string | null }) => (
  <div className="inline-flex flex-col gap-1 text-[11px]">
    <div className="flex items-center gap-1.5">
      <span className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-[26px] shrink-0">Từ</span>
      <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">{formatDate(start)}</span>
    </div>
    <div className="w-full h-px bg-slate-100 dark:bg-slate-800" />
    <div className="flex items-center gap-1.5">
      <span className="font-bold text-indigo-400 dark:text-indigo-500 uppercase tracking-wider w-[26px] shrink-0">Đến</span>
      <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">{formatDate(end)}</span>
    </div>
  </div>
)

  return (
    <div className="w-full">
      {/* Mobile View */}
      <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
        {data.map(obj => (
          <MobileObjectiveCard 
            key={obj.id}
            obj={obj} 
            onRowClick={onRowClick} 
          />
        ))}
      </div>

      {/* Desktop View */}
      <div className="hidden md:block overflow-x-auto custom-scrollbar">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr className="text-xs font-black uppercase text-slate-500">
              <th className="px-6 py-4 w-[30%]">Tên Mục tiêu / Yếu tố</th>
              <th className="px-6 py-4 w-[20%]">Đơn vị / Người đảm nhiệm</th>
              <th className="px-6 py-4 w-[15%]">Đợt</th>
              <th className="px-6 py-4 w-[25%]">
                <SortHeader field="progress" active={sortBy} dir={sortDir} onToggle={onToggleSort}>
                  Tiến độ
                </SortHeader>
              </th>
              <th className="px-6 py-4 text-center w-[10%]">
                <div className="flex justify-center">
                  <SortHeader field="performance" active={sortBy} dir={sortDir} onToggle={onToggleSort}>
                    Hiệu suất
                  </SortHeader>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
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
                <td className="px-6 py-4 align-middle">
                  <DateRange start={obj.startDate} end={obj.endDate} />
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
                      {kr.assignedUnits && kr.assignedUnits.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-w-[260px]">
                          {kr.assignedUnits.map(u => (
                            <span
                              key={u.orgUnitId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold"
                              title={u.orgUnitCode || u.orgUnitName}
                            >
                              {u.orgUnitName}
                              {u.weightPercentage != null && (
                                <span className="text-indigo-400 dark:text-indigo-500">· {Math.round(u.weightPercentage)}%</span>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <>
                          <div className="font-semibold text-slate-800 dark:text-slate-300">{kr.unitName || '---'}</div>
                          {kr.unitCode && <div className="text-[11px] text-slate-500 mt-1">{kr.unitCode}</div>}
                        </>
                      )}
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <DateRange start={kr.startDate} end={kr.endDate} />
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
                    const hasParticipants = kpi.participants && kpi.participants.length > 0
                    const hasChildren = kpi.children && kpi.children.length > 0
                    const isExpandable = hasParticipants || hasChildren
                    // KPI cha/thác nước mặc định mở sẵn KPI con; người dùng vẫn bấm để thu gọn.
                    const isKpiExp = expandedKpi[kpi.id] !== undefined ? expandedKpi[kpi.id] : hasChildren
                    return (
                      <React.Fragment key={kpi.id}>
                        <tr 
                          className="bg-white dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors border-l-[3px] border-l-indigo-200 dark:border-l-indigo-500/10 cursor-pointer group"
                          onClick={() => onRowClick('KPI', kpi)}
                        >
                          <td className="px-6 py-4 align-top whitespace-normal pl-20">
                            <div className="flex items-start gap-3">
                              {isExpandable ? (
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
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <KpiTypeTags
                                    isReverseKpi={kpi.isReverseKpi}
                                    isBonusKpi={kpi.isBonusKpi}
                                    parentRelationType={kpi.parentRelationType}
                                    childRelationType={kpi.childRelationType}
                                  />
                                  <KpiWeightPill weight={kpi.weight} />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 align-top whitespace-normal">
                            <KpiResponsibleCell assigneeName={kpi.assigneeName} orgUnitName={kpi.unitName} />
                            {!kpi.assigneeName && kpi.unitCode && <div className="text-[11px] text-slate-500 mt-1">{kpi.unitCode}</div>}
                          </td>
                          <td className="px-6 py-4 align-middle">
                            <KpiPeriodCell periodName={kpi.periodName} start={kpi.startDate} end={kpi.endDate} />
                          </td>
                          <td className="px-6 py-4 align-top">
                            {kpi.progress == null ? (
                              <div className="flex flex-col gap-1 min-w-[150px]">
                                <span className="inline-flex w-fit items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase">Thưởng</span>
                                <div className="text-[10px] text-slate-500 font-medium">{`${kpi.participants?.length || 0} người tham gia`}</div>
                              </div>
                            ) : (
                              <ProgressBar
                                value={kpi.progress}
                                subText={`${kpi.participants?.length || 0} người tham gia`}
                              />
                            )}
                          </td>
                          <td className="px-6 py-4 align-top text-center">
                            {kpi.performance == null ? (
                              <span className="text-slate-400 font-black">—</span>
                            ) : (
                              <SparklineDonut value={kpi.performance} />
                            )}
                          </td>
                        </tr>

                        {/* LEVEL 3: KPI CON (cha/thác nước) — render thành <tr> căn thẳng cột với cha */}
                        {isKpiExp && hasChildren && (
                          <KpiChildTableRows
                            nodes={toChildNodes(kpi.children)}
                            onSelect={(id) => onRowClick('KPI', { id })}
                            headingColSpan={5}
                            variant={{ showPersonColumn: true, accent: 'indigo', baseIndent: 88 }}
                          />
                        )}

                        {/* LEVEL 3 & 4: PARTICIPANTS CONTAINER — KPI cha (decomposition) chỉ chia nhỏ task → ẩn */}
                        {isKpiExp && hasParticipants && kpi.childRelationType !== 'DECOMPOSITION' && (
                          <tr className="bg-slate-50/30 dark:bg-slate-900/20 border-l-[3px] border-l-slate-300 dark:border-l-slate-700">
                            <td colSpan={5} className="p-0 border-b-0">
                              <div className="py-5 pr-6 pl-24">
                                {/* PARTICIPANTS SECTION */}
                                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 ml-2 flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 dark:bg-indigo-500"></span>
                                  {kpi.childRelationType === 'DELEGATION' ? 'Người chịu trách nhiệm' : 'Các thành viên đảm nhiệm'}
                                </div>
                                <div className="space-y-3">
                                  {kpi.participants!.map(p => {
                                    const pKey = `${kpi.id}-${p.userId}`;
                                    const isParticipantExp = expandedParticipant[pKey];
                                    const hasSubmissions = p.submissions && p.submissions.length > 0;
                                    
                                    return (
                                      <div key={pKey} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-all hover:shadow-md">
                                        {/* Participant Header (Card) */}
                                        <div 
                                          className={`p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${isParticipantExp ? 'border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-700/30' : ''}`}
                                          onClick={(e) => hasSubmissions && toggleParticipant(pKey, e)}
                                        >
                                          <div className="flex items-center gap-4 min-w-[280px]">
                                            {hasSubmissions ? (
                                              <button className="text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors p-1 bg-slate-100 dark:bg-slate-700 rounded-md">
                                                {isParticipantExp ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                              </button>
                                            ) : (
                                              <div className="w-6 h-6 flex-shrink-0" />
                                            )}
                                            
                                            <div className="flex items-center gap-3">
                                              {p.avatarUrl ? (
                                                <img src={p.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-600 shadow-sm" />
                                              ) : (
                                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 shadow-sm">
                                                  {p.fullName.charAt(0).toUpperCase()}
                                                </div>
                                              )}
                                              <div>
                                                <div className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-0.5">{p.fullName}</div>
                                                {p.employeeCode && <div className="text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded inline-block">{p.employeeCode}</div>}
                                              </div>
                                            </div>
                                          </div>
                                          
                                          <div className="flex-1 flex items-center justify-between px-6 pl-10 border-l border-slate-100 dark:border-slate-700/50">
                                            <div className="min-w-[160px]">
                                              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{p.roleName || '---'}</div>
                                              <div className="text-xs text-slate-500 mt-0.5">{p.orgUnitName || '---'}</div>
                                            </div>
                                            
                                            <div className="flex-1 max-w-[320px] px-6">
                                              <div className="flex justify-between items-center mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                                                <span>Tiến độ cá nhân</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-200">{Math.round(p.progress)}%</span>
                                              </div>
                                              <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden border border-slate-200 dark:border-slate-600">
                                                <div
                                                  className={`h-full rounded-full transition-all duration-1000 ${
                                                    p.progress >= 100 ? 'bg-emerald-500' :
                                                    p.progress >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                                  }`}
                                                  style={{ width: `${Math.min(p.progress, 100)}%` }}
                                                />
                                              </div>
                                              <div className={`text-[11px] font-bold mt-1.5 ${
                                                p.progress >= 100 ? 'text-emerald-600 dark:text-emerald-400' :
                                                p.progress >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                                              }`}>
                                                {p.actualValue} {kpi.unit || ''}
                                              </div>
                                            </div>
                                            
                                            <div className="flex flex-col items-center justify-center ml-8 min-w-[80px]">
                                              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Hiệu suất</span>
                                              <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{Math.round(p.performance)}%</span>
                                            </div>
                                          </div>
                                        </div>
                                        
                                        {/* Participant Submissions */}
                                        {isParticipantExp && hasSubmissions && (
                                          <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 pt-3 pb-5">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-12">Lịch sử bài nộp</div>
                                            <div className="space-y-2.5 pl-12 pr-4">
                                              {p.submissions!.map(sub => {
                                                const subProgress = (sub.actualValue / (kpi.targetValue || 1)) * 100;
                                                return (
                                                  <div key={sub.id} className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3.5 shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="min-w-[220px] pr-4">
                                                      <div className="font-bold text-[13px] text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                                        {sub.note || `SUB#${sub.id.substring(0, 4).toUpperCase()}`}
                                                      </div>
                                                    </div>
                                                    
                                                    <div className="min-w-[140px] pr-4">
                                                      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Thời gian nộp</div>
                                                      <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                                        {sub.createdAt ? format(new Date(sub.createdAt), 'HH:mm dd/MM/yyyy') : '---'}
                                                      </div>
                                                    </div>
                                                    
                                                    <div className="flex-1 px-5 border-x border-slate-100 dark:border-slate-700/50">
                                                      <div className="flex justify-between items-center text-[11px] font-medium uppercase tracking-wider mb-1 text-slate-500">
                                                        <span>Đóng góp</span>
                                                        <span className="font-bold text-slate-700 dark:text-slate-200">{subProgress.toFixed(1)}%</span>
                                                      </div>
                                                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <div
                                                          className={`h-full rounded-full transition-all duration-1000 ${
                                                            subProgress >= 100 ? 'bg-emerald-500' :
                                                            subProgress >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                                          }`}
                                                          style={{ width: `${Math.min(subProgress, 100)}%` }}
                                                        />
                                                      </div>
                                                      <div className={`text-[10.5px] font-bold mt-1.5 ${
                                                        subProgress >= 100 ? 'text-emerald-600 dark:text-emerald-400' :
                                                        subProgress >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                                                      }`}>+{sub.actualValue} {kpi.unit || ''}</div>
                                                    </div>
                                                    
                                                    <div className="min-w-[120px] flex flex-col items-center justify-center px-4">
                                                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Hiệu suất</span>
                                                      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{subProgress.toFixed(1)}%</span>
                                                    </div>
                                                    
                                                    <div className="min-w-[120px] flex justify-end pl-4">
                                                      <StatusBadge status={sub.status === 'APPROVED' ? 'ĐÃ DUYỆT' : sub.status === 'PENDING' ? 'CHỜ DUYỆT' : sub.status === 'REJECTED' ? 'TỪ CHỐI' : sub.status} />
                                                    </div>
                                                  </div>
                                                )
                                              })}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
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
    </div>
  )
}
