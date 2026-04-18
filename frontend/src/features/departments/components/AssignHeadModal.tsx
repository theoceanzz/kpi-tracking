import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { departmentApi } from '../api/departmentApi'
import { useUsers } from '@/features/users/hooks/useUsers'
import { toast } from 'sonner'
import { X, Loader2 } from 'lucide-react'
import type { DeptMemberPosition } from '@/types/department'

interface AddMemberModalProps {
  open: boolean
  onClose: () => void
  departmentId: string
  currentMemberIds?: string[]
}

const positionOptions: { value: DeptMemberPosition; label: string }[] = [
  { value: 'HEAD', label: 'Trưởng phòng' },
  { value: 'DEPUTY', label: 'Phó phòng' },
  { value: 'STAFF', label: 'Thành viên' },
]

export default function AddMemberModal({ open, onClose, departmentId, currentMemberIds = [] }: AddMemberModalProps) {
  const [userId, setUserId] = useState('')
  const [position, setPosition] = useState<DeptMemberPosition>('STAFF')
  const qc = useQueryClient()
  const { data: usersData } = useUsers({ page: 0, size: 100 })

  const addMutation = useMutation({
    mutationFn: () => departmentApi.addMember(departmentId, { userId, position }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments'] })
      qc.invalidateQueries({ queryKey: ['departments', departmentId] })
      qc.invalidateQueries({ queryKey: ['departments', departmentId, 'members'] })
      toast.success('Thêm thành viên thành công')
      setUserId('')
      setPosition('STAFF')
      onClose()
    },
    onError: () => toast.error('Thêm thành viên thất bại'),
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--color-card)] rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">Thêm thành viên</h3>
          <button onClick={onClose} className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Nhân viên <span className="text-red-500">*</span></label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50">
              <option value="">-- Chọn nhân viên --</option>
              {usersData?.content?.filter(u => !u.roles?.includes('DIRECTOR') && !currentMemberIds.includes(u.id)).map((u) => (
                <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Vị trí <span className="text-red-500">*</span></label>
            <select value={position} onChange={(e) => setPosition(e.target.value as DeptMemberPosition)} className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50">
              {positionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[var(--color-accent)] transition-colors">Hủy</button>
            <button onClick={() => addMutation.mutate()} disabled={!userId || addMutation.isPending} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {addMutation.isPending && <Loader2 size={16} className="animate-spin" />}
              Thêm
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
