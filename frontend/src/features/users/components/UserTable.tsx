import DataTable from '@/components/common/DataTable'
import StatusBadge from '@/components/common/StatusBadge'
import type { User } from '@/types/user'
import { Pencil, Trash2 } from 'lucide-react'

interface UserTableProps {
  users: User[]
  onRowClick?: (user: User) => void
  onDelete?: (user: User) => void
}

const roleMap: Record<string, string> = {
  DIRECTOR: 'Giám đốc',
  HEAD: 'Trưởng phòng',
  DEPUTY_HEAD: 'Phó phòng',
  STAFF: 'Nhân viên',
}

export default function UserTable({ users, onRowClick, onDelete }: UserTableProps) {
  const columns = [
    { key: 'fullName', header: 'Họ tên', render: (u: User) => <span className="font-medium">{u.fullName}</span> },
    { key: 'email', header: 'Email', render: (u: User) => u.email },
    { key: 'role', header: 'Vai trò', render: (u: User) => roleMap[u.role] ?? u.role },
    { key: 'phone', header: 'SĐT', render: (u: User) => u.phone ?? '—' },
    { key: 'status', header: 'Trạng thái', render: (u: User) => <StatusBadge status={u.status} /> },
    {
      key: 'actions',
      header: '',
      render: (u: User) => (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onRowClick?.(u)} className="p-1.5 rounded-md hover:bg-[var(--color-accent)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete?.(u)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--color-muted-foreground)] hover:text-red-500 transition">
            <Trash2 size={14} />
          </button>
        </div>
      ),
      className: 'w-20',
    },
  ]

  return <DataTable columns={columns} data={users} keyExtractor={(u) => u.id} onRowClick={onRowClick} />
}
