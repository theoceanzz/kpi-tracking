import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Layers } from 'lucide-react'
import { SortHeader } from '@/components/common/SortHeader'
import { ObjectiveDetailedDto } from '@/types/stats'
import { format } from 'date-fns'
import { KpiTypeTags } from './KpiTypeTags'
import { QualitativeResultChip } from './QualitativeResultChip'
import { toChildNodes } from './KpiChildList'
import { KpiChildTableRows } from './KpiChildTableRows'
import { KpiResponsibleCell } from './KpiResponsibleCell'
import { KpiPeriodCell } from './KpiPeriodCell'
import { KpiWeightPill } from './KpiWeightPill'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type SortField = 'progress' | 'period'
type SortDir = 'asc' | 'desc'

const ProgressBar = ({ value, subText }: { value: number, subText: string }) => {
  const pct = Math.round(value)
  return (
    <div className="w-full flex flex-col gap-1 min-w-[150px]">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-[var(--color-muted)] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${pct >= 100 ? 'bg-[var(--color-success-solid)]' : 'bg-[var(--color-primary)]'}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-[var(--color-foreground)]">{pct}%</span>
      </div>
      <div className="text-caption font-medium">{subText}</div>
    </div>
  )
}

const StatusBadge = ({ status }: { status: string }) => {
  let bg = 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)] border-[var(--color-border-strong)]'
  if (status === 'ĐÃ DUYỆT') bg = 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]'
  else if (status === 'CHỜ DUYỆT') bg = 'bg-[var(--color-info-bg)] text-[var(--color-info)] border-[var(--color-info-border)]'
  else if (status === 'TỪ CHỐI') bg = 'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error-border)]'
  else if (status === 'CHƯA NỘP' || status === 'OVERDUE') bg = 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]'
  else if (status === 'CHƯA ĐƯỢC GIAO') bg = 'bg-[var(--color-border)] text-[var(--color-muted-foreground)] border-[var(--color-border-strong)]'
  
  return <span className={`px-2.5 py-1 rounded-control text-xs font-semibold border ${bg} whitespace-nowrap`}>{status}</span>
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
  const formatDate = (d: string | null) => d ? format(new Date(d), 'dd/MM/yyyy') : '---'

  return (
    <div className="p-4 border-b border-[var(--color-border)] space-y-3 active:bg-[var(--color-muted)] dark:active:bg-white/5 transition-colors" onClick={() => onRowClick('OBJECTIVE', obj)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm text-[var(--color-foreground)] leading-tight">{obj.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-caption truncate">{obj.unitName}</span>
            <span className="text-caption">|</span>
            <span className="text-xs font-mono text-[var(--color-subtle-foreground)]">{obj.unitCode}</span>
          </div>
          <div className="mt-2 inline-flex items-center px-1.5 py-0.5 rounded bg-[var(--color-muted)] border border-[var(--color-border)]">
            <span className="text-caption tracking-tight">{obj.code}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-caption font-medium">
        {(obj.periodCount ?? 0) > 1 ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-xs font-medium" title={obj.periodNames?.join(',')}>
            <Layers size={11} /> Nhiều đợt ({obj.periodCount})
          </span>
        ) : obj.periodCount === 1 && obj.periodNames?.[0] ? (
          <span className="font-semibold text-[var(--color-muted-foreground)]">{obj.periodNames[0]}</span>
        ) : null}
        <span>{formatDate(obj.startDate)}</span>
        <span className="text-[var(--color-subtle-foreground)]">—</span>
        <span>{formatDate(obj.endDate)}</span>
      </div>

      <div className="flex items-center gap-4 pt-1 border-t border-[var(--color-border)]">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-eyebrow">Tiến độ</span>
            <span className="text-xs font-semibold">{pct}%</span>
          </div>
          <div className="h-2 bg-[var(--color-muted)] rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full shadow-sm', pct >= 100 ? 'bg-[var(--color-success-solid)]' : 'bg-[var(--color-primary)]')} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
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
  <div className="inline-flex flex-col gap-1 text-xs">
    <div className="flex items-center gap-1.5">
      <span className="w-[26px] shrink-0 font-medium text-[var(--color-subtle-foreground)]">Từ</span>
      <span className="font-semibold text-[var(--color-foreground)] tabular-nums">{formatDate(start)}</span>
    </div>
    <div className="w-full h-px bg-[var(--color-muted)]" />
    <div className="flex items-center gap-1.5">
      <span className="w-[26px] shrink-0 font-medium text-[var(--color-primary)]">Đến</span>
      <span className="font-semibold text-[var(--color-foreground)] tabular-nums">{formatDate(end)}</span>
    </div>
  </div>
)

/**
 * Ô "Đợt" cho dòng Mục tiêu / KR (có thể trải nhiều đợt):
 * - 1 đợt   → hiện tên đợt + khoảng ngày (giống dòng KPI).
 * - nhiều đợt → chip "Nhiều đợt (N)" + khoảng ngày, hover xem danh sách tên đợt.
 * - không xác định → chỉ khoảng ngày.
 */
const ObjectivePeriodCell = ({ periodCount, periodNames, start, end }: {
  periodCount?: number; periodNames?: string[]; start: string | null; end: string | null
}) => {
  if (periodCount === 1 && periodNames?.[0]) {
    return <KpiPeriodCell periodName={periodNames[0]} start={start} end={end} />
  }
  if ((periodCount ?? 0) > 1) {
    return (
      <div className="flex flex-col gap-1.5" title={periodNames?.join(', ')}>
        <span className="inline-flex w-fit items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-xs font-medium">
          <Layers size={11} /> Nhiều đợt ({periodCount})
        </span>
        <DateRange start={start} end={end} />
      </div>
    )
  }
  return <DateRange start={start} end={end} />
}

  return (
    <div className="w-full">
      {/* Mobile View */}
      <div className="md:hidden divide-y divide-[var(--color-border)]">
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
          <thead className="bg-[var(--color-muted)]">
            <tr className="text-eyebrow">
              <th className="px-6 py-4 w-[30%]">Tên Mục tiêu / Yếu tố</th>
              <th className="px-6 py-4 w-[20%]">Đơn vị / Người đảm nhiệm</th>
              <th className="px-6 py-4 w-[15%]" title="Sắp theo thời gian bắt đầu">
                <SortHeader field="period" active={sortBy} dir={sortDir} onToggle={onToggleSort} className="">
                  Đợt
                </SortHeader>
              </th>
              <th className="px-6 py-4 w-[25%]">
                <SortHeader field="progress" active={sortBy} dir={sortDir} onToggle={onToggleSort} className="">
                  Tiến độ
                </SortHeader>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
          {data.map(obj => {
            const isObjExp = expandedObj[obj.id]
            return (
            <React.Fragment key={obj.id}>
              {/* LEVEL 0: OBJECTIVE */}
              <tr 
                className={`hover:bg-slate-50 dark:hover:bg-[var(--color-card)]/5 transition-colors cursor-pointer group ${isObjExp ? 'bg-[var(--color-muted)] dark:bg-white/[0.02]' : ''}`} 
                onClick={() => onRowClick('OBJECTIVE', obj)}
              >
                <td className="px-6 py-4 align-top whitespace-normal">
                  <div className="flex items-start gap-3">
                    <Button variant="outline" className="mt-0.5" onClick={(e) => toggleObj(obj.id, e)}>
                      {isObjExp ? <ChevronDown aria-hidden="true" className="w-4 h-4" /> : <ChevronRight aria-hidden="true" className="w-4 h-4" />}
                    </Button>
                    <div>
                      <div className="font-semibold text-[var(--color-foreground)] group-hover:text-[var(--color-primary)] transition-colors leading-tight mb-1.5">{obj.name}</div>
                      <div className="text-xs font-mono text-[var(--color-muted-foreground)] bg-[var(--color-muted)] inline-block px-1.5 rounded">{obj.code}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 align-top whitespace-normal">
                  <div className="font-semibold text-[var(--color-foreground)]">{obj.unitName}</div>
                  <div className="text-caption mt-1">{obj.unitCode}</div>
                </td>
                <td className="px-6 py-4 align-middle">
                  <ObjectivePeriodCell periodCount={obj.periodCount} periodNames={obj.periodNames} start={obj.startDate} end={obj.endDate} />
                </td>
                <td className="px-6 py-4 align-top">
                  <ProgressBar 
                    value={obj.progress} 
                    subText={obj.completedKeyResults === obj.totalKeyResults 
                      ? "Tất cả KR đã hoàn thành" 
                      : `${obj.completedKeyResults} hoàn thành / ${obj.totalKeyResults - obj.completedKeyResults} chưa hoàn thành`} 
                  />
                </td>
              </tr>

              {/* LEVEL 1: KEY RESULTS */}
              {isObjExp && obj.keyResults?.map(kr => {
                const isKrExp = expandedKr[kr.id]
                return (
                <React.Fragment key={kr.id}>
                  <tr 
                    className={`bg-[var(--color-muted)] hover:bg-[var(--color-muted)] transition-colors cursor-pointer group border-l-[3px] border-l-[var(--color-primary)] ${isKrExp ? 'bg-[var(--color-muted)]' : ''}`} 
                    onClick={() => onRowClick('KR', kr)}
                  >
                    <td className="px-6 py-4 align-top whitespace-normal pl-12">
                      <div className="flex items-start gap-3">
                        <Button variant="secondary" className="mt-0.5" onClick={(e) => toggleKr(kr.id, e)}>
                          {isKrExp ? <ChevronDown aria-hidden="true" className="w-3.5 h-3.5" /> : <ChevronRight aria-hidden="true" className="w-3.5 h-3.5" />}
                        </Button>
                        <div>
                          <div className="font-medium text-[var(--color-foreground)] group-hover:text-[var(--color-primary)] transition-colors leading-tight mb-1.5">{kr.name}</div>
                          <div className="text-xs font-mono text-[var(--color-muted-foreground)] bg-[var(--color-card)] inline-block px-1.5 rounded border border-[var(--color-border)] dark:border-transparent">{kr.code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top whitespace-normal">
                      {kr.assignedUnits && kr.assignedUnits.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-w-[260px]">
                          {kr.assignedUnits.map(u => (
                            <span
                              key={u.orgUnitId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-xs font-semibold"
                              title={u.orgUnitCode || u.orgUnitName}
                            >
                              {u.orgUnitName}
                              {u.weightPercentage != null && (
                                <span className="text-[var(--color-primary)]">· {Math.round(u.weightPercentage)}%</span>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <>
                          <div className="font-semibold text-[var(--color-foreground)]">{kr.unitName || '---'}</div>
                          {kr.unitCode && <div className="text-caption mt-1">{kr.unitCode}</div>}
                        </>
                      )}
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <ObjectivePeriodCell periodCount={kr.periodCount} periodNames={kr.periodNames} start={kr.startDate} end={kr.endDate} />
                    </td>
                    <td className="px-6 py-4 align-top">
                      <ProgressBar 
                        value={kr.progress} 
                        subText={`${kr.kpis?.length || 0} KPI(s)`} 
                      />
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
                          className="bg-[var(--color-card)] hover:bg-[var(--color-muted)] transition-colors border-l-[3px] border-l-[var(--color-primary)] cursor-pointer group"
                          onClick={() => onRowClick('KPI', kpi)}
                        >
                          <td className="px-6 py-4 align-top whitespace-normal pl-20">
                            <div className="flex items-start gap-3">
                              {isExpandable ? (
                                <Button variant="secondary" className="mt-0.5" onClick={(e) => {
                                    e.stopPropagation()
                                    toggleKpi(kpi.id, e)
                                  }}>
                                  {isKpiExp ? <ChevronDown aria-hidden="true" className="w-3 h-3" /> : <ChevronRight aria-hidden="true" className="w-3 h-3" />}
                                </Button>
                              ) : (
                                <div className="w-5 h-5 flex-shrink-0" />
                              )}
                              <div>
                                <div className="text-[13px] font-medium text-[var(--color-foreground)] leading-tight mb-1 group-hover:text-[var(--color-primary)] transition-colors">
                                  {kpi.name}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <KpiTypeTags
                                    isReverseKpi={kpi.isReverseKpi}
                                    isBonusKpi={kpi.isBonusKpi}
                                    isQualitative={kpi.kpiType === 'QUALITATIVE'}
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
                            {!kpi.assigneeName && kpi.unitCode && <div className="text-caption mt-1">{kpi.unitCode}</div>}
                          </td>
                          <td className="px-6 py-4 align-middle">
                            <KpiPeriodCell periodName={kpi.periodName} start={kpi.startDate} end={kpi.endDate} />
                          </td>
                          <td className="px-6 py-4 align-top">
                            {kpi.kpiType === 'QUALITATIVE' ? (
                              <div className="flex flex-col gap-1 min-w-[150px]">
                                <QualitativeResultChip level={kpi.qualitativeLevelName} className="w-fit" />
                                <div className="text-caption font-medium">{`${kpi.participants?.length || 0} người tham gia`}</div>
                              </div>
                            ) : kpi.progress == null ? (
                              <div className="flex flex-col gap-1 min-w-[150px]">
                                <span className="inline-flex w-fit items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning)] text-xs font-semibold">Thưởng</span>
                                <div className="text-caption font-medium">{`${kpi.participants?.length || 0} người tham gia`}</div>
                              </div>
                            ) : (
                              <ProgressBar
                                value={kpi.progress}
                                subText={`${kpi.participants?.length || 0} người tham gia`}
                              />
                            )}
                          </td>
                        </tr>

                        {/* LEVEL 3: KPI CON (cha/thác nước) — render thành <tr> căn thẳng cột với cha */}
                        {isKpiExp && hasChildren && (
                          <KpiChildTableRows
                            nodes={toChildNodes(kpi.children)}
                            onSelect={(id) => onRowClick('KPI', { id })}
                            headingColSpan={4}
                            variant={{ showPersonColumn: true, accent: 'indigo', baseIndent: 88 }}
                          />
                        )}

                        {/* LEVEL 3 & 4: PARTICIPANTS CONTAINER — KPI cha (decomposition) chỉ chia nhỏ task → ẩn */}
                        {isKpiExp && hasParticipants && kpi.childRelationType !== 'DECOMPOSITION' && (
                          <tr className="bg-[var(--color-muted)] border-l-[3px] border-l-slate-300 dark:border-l-slate-700">
                            <td colSpan={4} className="p-0 border-b-0">
                              <div className="py-5 pr-6 pl-24">
                                {/* PARTICIPANTS SECTION */}
                                <div className="text-eyebrow mb-3 ml-2 flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-soft)]"></span>
                                  {kpi.childRelationType === 'DELEGATION' ? 'Người chịu trách nhiệm' : 'Các thành viên đảm nhiệm'}
                                </div>
                                <div className="space-y-3">
                                  {kpi.participants!.map(p => {
                                    const pKey = `${kpi.id}-${p.userId}`;
                                    const isParticipantExp = expandedParticipant[pKey];
                                    const hasSubmissions = p.submissions && p.submissions.length > 0;
                                    
                                    return (
                                      <div key={pKey} className="bg-[var(--color-card)] rounded-card border border-[var(--color-border)] shadow-sm overflow-hidden transition-all">
                                        {/* Participant Header (Card) */}
                                        <div 
                                          className={`p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--color-muted)] transition-colors ${isParticipantExp ? 'border-b border-[var(--color-border)] bg-[var(--color-muted)]' : ''}`}
                                          onClick={(e) => hasSubmissions && toggleParticipant(pKey, e)}
                                        >
                                          <div className="flex items-center gap-4 min-w-[280px]">
                                            {hasSubmissions ? (
                                              <Button variant="secondary">
                                                {isParticipantExp ? <ChevronDown aria-hidden="true" className="w-4 h-4" /> : <ChevronRight aria-hidden="true" className="w-4 h-4" />}
                                              </Button>
                                            ) : (
                                              <div className="w-6 h-6 flex-shrink-0" />
                                            )}
                                            
                                            <div className="flex items-center gap-3">
                                              {p.avatarUrl ? (
                                                <img src={p.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-[var(--color-border)] shadow-sm" />
                                              ) : (
                                                <div className="w-10 h-10 rounded-full bg-[var(--color-muted)] flex items-center justify-center text-sm font-medium text-[var(--color-muted-foreground)] border border-[var(--color-border)] shadow-sm">
                                                  {p.fullName.charAt(0).toUpperCase()}
                                                </div>
                                              )}
                                              <div>
                                                <div className="font-medium text-[var(--color-foreground)] text-sm mb-0.5">{p.fullName}</div>
                                                {p.employeeCode && <div className="text-xs font-mono text-[var(--color-muted-foreground)] bg-[var(--color-muted)] px-1.5 py-0.5 rounded inline-block">{p.employeeCode}</div>}
                                              </div>
                                            </div>
                                          </div>
                                          
                                          <div className="flex-1 flex items-center justify-between px-6 pl-10 border-l border-[var(--color-border)]">
                                            <div className="min-w-[160px]">
                                              <div className="text-sm font-medium text-[var(--color-foreground)]">{p.roleName || '---'}</div>
                                              <div className="text-xs text-[var(--color-muted-foreground)] mt-0.5">{p.orgUnitName || '---'}</div>
                                            </div>
                                            
                                            {kpi.kpiType === 'QUALITATIVE' ? (
                                              <div className="flex-1 flex items-center justify-end px-6">
                                                <div className="flex flex-col items-end gap-1.5">
                                                  <span className="text-eyebrow">Mức đánh giá</span>
                                                  <QualitativeResultChip level={p.qualitativeLevelName} />
                                                </div>
                                              </div>
                                            ) : (
                                            <>
                                            <div className="flex-1 max-w-[320px] px-6">
                                              <div className="text-eyebrow flex justify-between items-center mb-1">
                                                <span>Tiến độ cá nhân</span>
                                                <span className="font-semibold text-[var(--color-foreground)]">{Math.round(p.progress)}%</span>
                                              </div>
                                              <div className="h-2.5 w-full bg-[var(--color-muted)] rounded-full overflow-hidden border border-[var(--color-border)]">
                                                <div
                                                  className={`h-full rounded-full transition-all duration-1000 ${
                                                    p.progress >= 100 ? 'bg-[var(--color-success-solid)]' :
                                                    p.progress >= 50 ? 'bg-[var(--color-warning-solid)]' : 'bg-[var(--color-error-solid)]'
                                                  }`}
                                                  style={{ width: `${Math.min(p.progress, 100)}%` }}
                                                />
                                              </div>
                                              <div className={`text-xs font-semibold mt-1.5 ${
                                                p.progress >= 100 ? 'text-[var(--color-success)]' :
                                                p.progress >= 50 ? 'text-[var(--color-warning)]' : 'text-[var(--color-error)]'
                                              }`}>
                                                {p.actualValue} {kpi.unit || ''}
                                              </div>
                                            </div>

                                            <div className="flex flex-col items-center justify-center ml-8 min-w-[80px]">
                                              <span className="text-eyebrow mb-1">Hiệu suất</span>
                                              <span className="text-lg font-semibold text-[var(--color-primary)]">{Math.round(p.performance)}%</span>
                                            </div>
                                            </>
                                            )}
                                          </div>
                                        </div>
                                        
                                        {/* Participant Submissions */}
                                        {isParticipantExp && hasSubmissions && (
                                          <div className="bg-[var(--color-muted)] p-4 pt-3 pb-5">
                                            <div className="text-eyebrow mb-3 ml-12">Lịch sử bài nộp</div>
                                            <div className="space-y-2.5 pl-12 pr-4">
                                              {p.submissions!.map(sub => {
                                                const subProgress = (sub.actualValue / (kpi.targetValue || 1)) * 100;
                                                return (
                                                  <div key={sub.id} className="flex items-center bg-[var(--color-card)] border border-[var(--color-border)] rounded-control p-3.5 shadow-sm transition-shadow">
                                                    <div className="min-w-[220px] pr-4">
                                                      <div className="font-medium text-[13px] text-[var(--color-foreground)] flex items-center gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-border)]"></span>
                                                        {sub.note || `SUB#${sub.id.substring(0, 4).toUpperCase()}`}
                                                      </div>
                                                    </div>
                                                    
                                                    <div className="min-w-[140px] pr-4">
                                                      <div className="text-eyebrow mb-1">Thời gian nộp</div>
                                                      <div className="text-xs font-medium text-[var(--color-foreground)]">
                                                        {sub.createdAt ? format(new Date(sub.createdAt), 'HH:mm dd/MM/yyyy') : '---'}
                                                      </div>
                                                    </div>
                                                    
                                                    {kpi.kpiType === 'QUALITATIVE' ? (
                                                      <div className="flex-1 px-5 border-x border-[var(--color-border)] flex items-center gap-2">
                                                        <span className="text-eyebrow">Mức</span>
                                                        <QualitativeResultChip level={sub.qualitativeLevelName} />
                                                      </div>
                                                    ) : (
                                                    <>
                                                    <div className="flex-1 px-5 border-x border-[var(--color-border)]">
                                                      <div className="text-eyebrow flex justify-between items-center mb-1">
                                                        <span>Đóng góp</span>
                                                        <span className="font-semibold text-[var(--color-foreground)]">{subProgress.toFixed(1)}%</span>
                                                      </div>
                                                      <div className="h-1.5 w-full bg-[var(--color-muted)] rounded-full overflow-hidden">
                                                        <div
                                                          className={`h-full rounded-full transition-all duration-1000 ${
                                                            subProgress >= 100 ? 'bg-[var(--color-success-solid)]' :
                                                            subProgress >= 50 ? 'bg-[var(--color-warning-solid)]' : 'bg-[var(--color-error-solid)]'
                                                          }`}
                                                          style={{ width: `${Math.min(subProgress, 100)}%` }}
                                                        />
                                                      </div>
                                                      <div className={`text-[10.5px] font-semibold mt-1.5 ${
                                                        subProgress >= 100 ? 'text-[var(--color-success)]' :
                                                        subProgress >= 50 ? 'text-[var(--color-warning)]' : 'text-[var(--color-error)]'
                                                      }`}>+{sub.actualValue} {kpi.unit || ''}</div>
                                                    </div>

                                                    <div className="min-w-[120px] flex flex-col items-center justify-center px-4">
                                                      <span className="text-eyebrow mb-1">Hiệu suất</span>
                                                      <span className="text-sm font-medium text-[var(--color-primary)]">{subProgress.toFixed(1)}%</span>
                                                    </div>
                                                    </>
                                                    )}

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
              <td colSpan={4} className="px-6 py-16 text-center text-[var(--color-muted-foreground)]">
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-[var(--color-muted)] flex items-center justify-center text-[var(--color-subtle-foreground)] border border-[var(--color-border)] /5">
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
