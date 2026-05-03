import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '../hooks/useOrganization'
import { useUpdateOrganization } from '../hooks/useUpdateOrganization'
import { useForm, useFieldArray } from 'react-hook-form'
import {  Edit3, ShieldCheck, 
  Calendar, Hash, Layers, Trash2,
  Info, ArrowUp, ArrowDown, Plus, Target, Sparkles, CheckCircle, TrendingUp, BarChart3, AlertCircle, ChevronUp, BellRing, Clock, ArrowLeft, ArrowRight
} from 'lucide-react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { formatDateTime, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"


export default function CompanyPage() {
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  
  const { data: org, isLoading: loadingOrg } = useOrganization(orgId)
  const updateMutation = useUpdateOrganization(orgId)

  const [isEditingInfo, setIsEditingInfo] = useState(false)
  const [infoFormData, setInfoFormData] = useState({ name: '', code: '' })
  const [isEditingHierarchy, setIsEditingHierarchy] = useState(false)

  const { register, control, handleSubmit, reset } = useForm({
    defaultValues: {
      hierarchyLevels: [] as { unitTypeName: string; managerRoleLabel: string }[]
    }
  })

  const { fields, append, remove, move } = useFieldArray({
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
        toast.success('Cập nhật thông tin doanh nghiệp thành công')
      },
      onError: () => toast.error('Không thể cập nhật thông tin')
    })
  }

  const onSaveHierarchy = (data: any) => {
    if (data.hierarchyLevels.length < 2) {
      toast.error('Cơ cấu tổ chức phải có ít nhất 2 cấp.')
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

  if (loadingOrg) return <div className="p-8 max-w-7xl mx-auto"><LoadingSkeleton rows={10} /></div>

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 px-4 md:px-0">
      
      {/* Refined Hero Section with Vibrant Gradient */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 border border-white/10 shadow-2xl shadow-indigo-500/20">
        {/* Subtle Ambient Background */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-[80px] -ml-20 -mb-20" />
        
        <div className="relative z-10 p-8 md:p-10">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8 text-center md:text-left">
              <div className="relative group shrink-0">
                <div className="absolute -inset-1 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
                <div className="relative w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white text-3xl font-black shadow-xl border border-white/20">
                  {org?.name?.charAt(0)}
                </div>
              </div>
              
              <div className="space-y-3">
                {isEditingInfo ? (
                  <div className="space-y-4 max-w-md">
                    <input 
                      value={infoFormData.name}
                      onChange={e => setInfoFormData({ ...infoFormData, name: e.target.value })}
                      className="text-3xl font-bold bg-white/5 border-b border-indigo-500/50 text-white focus:outline-none w-full py-1 px-3 rounded-t-lg"
                      placeholder="Tên doanh nghiệp"
                    />
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/10">
                        <Hash size={14} className="text-slate-400" />
                        <input 
                          value={infoFormData.code}
                          onChange={e => setInfoFormData({ ...infoFormData, code: e.target.value })}
                          className="bg-transparent text-xs font-medium focus:outline-none w-24 text-slate-300"
                          placeholder="Mã DN"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 text-[10px] font-bold uppercase tracking-wider border border-white/10 mb-1">
                        Hệ thống
                      </div>
                      <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
                        {org?.name}
                      </h1>
                    </div>
                    <div className="flex flex-wrap justify-center md:justify-start gap-5">
                      <HeroStat icon={Hash} label="Mã DN" value={org?.code || 'N/A'} valueColor="text-white" />
                      <HeroStat icon={Calendar} label="Thành lập" value={(org?.createdAt ? formatDateTime(org.createdAt).split(' ')[0] : 'N/A') || 'N/A'} valueColor="text-white" />
                      <HeroStat icon={ShieldCheck} label="Trạng thái" value={org?.status === 'Active' ? 'Hoạt động' : (org?.status || 'Hoạt động')} valueColor="text-emerald-400" />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3 self-center lg:self-auto">
              {isEditingInfo ? (
                <>
                  <button 
                    onClick={() => setIsEditingInfo(false)}
                    className="px-5 py-2.5 rounded-xl bg-white/5 text-white text-xs font-bold uppercase tracking-wider hover:bg-white/10 border border-white/10 transition-all"
                  >
                    Hủy
                  </button>
                  <button 
                    onClick={handleSaveInfo}
                    disabled={updateMutation.isPending}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                  >
                    Lưu
                  </button>
                </>
              ) : (
                <button 
                  onClick={handleStartEditInfo}
                  className="px-6 py-3 bg-white text-slate-900 rounded-xl text-xs font-bold uppercase tracking-wider shadow-xl transition-all hover:bg-slate-100 active:scale-95 flex items-center gap-2"
                >
                  <Edit3 size={14} /> 
                  <span>Chỉnh sửa</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        {org && <ScoringConfigSection org={org} />}

        {/* Professional Hierarchy Section */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full animate-in slide-in-from-right-4 duration-700 delay-150">
           <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Layers size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Cấu trúc Cấp bậc</h3>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Sơ đồ phân cấp quản lý</p>
                </div>
              </div>
              {!isEditingHierarchy && (
                <button 
                  onClick={() => setIsEditingHierarchy(true)}
                  className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center group"
                >
                  <Edit3 size={16} />
                </button>
              )}
           </div>

           <div className="p-8 flex-1 relative">
             {isEditingHierarchy ? (
               <form onSubmit={handleSubmit(onSaveHierarchy)} className="space-y-6">
                  <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 rounded-2xl text-amber-700 dark:text-amber-400 text-[11px] font-medium leading-relaxed">
                    <Info size={16} className="shrink-0 mt-0.5" />
                    Việc thay đổi cấu trúc ảnh hưởng đến danh mục đơn vị hiện có.
                  </div>

                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <div key={field.id} className="relative animate-in slide-in-from-right-2 duration-300">
                        <div className="flex gap-3">
                          <div className="flex flex-col items-center shrink-0">
                            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-lg shadow-indigo-600/20 shrink-0">
                              {index + 1}
                            </div>
                            {index < fields.length - 1 && <div className="w-0.5 h-full bg-slate-100 dark:bg-slate-800 my-1" />}
                          </div>
                          
                          <div className="flex-1 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all group-hover:border-indigo-300 dark:group-hover:border-indigo-800">
                             <div className="flex flex-col sm:flex-row items-center gap-4">
                               <div className="flex-1 w-full space-y-1">
                                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Đơn vị</label>
                                 <input 
                                   {...register(`hierarchyLevels.${index}.unitTypeName` as const, { required: true })} 
                                   className="w-full bg-white dark:bg-slate-900 px-3 py-2 rounded-xl text-sm font-bold text-slate-900 dark:text-white border border-slate-100 dark:border-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all"
                                   placeholder="VD: Chi nhánh"
                                  />
                               </div>
                               <div className="flex-1 w-full space-y-1">
                                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Chức danh quản lý</label>
                                 <input 
                                   {...register(`hierarchyLevels.${index}.managerRoleLabel` as const)} 
                                   className="w-full bg-white dark:bg-slate-900 px-3 py-2 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all"
                                   placeholder="VD: Giám đốc"
                                  />
                               </div>
                             </div>
                          </div>
                          
                          <div className="flex flex-col gap-1.5">
                             <button type="button" disabled={index === 0} onClick={() => move(index, index - 1)} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 disabled:opacity-20"><ArrowUp size={14} /></button>
                             <button type="button" disabled={index === fields.length - 1} onClick={() => move(index, index + 1)} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 disabled:opacity-20"><ArrowDown size={14} /></button>
                             {fields.length > 2 && (
                               <button type="button" onClick={() => remove(index)} className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 transition-colors"><Trash2 size={14} /></button>
                             )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => append({ unitTypeName: '', managerRoleLabel: '' })}
                    className="w-full py-4 flex items-center justify-center gap-2 border border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-400 hover:text-indigo-600 rounded-2xl text-[11px] font-bold uppercase tracking-wider transition-all"
                  >
                    <Plus size={16} /> Thêm cấp bậc
                  </button>

                  <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => { setIsEditingHierarchy(false); reset() }} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Hủy</button>
                    <button type="submit" className="flex-[2] py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider shadow-lg hover:bg-indigo-700 transition-all">Lưu</button>
                  </div>
               </form>
             ) : (
               <div className="space-y-0 relative">
                  <div className="absolute left-[15px] top-6 bottom-6 w-px bg-slate-100 dark:bg-slate-800" />
                  {org?.hierarchyLevels?.map((level, idx) => (
                    <div key={level.id} className="relative pl-12 pb-8 last:pb-0 group">
                      <div className="absolute left-0 top-0 w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border-2 border-slate-50 dark:border-slate-800 flex items-center justify-center z-10 shadow-sm transition-transform">
                        <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center text-white text-[9px] font-black">
                          {idx + 1}
                        </div>
                      </div>
                      <div className="p-5 rounded-2xl bg-slate-50/50 dark:bg-slate-800/40 border border-transparent hover:border-slate-100 dark:hover:border-slate-800 hover:bg-white dark:hover:bg-slate-800 transition-all duration-300">
                        <div className="flex justify-between items-center">
                          <div className="space-y-0.5">
                            <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Cấp bậc</h4>
                            <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{level.unitTypeName}</p>
                            <div className="flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 w-fit">
                              <ShieldCheck size={12} className="text-indigo-500" />
                              <span className="text-[10px] font-medium text-slate-500">
                                {level.managerRoleLabel || (idx === (org.hierarchyLevels?.length || 0) - 1 ? 'Nhân viên' : 'N/A')}
                              </span>
                            </div>
                          </div>
                          <div className="text-slate-300 dark:text-slate-700">
                            <ChevronUp className="rotate-90" size={16} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
               </div>
             )}
           </div>
        </section>
      </div>
      
      {org && <NotificationConfigSection org={org} />}
    </div>
  )
}

function HeroStat({ icon: Icon, label, value, valueColor = "text-white/90" }: { icon: any; label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white border border-white/10 transition-colors">
        <Icon size={14} />
      </div>
      <div className="flex flex-col text-left">
        <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider">{label}</span>
        <span className={cn("text-[12px] font-bold", valueColor)}>{value}</span>
      </div>
    </div>
  )
}

function ScoringConfigSection({ org }: { org: any }) {
  const updateMutation = useUpdateOrganization(org.id)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    evaluationMaxScore: org?.evaluationMaxScore || 100,
    excellentThreshold: org?.excellentThreshold || 90,
    goodThreshold: org?.goodThreshold || 80,
    fairThreshold: org?.fairThreshold || 70,
    averageThreshold: org?.averageThreshold || 50,
  })
  // State lưu lại cấu hình gốc trước khi bắt đầu thay đổi thang điểm để tính tỷ lệ chính xác
  const [baseConfig, setBaseConfig] = useState<typeof formData | null>(null)

  useEffect(() => {
    if (org) {
      setFormData({
        evaluationMaxScore: org.evaluationMaxScore || 100,
        excellentThreshold: org.excellentThreshold || 90,
        goodThreshold: org.goodThreshold || 80,
        fairThreshold: org.fairThreshold || 70,
        averageThreshold: org.averageThreshold || 50,
      })
    }
  }, [org])

  const handleSave = () => {
    // Validation
    const { evaluationMaxScore, excellentThreshold, goodThreshold, fairThreshold, averageThreshold } = formData

    if (evaluationMaxScore <= 0) {
      toast.error('Thang điểm tối đa phải lớn hơn 0')
      return
    }

    if (excellentThreshold > evaluationMaxScore || goodThreshold > evaluationMaxScore || 
        fairThreshold > evaluationMaxScore || averageThreshold > evaluationMaxScore) {
      toast.error('Điểm các mức không được vượt quá Thang điểm tối đa (' + evaluationMaxScore + ')')
      return
    }

    if (!(excellentThreshold > goodThreshold && goodThreshold > fairThreshold && fairThreshold > averageThreshold)) {
      toast.error('Thứ tự điểm phải hợp lý: Xuất sắc > Tốt > Khá > Trung bình')
      return
    }

    if (averageThreshold <= 0) {
      toast.error('Điểm tối thiểu phải lớn hơn 0')
      return
    }

    updateMutation.mutate(formData, {
      onSuccess: () => {
        setIsEditing(false)
        toast.success('Cập nhật thang điểm thành công')
      },
      onError: () => toast.error('Không thể cập nhật thang điểm')
    })
  }

  return (
    <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full animate-in slide-in-from-left-4 duration-700 delay-75">
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <Target size={20} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Thang điểm</h3>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Tiêu chuẩn xếp loại</p>
                </div>
            </div>
            {!isEditing && (
              <button 
                  onClick={() => setIsEditing(true)}
                  className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center group"
              >
                  <Edit3 size={16} />
              </button>
            )}
        </div>

        <div className="p-8 space-y-8">
            <div className="relative p-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-700 text-white overflow-hidden shadow-xl shadow-indigo-500/10">
               <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
               <div className="flex justify-between items-center relative z-10">
                 <div className="space-y-0.5">
                   <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">
                     Hệ số tối đa
                     {isEditing && baseConfig && baseConfig.evaluationMaxScore !== formData.evaluationMaxScore && (
                       <span className="ml-2 lowercase text-white/60">
                         (x{(formData.evaluationMaxScore / baseConfig.evaluationMaxScore).toFixed(2)})
                       </span>
                     )}
                   </p>
                   <h4 className="text-xl font-black">Thang {formData.evaluationMaxScore} điểm</h4>
                 </div>
                 <div className="flex items-center">
                   {isEditing ? (
                     <input 
                        type="number"
                        value={formData.evaluationMaxScore}
                         onFocus={() => {
                           // Khi focus, chốt lại cấu hình hiện tại làm mốc để nhân tỷ lệ
                           setBaseConfig({ ...formData });
                         }}
                         onChange={e => {
                           const newMax = Number(e.target.value);
                           // Sử dụng baseConfig để tính toán từ mốc ban đầu, tránh sai số cộng dồn
                           if (baseConfig && baseConfig.evaluationMaxScore > 0 && newMax > 0) {
                             const ratio = newMax / baseConfig.evaluationMaxScore;
                             setFormData({
                               ...formData,
                               evaluationMaxScore: newMax,
                               excellentThreshold: Math.round(baseConfig.excellentThreshold * ratio),
                               goodThreshold: Math.round(baseConfig.goodThreshold * ratio),
                               fairThreshold: Math.round(baseConfig.fairThreshold * ratio),
                               averageThreshold: Math.round(baseConfig.averageThreshold * ratio),
                             });
                           } else {
                             setFormData({...formData, evaluationMaxScore: newMax});
                           }
                         }}
                        className="w-16 bg-white/10 border border-white/10 rounded-lg py-2 px-2 text-center text-sm font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                     />
                   ) : (
                     <div className="px-4 py-2 bg-white/10 rounded-lg text-sm font-black border border-white/10">
                        {formData.evaluationMaxScore}
                     </div>
                   )}
                 </div>
               </div>
               <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 w-full opacity-50" />
               </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
                <ThresholdItem 
                    label="Xuất sắc" 
                    value={formData.excellentThreshold} 
                    onChange={val => setFormData({...formData, excellentThreshold: val})}
                    icon={<Sparkles className="text-amber-500" size={16} />}
                    isEditing={isEditing}
                    maxScore={formData.evaluationMaxScore}
                />
                <ThresholdItem 
                    label="Tốt" 
                    value={formData.goodThreshold} 
                    onChange={val => setFormData({...formData, goodThreshold: val})}
                    icon={<CheckCircle className="text-emerald-500" size={16} />}
                    isEditing={isEditing}
                    maxScore={formData.evaluationMaxScore}
                />
                <ThresholdItem 
                    label="Khá" 
                    value={formData.fairThreshold} 
                    onChange={val => setFormData({...formData, fairThreshold: val})}
                    icon={<TrendingUp className="text-blue-500" size={16} />}
                    isEditing={isEditing}
                    maxScore={formData.evaluationMaxScore}
                />
                <ThresholdItem 
                    label="Trung bình" 
                    value={formData.averageThreshold} 
                    onChange={val => setFormData({...formData, averageThreshold: val})}
                    icon={<BarChart3 className="text-slate-500" size={16} />}
                    isEditing={isEditing}
                    maxScore={formData.evaluationMaxScore}
                />
            </div>

            <div className="p-4 rounded-2xl bg-red-50/50 dark:bg-red-950/10 border border-red-100/50 dark:border-red-900/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-100/50 dark:bg-red-900/30 flex items-center justify-center text-red-600">
                    <AlertCircle size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-red-400 uppercase tracking-widest">Loại Yếu</p>
                    <p className="text-sm font-bold text-red-600 tracking-tight">Dưới {formData.averageThreshold} điểm</p>
                  </div>
                </div>
            </div>

            {isEditing && (
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsEditing(false);
                    // Reset to original values
                    setFormData({
                      evaluationMaxScore: org?.evaluationMaxScore || 100,
                      excellentThreshold: org?.excellentThreshold || 90,
                      goodThreshold: org?.goodThreshold || 80,
                      fairThreshold: org?.fairThreshold || 70,
                      averageThreshold: org?.averageThreshold || 50,
                    });
                  }} 
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Hủy
                </button>
                <button 
                  type="button" 
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="flex-[2] py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updateMutation.isPending && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Lưu
                </button>
              </div>
            )}
        </div>
    </section>
  )
}

function ThresholdItem({ label, value, onChange, icon, isEditing, maxScore }: { label: string; value: number; onChange: (val: number) => void; icon: any; isEditing: boolean; maxScore: number }) {
    const safeValue = value || 0;
    const isError = value > maxScore;

    return (
        <div className="space-y-2 group">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 transition-transform">
                {icon}
              </div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {label}
              </label>
            </div>
            <div className="relative">
                {isEditing ? (
                  <input 
                      type="number"
                      value={value}
                      onChange={e => onChange(Number(e.target.value))}
                      className={cn(
                        "w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border focus:ring-2 outline-none transition-all font-bold text-sm",
                        isError 
                          ? "border-red-500 focus:ring-red-500/20 text-red-600" 
                          : "border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/5"
                      )}
                  />
                ) : (
                  <div className="w-full px-4 py-2.5 rounded-xl bg-slate-50/50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/50 font-black text-sm text-slate-700 dark:text-slate-200">
                    {safeValue}
                  </div>
                )}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 uppercase">Điểm</div>
            </div>
            <p className="text-[9px] font-bold text-slate-400 px-1 uppercase tracking-tight">≥ {safeValue}đ</p>
        </div>
    )
}

function NotificationConfigSection({ org }: { org: any }) {
  const updateMutation = useUpdateOrganization(org.id)
  const [isEditing, setIsEditing] = useState(false)
  const [kpiReminderPercentage, setKpiReminderPercentage] = useState(org?.kpiReminderPercentage ?? 50)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('')

  const { data: periodsData } = useKpiPeriods({ organizationId: org.id, size: 100, sortBy: 'startDate', direction: 'DESC' })
  const periods = periodsData?.content || []

  useEffect(() => {
    if (org) {
      setKpiReminderPercentage(org.kpiReminderPercentage ?? 50)
    }
  }, [org])

  useEffect(() => {
    if (periods.length > 0 && !selectedPeriodId) {
      const firstPeriod = periods[0]
      if (firstPeriod) {
        setSelectedPeriodId(firstPeriod.id)
      }
    }
  }, [periods, selectedPeriodId])

  const handleSave = () => {
    if (kpiReminderPercentage < 10 || kpiReminderPercentage > 90) {
      toast.error('Tỷ lệ thời gian nhắc nhở phải từ 10% đến 90%')
      return
    }

    updateMutation.mutate({ kpiReminderPercentage }, {
      onSuccess: () => {
        setIsEditing(false)
        toast.success('Cập nhật cài đặt thông báo thành công')
      },
      onError: () => toast.error('Không thể cập nhật cài đặt')
    })
  }

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId)
  
  let reminderDateStr = ''
  if (selectedPeriod && selectedPeriod.startDate && selectedPeriod.endDate) {
    const start = new Date(selectedPeriod.startDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(selectedPeriod.endDate)
    end.setHours(0, 0, 0, 0)
    
    const diffDays = Math.round(Math.abs(end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
    const reminderTime = start.getTime() + (diffDays * 24 * 60 * 60 * 1000 * kpiReminderPercentage / 100)
    reminderDateStr = formatDateTime(new Date(reminderTime).toISOString()).split(' ')[0] || ''
  }

  return (
    <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-700 mt-8">
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <BellRing size={20} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Cài đặt Thông báo</h3>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Thời điểm nhắc nhở Deadline chung cho toàn công ty</p>
                </div>
            </div>
            {!isEditing && (
              <button 
                  onClick={() => setIsEditing(true)}
                  className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-blue-600 border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center group"
              >
                  <Edit3 size={16} />
              </button>
            )}
        </div>

        <div className="p-8 space-y-8">
            <div className="flex flex-col lg:flex-row gap-8">
                {/* Left side: Info and Actions */}
                <div className="lg:w-1/3 space-y-6">
                    <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-4">
                        <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-blue-600 shadow-sm">
                            <Clock size={20} />
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-[13px] font-bold text-slate-900 dark:text-white uppercase tracking-wide">Cấu hình Deadline</h4>
                            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                                Chọn một ngày cụ thể trên lịch bên cạnh để thiết lập thời điểm hệ thống tự động gửi thông báo nhắc nhở nộp KPI cho toàn bộ nhân viên.
                            </p>
                        </div>
                        
                        <div className="pt-2">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tỷ lệ tương ứng</div>
                            <div className="text-2xl font-black text-blue-600 tracking-tighter">{kpiReminderPercentage}%</div>
                        </div>
                    </div>

                    {isEditing && (
                        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                            <button 
                                type="button" 
                                onClick={handleSave}
                                disabled={updateMutation.isPending}
                                className="w-full py-3 bg-blue-600 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {updateMutation.isPending && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                Lưu thay đổi
                            </button>
                            <button 
                                type="button" 
                                onClick={() => {
                                    setIsEditing(false)
                                    setKpiReminderPercentage(org?.kpiReminderPercentage ?? 50)
                                }} 
                                className="w-full py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                            >
                                Hủy
                            </button>
                        </div>
                    )}
                </div>

                {/* Right side: Interactive Calendar */}
                <div className="flex-1 bg-blue-50/50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30 p-8 flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                    
                    <div className="flex items-center justify-between mb-8 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20">
                                <Calendar size={16} />
                            </div>
                            <h4 className="text-[11px] font-bold text-blue-900 dark:text-blue-400 uppercase tracking-widest">Lịch nhắc nhở trực quan</h4>
                        </div>
                        
                        <div className="w-52">
                            <Select 
                                value={selectedPeriodId}
                                onValueChange={setSelectedPeriodId}
                            >
                                <SelectTrigger className="w-full bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800 text-[11px] font-bold focus:ring-blue-500/20">
                                    <SelectValue placeholder="Chọn đợt KPI" />
                                </SelectTrigger>
                                <SelectContent>
                                    {periods.length === 0 && (
                                        <SelectItem value="none" disabled>Chưa có đợt KPI</SelectItem>
                                    )}
                                    {periods.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex-1 relative z-10">
                        {selectedPeriod ? (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-100 dark:border-blue-900/30 shadow-xl shadow-blue-900/5 overflow-hidden p-6">
                                <KpiReminderCalendar 
                                    startDate={selectedPeriod.startDate || ''}
                                    endDate={selectedPeriod.endDate || ''}
                                    percentage={kpiReminderPercentage}
                                    isEditing={isEditing}
                                    onDateSelect={(pct) => setKpiReminderPercentage(pct)}
                                />
                                
                                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-tight">
                                            Ngày gửi nhắc nhở: <span className="text-blue-600 ml-1">{reminderDateStr}</span>
                                        </p>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-medium italic">
                                        * {isEditing ? "Bấm vào ô ngày để thay đổi" : "Bấm nút 'Chỉnh sửa' để thay đổi ngày"}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                                <Calendar size={48} className="text-blue-200 dark:text-blue-900/50 mb-4" />
                                <p className="text-sm font-medium text-slate-400">Chọn đợt KPI để hiển thị lịch</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </section>
  )
}

function KpiReminderCalendar({ startDate, endDate, percentage, isEditing, onDateSelect }: { 
  startDate: string; endDate: string; percentage: number; isEditing: boolean; onDateSelect: (pct: number) => void 
}) {
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)
  
  const dayMs = 24 * 60 * 60 * 1000
  const diffDays = Math.round(Math.abs(end.getTime() - start.getTime()) / dayMs)
  const daysInPeriod = diffDays + 1
  
  const currentReminderTime = start.getTime() + (diffDays * dayMs * percentage / 100)
  const currentReminderDate = new Date(currentReminderTime)
  currentReminderDate.setHours(0, 0, 0, 0)

  // Group days by Month-Year
  const monthGroups: { label: string, month: number, year: number, days: any[] }[] = []
  
  for (let i = 0; i < daysInPeriod; i++) {
    const d = new Date(start.getTime() + i * dayMs)
    d.setHours(0, 0, 0, 0)
    
    const monthLabel = `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`
    let group = monthGroups.find(g => g.label === monthLabel)
    
    if (!group) {
      group = { label: monthLabel, month: d.getMonth(), year: d.getFullYear(), days: [] }
      monthGroups.push(group)
    }
    
    group.days.push({
      date: d,
      isReminder: d.getTime() === currentReminderDate.getTime(),
      index: i
    })
  }

  const [currentMonthIdx, setCurrentMonthIdx] = useState(() => {
    // Default to the month that contains the reminder date
    const idx = monthGroups.findIndex(g => 
      g.month === currentReminderDate.getMonth() && g.year === currentReminderDate.getFullYear()
    )
    return idx !== -1 ? idx : 0
  })

  const currentGroup = monthGroups[currentMonthIdx] || monthGroups[0]

  // Pre-calculate mapping for clicks
  const dayToPercentage = new Map<number, number>()
  for (let p = 0; p <= 100; p++) {
    const time = start.getTime() + (diffDays * dayMs * p / 100)
    const d = new Date(time)
    d.setHours(0, 0, 0, 0)
    const dayIdx = Math.round((d.getTime() - start.getTime()) / dayMs)
    if (!dayToPercentage.has(dayIdx)) {
      dayToPercentage.set(dayIdx, p)
    }
  }

  if (!currentGroup) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
         <div className="flex items-center gap-3">
            <button 
                type="button"
                onClick={() => setCurrentMonthIdx(prev => Math.max(0, prev - 1))}
                disabled={currentMonthIdx === 0}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
            >
                <ArrowLeft size={14} />
            </button>
            <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest min-w-[100px] text-center">
                {currentGroup.label}
            </span>
            <button 
                type="button"
                onClick={() => setCurrentMonthIdx(prev => Math.min(monthGroups.length - 1, prev + 1))}
                disabled={currentMonthIdx === monthGroups.length - 1}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
            >
                <ArrowRight size={14} />
            </button>
         </div>
         <span className="text-[10px] font-bold text-slate-400 italic">Tổng {daysInPeriod} ngày</span>
      </div>
      
      <div className="grid grid-cols-7 gap-1.5 animate-in fade-in slide-in-from-right-2 duration-300">
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
          <div key={d} className="text-[9px] font-black text-slate-300 text-center py-1 uppercase">{d}</div>
        ))}
        
        {/* Fill empty slots if month doesn't start on Monday */}
        {Array.from({ length: (currentGroup.days[0].date.getDay() + 6) % 7 }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square opacity-0" />
        ))}

        {currentGroup.days.map((d: any) => (
          <button
            key={d.date.toISOString()}
            type="button"
            onClick={() => {
              if (!isEditing) return
              const pct = dayToPercentage.get(d.index)
              if (pct !== undefined) {
                onDateSelect(pct)
              }
            }}
            className={cn(
              "aspect-square rounded-xl flex flex-col items-center justify-center transition-all border relative group",
              d.isReminder 
                ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20 scale-105 z-10" 
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-800",
              isEditing && !d.isReminder && "hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20",
              !isEditing && "cursor-default"
            )}
          >
            <span className="text-[11px] font-bold">{d.date.getDate()}</span>
            {d.isReminder && (
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 rounded-full border-2 border-blue-600 animate-pulse" />
            )}
          </button>
        ))}
      </div>
      
      <div className="flex justify-center gap-1">
        {monthGroups.map((_, idx) => (
            <div 
                key={idx} 
                className={cn(
                    "w-1 h-1 rounded-full transition-all",
                    idx === currentMonthIdx ? "w-4 bg-blue-500" : "bg-slate-200 dark:bg-slate-700"
                )}
            />
        ))}
      </div>
    </div>
  )
}
