import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '../hooks/useOrganization'
import { useUpdateOrganization } from '../hooks/useUpdateOrganization'
import { useForm, useFieldArray } from 'react-hook-form'
import {  Edit3, Check, X, ShieldCheck, 
  Calendar, Hash, Layers, Trash2, ChevronUp, 
  ChevronDown, Info
} from 'lucide-react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'


export default function CompanyPage() {
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  
  const { data: org, isLoading: loadingOrg } = useOrganization(orgId)
  const updateMutation = useUpdateOrganization(orgId)

  const [isEditingInfo, setIsEditingInfo] = useState(false)
  const [infoFormData, setInfoFormData] = useState({ name: '', code: '' })

  const [isEditingHierarchy, setIsEditingHierarchy] = useState(false)

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      hierarchyLevels: [] as { unitTypeName: string; managerRoleLabel: string }[]
    }
  })

  const { fields, append, prepend, remove } = useFieldArray({
    control,
    name: "hierarchyLevels"
  })

  useEffect(() => {
    if (org?.hierarchyLevels) {
      reset({
        hierarchyLevels: org.hierarchyLevels.map(l => ({
          unitTypeName: l.unitTypeName,
          managerRoleLabel: l.managerRoleLabel || ''
        }))
      })
    }
  }, [org, reset])

  const handleStartEditInfo = () => {
    if (org) {
      setInfoFormData({ name: org.name, code: org.code })
      setIsEditingInfo(true)
    }
  }

  const handleSaveInfo = () => {
    updateMutation.mutate({ name: infoFormData.name, code: infoFormData.code }, {
      onSuccess: () => {
        setIsEditingInfo(false)
        toast.success('Cập nhật thông tin công ty thành công')
      }
    })
  }


  const onSaveHierarchy = (data: any) => {
    if (data.hierarchyLevels.length < 3) {
      toast.error('Cơ cấu tổ chức phải có ít nhất 3 cấp.')
      return
    }
    updateMutation.mutate({ hierarchyLevels: data.hierarchyLevels }, {
      onSuccess: () => {
        setIsEditingHierarchy(false)
        toast.success('Cập nhật cơ cấu tổ chức thành công')
      },
      onError: (error: any) => {
        const msg = error?.response?.data?.message || 'Có lỗi xảy ra'
        toast.error(msg)
      }
    })
  }

  const isLoading = loadingOrg

  if (isLoading) return <div className="p-8 max-w-6xl mx-auto"><LoadingSkeleton rows={10} /></div>

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Hero Section - Organization Info */}
      <section className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
        
        <div className="p-8 md:p-10 relative z-10">
          <div className="flex flex-col md:flex-row gap-8 items-start justify-between">
            <div className="flex gap-6 items-center">
              <div className="w-20 h-20 rounded-[24px] bg-indigo-600 flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-indigo-600/20 shrink-0">
                {org?.name?.charAt(0)}
              </div>
              
              <div className="space-y-2">
                {isEditingInfo ? (
                  <div className="space-y-3">
                    <input 
                      value={infoFormData.name}
                      onChange={e => setInfoFormData({ ...infoFormData, name: e.target.value })}
                      className="text-2xl font-black bg-slate-50 dark:bg-slate-800 border-b-2 border-indigo-600 focus:outline-none w-full max-w-md px-2 py-1"
                      placeholder="Tên công ty"
                    />
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Hash size={14} />
                      <input 
                        value={infoFormData.code}
                        onChange={e => setInfoFormData({ ...infoFormData, code: e.target.value })}
                        className="bg-slate-50 dark:bg-slate-800 border-b border-slate-300 focus:outline-none px-2"
                        placeholder="Mã công ty"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                      {org?.name}
                    </h1>
                    <div className="flex flex-wrap gap-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                      <div className="flex items-center gap-1.5"><Hash size={14} className="text-indigo-500" /> {org?.code}</div>
                      <div className="flex items-center gap-1.5"><Calendar size={14} /> Khởi tạo: {org?.createdAt ? formatDateTime(org.createdAt).split(' ')[0] : 'N/A'}</div>
                      <div className="flex items-center gap-1.5 text-emerald-500"><ShieldCheck size={14} /> {org?.status}</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {isEditingInfo ? (
                <>
                  <button 
                    onClick={() => setIsEditingInfo(false)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-bold hover:bg-slate-50 transition-all"
                  >
                    <X size={16} /> Hủy
                  </button>
                  <button 
                    onClick={handleSaveInfo}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all disabled:opacity-50"
                  >
                    {updateMutation.isPending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={16} />} 
                    Lưu thay đổi
                  </button>
                </>
              ) : (
                <button 
                  onClick={handleStartEditInfo}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl text-sm font-bold shadow-xl transition-all hover:opacity-90 active:scale-95"
                >
                  <Edit3 size={16} /> Chỉnh sửa thông tin
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8">

        {/* Hierarchy Levels Setup (The requested change) */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
             <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                   <Layers size={24} className="text-indigo-600" /> 
                   Cấu trúc Cấp bậc
                </h2>
                <p className="text-sm text-slate-500 font-medium">Thiết lập danh xưng các cấp quản lý</p>
             </div>
             {!isEditingHierarchy && (
               <button 
                onClick={() => setIsEditingHierarchy(true)}
                className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                title="Chỉnh sửa cấu trúc"
               >
                  <Edit3 size={20} />
               </button>
             )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm p-6 relative">
            {isEditingHierarchy ? (
              <form onSubmit={handleSubmit(onSaveHierarchy)} className="space-y-6">
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-xl text-amber-700 dark:text-amber-400 text-xs">
                  <Info size={16} className="shrink-0" />
                  <p>Lưu ý: Bạn không thể xóa các cấp bậc đang có đơn vị hoạt động. Việc đổi tên sẽ áp dụng ngay lập tức cho toàn hệ thống.</p>
                </div>

                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div 
                      key={field.id} 
                      className="group relative p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center gap-1 mt-1">
                          <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shadow-lg shadow-indigo-600/20">
                            {index + 1}
                          </div>
                          {index < fields.length - 1 && <div className="w-0.5 h-16 bg-gradient-to-b from-indigo-600/30 to-transparent" />}
                        </div>

                        <div className="flex-1 grid grid-cols-1 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tên cấp bậc</label>
                            <input 
                              {...register(`hierarchyLevels.${index}.unitTypeName` as const, { required: true })} 
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                              placeholder="VD: Chi nhánh, Phòng ban..."
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                              {index === fields.length - 1 ? "Ghi chú vai trò (Tùy chọn)" : "Chức danh quản lý"}
                            </label>
                            <input 
                              {...register(`hierarchyLevels.${index}.managerRoleLabel` as const)} 
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                              placeholder={index === fields.length - 1 ? "Nhân viên thực thi" : "VD: Giám đốc, Trưởng phòng..."}
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1 mt-6">
                           {fields.length > 3 && (
                             <button
                               type="button"
                               onClick={() => remove(index)}
                               className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                               title="Xóa cấp này"
                             >
                               <Trash2 size={16} />
                             </button>
                           )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => prepend({ unitTypeName: '', managerRoleLabel: '' })}
                    className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-500 hover:text-indigo-600 rounded-2xl text-xs font-bold transition-all group"
                  >
                    <ChevronUp size={16} className="group-hover:-translate-y-0.5 transition-transform" />
                    Thêm cấp CHA
                  </button>
                  <button
                    type="button"
                    onClick={() => append({ unitTypeName: '', managerRoleLabel: '' })}
                    className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-500 hover:text-indigo-600 rounded-2xl text-xs font-bold transition-all group"
                  >
                    <ChevronDown size={16} className="group-hover:translate-y-0.5 transition-transform" />
                    Thêm cấp CON
                  </button>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsEditingHierarchy(false)
                      reset()
                    }}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all disabled:opacity-50"
                  >
                    {updateMutation.isPending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={18} />} 
                    Lưu Cấu trúc
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="space-y-0 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800">
                  {org?.hierarchyLevels?.map((level, idx) => (
                    <div key={level.id} className="relative pl-8 pb-6 last:pb-0 group">
                      <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 flex items-center justify-center group-hover:border-indigo-500 transition-colors z-10">
                        <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700 group-hover:bg-indigo-500 transition-colors" />
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Cấp {idx + 1}</h4>
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-base font-bold text-slate-900 dark:text-white leading-tight">{level.unitTypeName}</p>
                            <p className="text-sm text-slate-500 font-medium">
                              {level.managerRoleLabel || (idx === (org.hierarchyLevels?.length || 0) - 1 ? 'Nhân viên thực thi' : 'Chưa thiết lập')}
                            </p>
                          </div>
                          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600">
                            <Layers size={14} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => setIsEditingHierarchy(true)}
                  className="w-full py-3.5 flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-600 hover:text-indigo-600 rounded-2xl text-sm font-bold transition-all border border-slate-100 dark:border-slate-800"
                >
                  <Edit3 size={16} /> Chỉnh sửa Cấu trúc Cấp bậc
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
