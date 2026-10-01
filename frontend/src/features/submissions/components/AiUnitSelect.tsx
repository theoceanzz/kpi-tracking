import { useMemo } from 'react'
import { CheckCircle2, Lock } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { cn } from '@/lib/utils'
import type { OrgUnitTreeResponse } from '@/types/orgUnit'
import { ALL_UNITS, type UnitMark } from './aiUnitScope'

interface FlatUnit {
  id: string
  name: string
  depth: number
}

function flatten(nodes: OrgUnitTreeResponse[] | undefined, depth = 0, out: FlatUnit[] = []): FlatUnit[] {
  for (const n of nodes ?? []) {
    out.push({ id: n.id, name: n.name, depth })
    flatten(n.children, depth + 1, out)
  }
  return out
}

/** Cây đơn vị trải phẳng theo thứ tự cây, kèm độ sâu để thụt lề trong danh sách chọn. */
function useFlatUnits() {
  const { data } = useOrgUnitTree({ staleTime: 5 * 60_000 })
  return useMemo(() => flatten(data), [data])
}

/**
 * Chọn một đơn vị trong cây. `allLabel` có thì thêm lựa chọn "cả tổ chức" (giá trị {@link ALL_UNITS},
 * trả về `null`). `onlyUnitIds` giới hạn theo phạm vi người dùng. `marks` (khoá {@link ALL_UNITS} cho cả tổ
 * chức): ✓ đơn vị đang áp tài liệu mình quản, 🔒 đơn vị đang áp tài liệu cấp trên — không chọn được trừ khi
 * `selectable`.
 */
export default function AiUnitSelect({
  value, onChange, allLabel, exclude, onlyUnitIds, marks, placeholder = 'Chọn đơn vị', className, disabled,
}: {
  /** `undefined` = chưa chọn (hiện placeholder); `null` = cả tổ chức (khi có `allLabel`). */
  value: string | null | undefined
  onChange: (unitId: string | null, label: string) => void
  allLabel?: string
  exclude?: Set<string>
  onlyUnitIds?: Set<string>
  marks?: Map<string, UnitMark>
  placeholder?: string
  className?: string
  disabled?: boolean
}) {
  const units = useFlatUnits()
  const shown = units.filter(u => !exclude?.has(u.id) && (!onlyUnitIds || onlyUnitIds.has(u.id)))
  // Thụt lề theo độ sâu TƯƠNG ĐỐI với đơn vị nông nhất còn hiện (trưởng phòng không thấy khoảng trống của cấp trên).
  const minDepth = shown.length ? Math.min(...shown.map(u => u.depth)) : 0
  const selected = value === undefined ? '' : value ?? (allLabel ? ALL_UNITS : '')
  const change = (v: string) => onChange(v === ALL_UNITS ? null : v,
    v === ALL_UNITS ? (allLabel ?? '') : units.find(u => u.id === v)?.name ?? '')
  const markProps = (key: string) => {
    const m = marks?.get(key)
    if (!m) return {}
    const locked = m.kind === 'locked'
    return {
      disabled: !m.selectable,
      title: m.title,
      className: 'data-[disabled]:opacity-100 text-[var(--color-muted-foreground)]',
      extra: (
        <span className={cn('ml-auto flex items-center gap-1 pl-3 text-xs',
          locked ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]')}>
          {locked ? <Lock size={12} aria-hidden="true" /> : <CheckCircle2 size={13} aria-hidden="true" />}
          {locked ? 'Cấp trên áp' : 'Đã có tài liệu'}
        </span>
      ),
    }
  }
  return (
    // value "" = chưa chọn: Radix hiện placeholder (vì thế SelectItem không bao giờ có value "").
    <Select value={selected} onValueChange={change} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value={ALL_UNITS} {...markProps(ALL_UNITS)}>{allLabel}</SelectItem>}
        {shown.map(u => (
          <SelectItem key={u.id} value={u.id} {...markProps(u.id)}>
            <span style={{ paddingLeft: (u.depth - minDepth) * 12 }}>{u.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
