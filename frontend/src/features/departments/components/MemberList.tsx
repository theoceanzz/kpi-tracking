import type { DepartmentMember } from '@/types/department'
import { getInitials } from '@/lib/utils'
import { Trash2 } from 'lucide-react'

const positionMap: Record<string, string> = {
  HEAD: 'Trưởng phòng',
  DEPUTY: 'Phó phòng',
  MEMBER: 'Thành viên',
}

interface MemberListProps {
  members: DepartmentMember[]
  onRemove?: (userId: string) => void
  canRemove?: boolean
}

export default function MemberList({ members, onRemove, canRemove }: MemberListProps) {
  if (members.length === 0) {
    return <p className="text-sm text-[var(--color-muted-foreground)] text-center py-4">Chưa có thành viên nào</p>
  }

  return (
    <div className="space-y-2">
      {members.map((m) => (
        <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-muted)]/50 hover:bg-[var(--color-accent)] transition">
          <div className="w-9 h-9 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center text-xs font-bold text-[var(--color-primary)]">
            {getInitials(m.userFullName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{m.userFullName}</p>
            <p className="text-xs text-[var(--color-muted-foreground)] truncate">{m.userEmail}</p>
          </div>
          <span className="text-xs bg-[var(--color-accent)] px-2 py-1 rounded font-medium">{positionMap[m.position] ?? m.position}</span>
          {canRemove && onRemove && (
            <button onClick={() => onRemove(m.userId)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--color-muted-foreground)] hover:text-red-500 transition">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
