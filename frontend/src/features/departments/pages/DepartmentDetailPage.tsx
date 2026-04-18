import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { departmentApi } from '../api/departmentApi'
import { useDepartmentMembers } from '../hooks/useDepartmentMembers'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import MemberList from '../components/MemberList'
import DepartmentFormModal from '../components/DepartmentFormModal'
import AddMemberModal from '../components/AssignHeadModal'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { toast } from 'sonner'
import { Pencil, Trash2, UserPlus, ArrowLeft, Building2, Crown, Award, Grid } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { usePermission } from '@/hooks/usePermission'

export default function DepartmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const { isDirector, isHead, isDeputy } = usePermission()

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); toast.success('Đã giải tán phòng ban thành công'); navigate('/departments') },
    onError: () => toast.error('Lỗi khi xoá phòng ban'),
  })

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => departmentApi.removeMember(id!, userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments', id, 'members'] }); toast.success('Đã điều chuyển nhân sự khỏi phòng ban'); setRemoveMemberId(null) },
    onError: () => toast.error('Thất bại. Vui lòng thử lại sau.'),
  })

  if (isLoading) return <div className="p-8"><LoadingSkeleton type="form" rows={6} /></div>

  const isMyDepartment = members?.some((m) => m.userId === user?.id)
  const canManageMembers = isDirector || (isMyDepartment && (isHead || isDeputy))

  return (
    <div className="max-w-[1200px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      
      {/* 1. Breadcrumb / Back Navigation */}
      <div className="flex items-center text-sm font-semibold text-slate-500 pb-2">
        <Link to="/departments" className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
          <ArrowLeft size={16} /> Quay lại danh sách
        </Link>
      </div>

      {/* 2. Header Hero Section */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative">
         <div className="h-32 bg-gradient-to-r from-indigo-500/10 to-transparent w-full absolute top-0 left-0"></div>
         <div className="relative z-10 px-8 py-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex items-end gap-5">
               <div className="w-24 h-24 rounded-3xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-inner border border-indigo-100 dark:border-indigo-900/50">
                  <Grid size={40} />
               </div>
               <div className="space-y-2 max-w-2xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-widest leading-none">
                     <Building2 size={12} /> Đơn vị cấp cơ sở
                  </div>
                  <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                     {dept?.name ?? 'Đang tải...'}
                  </h1>
                  <p className="text-slate-500 font-medium leading-relaxed">
                     {dept?.description ?? 'Chưa có thông tin mô tả cụ thể về nghiệp vụ và chức năng của phòng ban này.'}
                  </p>
               </div>
            </div>

            {/* Quick Actions (Director only) */}
            {isDirector && (
               <div className="flex items-center gap-3 shrink-0">
                 <button 
                   onClick={() => setShowEdit(true)} 
                   className="flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-sm transition-all"
                 >
                   <Pencil size={18} /> Hiệu chỉnh
                 </button>
                 <button 
                   onClick={() => setConfirmDelete(true)} 
                   className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 font-bold text-sm hover:bg-red-100 dark:hover:bg-red-900/40 transition-all border border-red-200 dark:border-red-900/50 shadow-sm"
                 >
                   <Trash2 size={18} /> Giải tán
                 </button>
               </div>
            )}
         </div>
      </div>

      {/* 3. Key Personnel Banner (Head & Deputy) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {/* Head Card */}
         <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 rounded-[24px] p-6 border border-amber-200/50 dark:border-amber-900/30 flex items-start gap-4">
            <div className="w-14 h-14 rounded-[18px] bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
               <Crown size={28} />
            </div>
            <div>
               <p className="text-xs font-black uppercase text-amber-700/60 dark:text-amber-400/60 tracking-widest mb-1.5">Trưởng phòng</p>
               <h4 className="text-lg font-bold text-slate-900 dark:text-amber-100">{dept?.headName ?? <span className="text-slate-400 text-sm italic font-normal">Chưa bổ nhiệm</span>}</h4>
            </div>
         </div>

         {/* Deputy Card */}
         <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/20 rounded-[24px] p-6 border border-slate-200 dark:border-slate-800 flex items-start gap-4">
            <div className="w-14 h-14 rounded-[18px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0">
               <Award size={28} />
            </div>
            <div>
               <p className="text-xs font-black uppercase text-slate-500 tracking-widest mb-1.5">Phó phòng</p>
               <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">{dept?.deputyName ?? <span className="text-slate-400 text-sm italic font-normal">Chưa bổ nhiệm</span>}</h4>
            </div>
         </div>

         {/* Member Count Stats */}
         <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/10 rounded-[24px] p-6 border border-indigo-200/50 dark:border-indigo-900/30 flex items-center justify-between gap-4 h-full">
            <div>
               <p className="text-xs font-black uppercase text-indigo-700/60 dark:text-indigo-400/60 tracking-widest mb-2">Quy mô nhân sự</p>
               <div className="flex items-baseline gap-2">
                  <h4 className="text-4xl font-black text-indigo-700 dark:text-indigo-300">{dept?.memberCount ?? 0}</h4>
                  <span className="font-semibold text-indigo-700/60 dark:text-indigo-400/60">thành viên</span>
               </div>
            </div>
         </div>
      </div>

      {/* 4. Details / Members Table Layout */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm p-8">
         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="space-y-1">
               <h3 className="text-xl font-bold text-slate-900 dark:text-white border-l-4 border-indigo-500 pl-3">
                  Danh sách Cán bộ - Nhân viên
               </h3>
               <p className="text-sm font-medium text-slate-500 pl-4">Đội ngũ hiện tại trực thuộc phân quyền giám sát của đơn vị.</p>
            </div>
            
            {canManageMembers && (
               <button 
                 onClick={() => setShowAddMember(true)} 
                 className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/20 active:scale-95 shrink-0"
               >
                 <UserPlus size={18} /> Thêm vào phòng
               </button>
            )}
         </div>

         {membersLoading ? (
            <LoadingSkeleton type="table" rows={4} />
         ) : (
            <div className="overflow-hidden">
               <MemberList members={members ?? []} onRemove={(userId) => setRemoveMemberId(userId)} canRemove={canManageMembers} />
            </div>
         )}
      </div>

      {/* 5. Modals & Dialogs */}
      <DepartmentFormModal open={showEdit} onClose={() => setShowEdit(false)} editDept={dept} />
      {id && <AddMemberModal open={showAddMember} onClose={() => setShowAddMember(false)} departmentId={id} currentMemberIds={members?.map(m => m.userId) ?? []} />}

      <ConfirmDialog 
        open={confirmDelete} 
        onClose={() => setConfirmDelete(false)} 
        onConfirm={() => deleteDeptMutation.mutate()} 
        title="Đình chỉ / Giải tán phòng ban" 
        description={`Bạn có chắc chắn muốn giải tán "${dept?.name}"? Các thành viên thuộc phòng ban này sẽ trở thành nhân sự tự do và quy trình công việc có thể bị gián đoạn.`} 
        confirmLabel="Đồng ý Giải tán" 
        loading={deleteDeptMutation.isPending} 
      />
      <ConfirmDialog 
        open={!!removeMemberId} 
        onClose={() => setRemoveMemberId(null)} 
        onConfirm={() => removeMemberId && removeMemberMutation.mutate(removeMemberId)} 
        title="Điều chuyển Cán bộ" 
        description="Việc đưa cán bộ này ra khỏi danh sách đơn vị sẽ lập tức tước đi các quyền lợi xem/giao việc nội bộ của họ tại đây." 
        confirmLabel="Xác nhận Rời đi" 
        loading={removeMemberMutation.isPending} 
      />
    </div>
  )
}
