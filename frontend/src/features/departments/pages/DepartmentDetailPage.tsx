import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { departmentApi } from '../api/departmentApi'
import { useDepartmentMembers } from '../hooks/useDepartmentMembers'
import PageHeader from '@/components/common/PageHeader'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import MemberList from '../components/MemberList'
import DepartmentFormModal from '../components/DepartmentFormModal'
import AddMemberModal from '../components/AssignHeadModal'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { toast } from 'sonner'
import { Pencil, Trash2, UserPlus } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

export default function DepartmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isDirector = user?.role === 'DIRECTOR'

  const [showEdit, setShowEdit] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null)

  const { data: dept, isLoading } = useQuery({
    queryKey: ['departments', id],
    queryFn: () => departmentApi.getById(id!),
    enabled: !!id,
  })

  const { data: members, isLoading: membersLoading } = useDepartmentMembers(id!)

  const deleteDeptMutation = useMutation({
    mutationFn: () => departmentApi.delete(id!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); toast.success('Đã xoá phòng ban'); navigate('/departments') },
    onError: () => toast.error('Xoá phòng ban thất bại'),
  })

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => departmentApi.removeMember(id!, userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments', id, 'members'] }); toast.success('Đã xoá thành viên'); setRemoveMemberId(null) },
    onError: () => toast.error('Xoá thành viên thất bại'),
  })

  if (isLoading) return <LoadingSkeleton type="form" rows={4} />

  const isMyDepartment = members?.some((m) => m.userId === user?.id)
  const canManageMembers = isDirector || (isMyDepartment && (user?.role === 'HEAD' || user?.role === 'DEPUTY_HEAD'))

  return (
    <div>
      <PageHeader
        title={dept?.name ?? 'Phòng ban'}
        description={dept?.description ?? undefined}
        action={isDirector ? (
          <div className="flex gap-2">
            <button onClick={() => setShowEdit(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-accent)] transition">
              <Pencil size={14} /> Sửa
            </button>
            <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-500 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition">
              <Trash2 size={14} /> Xoá
            </button>
          </div>
        ) : undefined}
      />

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-4">
          <p className="text-xs text-[var(--color-muted-foreground)] mb-1">Trưởng phòng</p>
          <p className="text-sm font-medium">{dept?.headName ?? '—'}</p>
        </div>
        <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-4">
          <p className="text-xs text-[var(--color-muted-foreground)] mb-1">Phó phòng</p>
          <p className="text-sm font-medium">{dept?.deputyName ?? '—'}</p>
        </div>
        <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-4">
          <p className="text-xs text-[var(--color-muted-foreground)] mb-1">Số thành viên</p>
          <p className="text-sm font-medium">{dept?.memberCount ?? 0}</p>
        </div>
      </div>

      {/* Members */}
      <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Thành viên ({members?.length ?? 0})</h3>
          {canManageMembers && (
            <button onClick={() => setShowAddMember(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-xs font-medium hover:opacity-90 transition">
              <UserPlus size={14} /> Thêm
            </button>
          )}
        </div>
        {membersLoading ? (
          <LoadingSkeleton type="table" rows={3} />
        ) : (
          <MemberList members={members ?? []} onRemove={(userId) => setRemoveMemberId(userId)} canRemove={canManageMembers} />
        )}
      </div>

      {/* Modals */}
      <DepartmentFormModal open={showEdit} onClose={() => setShowEdit(false)} editDept={dept} />
      {id && <AddMemberModal open={showAddMember} onClose={() => setShowAddMember(false)} departmentId={id} currentMemberIds={members?.map(m => m.userId) ?? []} />}

      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={() => deleteDeptMutation.mutate()} title="Xoá phòng ban" description={`Bạn có chắc muốn xoá phòng ban "${dept?.name}"?`} confirmLabel="Xoá" loading={deleteDeptMutation.isPending} />
      <ConfirmDialog open={!!removeMemberId} onClose={() => setRemoveMemberId(null)} onConfirm={() => removeMemberId && removeMemberMutation.mutate(removeMemberId)} title="Xoá thành viên" description="Bạn có chắc muốn xoá thành viên này khỏi phòng ban?" confirmLabel="Xoá" loading={removeMemberMutation.isPending} />
    </div>
  )
}
