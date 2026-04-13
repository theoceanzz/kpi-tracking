import type { Department } from '@/types/department'
import { Building2, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

interface DepartmentCardProps {
  department: Department
}

export default function DepartmentCard({ department }: DepartmentCardProps) {
  return (
    <Link
      to={`/departments/${department.id}`}
      className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-5 hover:shadow-md hover:border-[var(--color-primary)]/30 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] group-hover:bg-[var(--color-primary)] group-hover:text-white transition">
          <Building2 size={20} />
        </div>
      </div>
      <h3 className="font-semibold mb-1">{department.name}</h3>
      <p className="text-sm text-[var(--color-muted-foreground)] mb-3 line-clamp-2">{department.description || 'Chưa có mô tả'}</p>
      <div className="flex items-center gap-4 text-xs text-[var(--color-muted-foreground)]">
        <span className="flex items-center gap-1"><Users size={14} /> {department.memberCount} thành viên</span>
        {department.headName && <span>Trưởng phòng: {department.headName}</span>}
      </div>
    </Link>
  )
}
