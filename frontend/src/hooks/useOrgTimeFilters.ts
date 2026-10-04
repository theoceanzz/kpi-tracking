import { useMemo, useState } from 'react'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useKpiCycles } from '@/features/kpi/hooks/useKpiCycles'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import type { OrgUnitTreeResponse } from '@/types/orgUnit'

/**
 * Bộ lọc "đơn vị" + "kỳ / đợt" dùng chung cho các trang quản lý (BSC, OKR) để hai trang lọc giống
 * hệt nhau.
 *
 * <p>Đơn vị: mặc định đứng ở đơn vị GỐC (xem cả cây); chọn một đơn vị là thu về đơn vị đó và mọi đơn
 * vị con. Kỳ / đợt: một ô duy nhất, mỗi kỳ là một nhóm gồm "Cả kỳ" và các đợt con.
 */

export const ALL_TIME = '__all__'
const ALL = ALL_TIME

export interface TimeSelection {
  kind: 'cycle' | 'period'
  id: string
  /** Khoảng ngày của kỳ / đợt đã chọn — cho dữ liệu chỉ có ngày bắt đầu/kết thúc (OKR). */
  start: string | null
  end: string | null
}

export function useOrgTimeFilters(organizationId?: string) {
  const [unitPick, setUnitPick] = useState('')
  const [timeValue, setTimeValue] = useState(ALL)

  const { data: unitTree } = useOrgUnitTree({ staleTime: 5 * 60 * 1000 })
  const { flatUnits, subtreeOf } = useMemo(() => {
    const flat: { id: string; name: string; level: number }[] = []
    const subtree = new Map<string, Set<string>>()
    // Trả về tập id của nút và mọi nút con — "chọn một đơn vị" là xem cả nhánh của nó.
    const walk = (nodes: OrgUnitTreeResponse[], level: number): Set<string> => {
      const all = new Set<string>()
      nodes.forEach(n => {
        flat.push({ id: n.id, name: n.name, level })
        const mine = new Set<string>([n.id, ...walk(n.children ?? [], level + 1)])
        subtree.set(n.id, mine)
        mine.forEach(id => all.add(id))
      })
      return all
    }
    walk(unitTree ?? [], 0)
    return { flatUnits: flat, subtreeOf: subtree }
  }, [unitTree])
  const rootUnitId = flatUnits.find(u => u.level === 0)?.id ?? ''
  const unitId = unitPick || rootUnitId
  /** null = đang ở gốc ⇒ không lọc theo đơn vị. */
  const unitIds = unitId && unitId !== rootUnitId ? (subtreeOf.get(unitId) ?? null) : null

  const { data: cyclesData } = useKpiCycles({ organizationId, size: 200, sortBy: 'startDate', direction: 'desc' })
  const { data: periodsData } = useKpiPeriods({ organizationId, size: 500 })
  const timeGroups = useMemo(() => (cyclesData?.content ?? []).map(c => ({
    cycle: c,
    periods: (periodsData?.content ?? []).filter(p => p.cycleId === c.id),
  })), [cyclesData, periodsData])
  const periodCycle = useMemo(
    () => new Map((periodsData?.content ?? []).map(p => [p.id, p.cycleId ?? null])),
    [periodsData],
  )

  const time = useMemo<TimeSelection | null>(() => {
    if (timeValue === ALL) return null
    const [kind, id] = timeValue.split(':') as ['cycle' | 'period', string]
    if (kind === 'cycle') {
      const c = (cyclesData?.content ?? []).find(x => x.id === id)
      return { kind, id, start: c?.startDate ?? null, end: c?.endDate ?? null }
    }
    const p = (periodsData?.content ?? []).find(x => x.id === id)
    return { kind, id, start: p?.startDate ?? null, end: p?.endDate ?? null }
  }, [timeValue, cyclesData, periodsData])

  return {
    flatUnits, unitId, setUnitPick, unitIds,
    timeGroups, timeValue, setTimeValue, time, periodCycle,
    filtering: !!unitIds || !!time,
    reset: () => { setUnitPick(''); setTimeValue(ALL) },
  }
}

export type OrgTimeFilters = ReturnType<typeof useOrgTimeFilters>

/** Hai khoảng ngày có giao nhau không (null = mở về phía đó). */
export function rangesOverlap(aStart?: string | null, aEnd?: string | null, bStart?: string | null, bEnd?: string | null) {
  const t = (d?: string | null, fallback = 0) => (d ? new Date(d).getTime() : fallback)
  return t(aStart, -Infinity) <= t(bEnd, Infinity) && t(bStart, -Infinity) <= t(aEnd, Infinity)
}
