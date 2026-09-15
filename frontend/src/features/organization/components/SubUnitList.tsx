import { ChevronRight, Building2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { OrgUnitTreeResponse } from '../types/org-unit'

interface SubUnitListProps {
  units: OrgUnitTreeResponse[]
}

/** Danh sách đơn vị con trực thuộc — mỗi dòng bấm được để đi xuống một cấp. */
export function SubUnitList({ units }: SubUnitListProps) {
  const navigate = useNavigate()

  if (units.length === 0) return null

  return (
    <section className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-section-title">Đơn vị trực thuộc</h2>
        <span className="text-caption tabular-nums">{units.length} đơn vị</span>
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {units.map(child => (
          <li key={child.id}>
            <button
              type="button"
              onClick={() => navigate(`/org-units/${child.id}`)}
              className="flex w-full items-center gap-3 rounded-card border border-[var(--color-border)] px-3 py-2.5 text-left transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-[var(--color-muted)] text-[var(--color-muted-foreground)]" aria-hidden="true">
                <Building2 size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[var(--color-foreground)]">{child.name}</span>
                <span className="block text-caption">{child.type}</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-[var(--color-subtle-foreground)]" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
