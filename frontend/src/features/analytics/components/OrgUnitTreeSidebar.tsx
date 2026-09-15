import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, ChevronDown, Search, Building2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrgUnitTreeResponse } from '@/types/orgUnit'
import { Button } from '@/components/ui/button'

interface Props {
  nodes: OrgUnitTreeResponse[]
  selectedId?: string
  onSelect: (id: string) => void
  /** Gọi khi chọn xong (đóng drawer mobile). */
  onAfterSelect?: () => void
}

/** Đường (danh sách id) từ gốc tới node id — để tự mở nhánh khi chọn. */
function findPath(nodes: OrgUnitTreeResponse[], id: string, acc: string[] = []): string[] | null {
  for (const n of nodes) {
    const next = [...acc, n.id]
    if (n.id === id) return next
    if (n.children?.length) {
      const r = findPath(n.children, id, next)
      if (r) return r
    }
  }
  return null
}

/** Lọc cây theo từ khoá: giữ node nếu tên khớp HOẶC có hậu duệ khớp. */
function filterTree(nodes: OrgUnitTreeResponse[], low: string): OrgUnitTreeResponse[] {
  const walk = (list: OrgUnitTreeResponse[]): OrgUnitTreeResponse[] =>
    list.reduce<OrgUnitTreeResponse[]>((out, n) => {
      const kids = walk(n.children || [])
      if (n.name.toLowerCase().includes(low) || kids.length) out.push({ ...n, children: kids })
      return out
    }, [])
  return walk(nodes)
}

/** Cây đơn vị dùng để điều hướng tab Phân cấp (master–detail). */
export default function OrgUnitTreeSidebar({ nodes, selectedId, onSelect, onAfterSelect }: Props) {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Tự mở nhánh dẫn tới đơn vị đang chọn.
  useEffect(() => {
    if (!selectedId) return
    const path = findPath(nodes, selectedId)
    if (path) setExpanded(prev => new Set([...prev, ...path]))
  }, [selectedId, nodes])

  const searching = query.trim().length > 0
  const shown = useMemo(
    () => (searching ? filterTree(nodes, query.trim().toLowerCase()) : nodes),
    [nodes, query, searching]
  )

  // Tổng số nhân sự của mỗi đơn vị GỒM cả đơn vị con (roll-up) — hiển thị ở cây.
  const rollup = useMemo(() => {
    const map = new Map<string, number>()
    const walk = (n: OrgUnitTreeResponse): number => {
      let sum = n.memberCount ?? 0
      for (const c of n.children || []) sum += walk(c)
      map.set(n.id, sum)
      return sum
    }
    nodes.forEach(walk)
    return map
  }, [nodes])

  const toggle = (id: string) =>
    setExpanded(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })

  const pick = (id: string) => { onSelect(id); onAfterSelect?.() }

  const renderNode = (n: OrgUnitTreeResponse, depth: number): React.ReactNode => {
    const hasKids = (n.children?.length ?? 0) > 0
    const open = searching || expanded.has(n.id)
    const isSel = n.id === selectedId
    return (
      <div key={n.id}>
        <div
          className={cn('flex items-center rounded-control pr-1.5 transition-colors',
            isSel ? 'bg-[var(--color-primary-soft)]' : 'hover:bg-[var(--color-muted)]')}
          style={{ paddingLeft: depth * 14 }}
        >
          <Button variant="ghost" className="shrink-0" onClick={() => { if (hasKids) toggle(n.id) }} aria-label={hasKids ? 'Mở/thu nhánh' : undefined}>
            {hasKids ? (open ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />) : <span className="inline-block w-[14px]" />}
          </Button>
          <button type="button" className="flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[var(--color-muted-foreground)] flex-1 min-w-0" onClick={() => pick(n.id)}>
            <span className={cn('truncate text-[13px] font-medium',
              isSel ? 'text-[var(--color-primary)]' : 'text-[var(--color-foreground)]')}>{n.name}</span>
            {n.memberCount != null && (
              <span
                className="ml-auto shrink-0 text-caption flex items-center gap-0.5"
                title="Tổng số nhân sự (gồm cả đơn vị con)"
              >
                <Users aria-hidden="true" />{rollup.get(n.id) ?? n.memberCount}
              </span>
            )}
          </button>
        </div>
        {hasKids && open && <div>{n.children.map(c => renderNode(c, depth + 1))}</div>}
      </div>
    )
  }

  return (
    <div className="bg-[var(--color-card)] rounded-card border border-[var(--color-border)] shadow-sm flex flex-col overflow-hidden h-full">
      <div className="p-3 border-b border-[var(--color-border)] shrink-0">
        <h3 className="text-eyebrow flex items-center gap-1.5 mb-2">
          <Building2 size={12} /> Sơ đồ đơn vị
        </h3>
        <div className="relative">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Tìm đơn vị..."
            className="w-full pl-8 pr-3 py-1.5 bg-[var(--color-muted)] rounded-control text-xs font-semibold focus:ring-2 focus:ring-[var(--color-ring)] border-none outline-none"
          />
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-subtle-foreground)]" />
        </div>
      </div>
      <div className="p-1.5 overflow-auto custom-scrollbar flex-1 min-h-0">
        {shown.length ? shown.map(n => renderNode(n, 0)) : (
          <p className="text-center text-xs text-[var(--color-subtle-foreground)] py-6">Không tìm thấy đơn vị</p>
        )}
      </div>
    </div>
  )
}
