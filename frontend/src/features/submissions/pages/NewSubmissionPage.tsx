import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { submissionSchema, type SubmissionFormData } from '../schemas/submissionSchema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import { useMyKpi } from '@/features/kpi/hooks/useMyKpi'
import FileDropzone from '@/components/common/FileDropzone'
import { useUploadStore } from '@/store/uploadStore'
import { toast } from 'sonner'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { formatNumber } from '@/lib/utils'
import { 
  Loader2, Target, Activity, 
  MessageSquare, Paperclip, ChevronLeft, Send, Sparkles, Save,
  AlertCircle, Calendar, Info, CheckCircle2, ShieldAlert
} from 'lucide-react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'

export default function NewSubmissionPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id
  const [searchParams] = useSearchParams()
  const preselectedKpiId = searchParams.get('kpiId') ?? ''
  const qc = useQueryClient()
  const [files, setFiles] = useState<File[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingData, setPendingData] = useState<SubmissionFormData | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const { data: myKpiData, isLoading: loadingKpis } = useMyKpi({ page: 0, size: 100 })

  const { data: existingSubmission, isLoading: loadingExisting } = useQuery({
    queryKey: ['submissions', id],
    queryFn: () => submissionApi.getById(id!),
    enabled: isEdit,
  })

  const { register, handleSubmit, watch, setValue, reset, control, formState: { errors } } = useForm<SubmissionFormData>({
    resolver: zodResolver(submissionSchema),
    defaultValues: { kpiCriteriaId: preselectedKpiId },
  })

  const [isInitialSyncDone, setIsInitialSyncDone] = useState(false)

  // Load existing data if editing
  useEffect(() => {
    if (existingSubmission) {
      reset({
        kpiCriteriaId: existingSubmission.kpiCriteriaId,
        actualValue: existingSubmission.actualValue,
        note: existingSubmission.note ?? '',
        periodStart: existingSubmission.periodStart ? new Date(existingSubmission.periodStart).toISOString().split('T')[0] : undefined,
        periodEnd: existingSubmission.periodEnd ? new Date(existingSubmission.periodEnd).toISOString().split('T')[0] : undefined,
      })
      setIsInitialSyncDone(true)
    }
  }, [existingSubmission, reset])

  // Handle Initial Sync once data is loaded (for new submissions)
  useEffect(() => {
    if (!myKpiData?.content || isInitialSyncDone || isEdit) return;

    const approvedKpis = myKpiData.content.filter(k => (k.status === 'APPROVED' || k.status === 'EDITED' || k.status === 'EDIT') && k.submissionCount < k.expectedSubmissions);
    let targetId: string = preselectedKpiId ?? '';
    
    if (!targetId) {
      const currentVal = watch('kpiCriteriaId');
      if (currentVal && approvedKpis.some(k => k.id === currentVal)) {
        targetId = currentVal;
      }
    }
    
    if (!targetId || !approvedKpis.some(k => k.id === targetId)) {
      if (approvedKpis.length > 0) {
        targetId = approvedKpis[0]?.id ?? '';
      }
    }

    if (targetId) {
      setValue('kpiCriteriaId', targetId);
    }
    
    setIsInitialSyncDone(true);
  }, [myKpiData, isInitialSyncDone, preselectedKpiId, setValue, watch, isEdit]);

  const selectedKpiId = watch('kpiCriteriaId')
  const selectedKpi = myKpiData?.content?.find(k => k.id === selectedKpiId)

  const { addUpload } = useUploadStore()

  const mutation = useMutation({
    mutationFn: async ({ data, isDraft }: { data: SubmissionFormData, isDraft: boolean }) => {
      const payload = { ...data, isDraft }
      if (isEdit) {
        return await submissionApi.update(id!, payload as any)
      } else {
        return await submissionApi.create(payload as any)
      }
    },
    onSuccess: (sub, variables) => {
      qc.invalidateQueries({ queryKey: ['submissions'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })

      // Handle background upload if there are files
      if (files.length > 0) {
        addUpload(sub.id, files)
        toast.info('Đang bắt đầu tải lên tài liệu minh chứng...')
      }
      
      if (!variables.isDraft) {
        const periodId = selectedKpi?.kpiPeriod?.id
        const periodKpis = myKpiData?.content?.filter(k => k.kpiPeriodId === periodId) || []
        
        const isAllFinished = periodKpis.every(k => {
          const currentCount = k.id === selectedKpi?.id ? k.submissionCount + 1 : k.submissionCount
          return currentCount >= k.expectedSubmissions
        })

        if (isAllFinished) {
          setShowSuccess(true)
        } else {
          toast.success('Gửi báo cáo thành công!')
          navigate('/submissions')
        }
      } else {
        toast.success('Đã lưu bản nháp!')
        navigate('/submissions')
      }
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Thao tác thất bại'),
  })

  if (loadingKpis || (isEdit && loadingExisting)) return <div className="p-8"><LoadingSkeleton type="form" rows={8} /></div>

  // Check if editable
  if (isEdit && existingSubmission && existingSubmission.status !== 'DRAFT') {
    return (
      <div className="flex flex-col items-center justify-center py-32 animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 bg-rose-50 dark:bg-rose-950/20 rounded-[30px] flex items-center justify-center mb-6 border border-rose-100 dark:border-rose-900/30">
          <AlertCircle className="w-10 h-10 text-rose-500" />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">Không thể chỉnh sửa</h2>
        <p className="text-slate-500 mb-8 max-w-md text-center">Báo cáo này đã được phê duyệt hoặc đang chờ xử lý, không thể thay đổi thông tin tại thời điểm này.</p>
        <button 
          onClick={() => navigate(-1)} 
          className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95"
        >
          QUAY LẠI
        </button>
      </div>
    )
  }

  const approvedKpis = myKpiData?.content?.filter(k => (k.status === 'APPROVED' || k.status === 'EDITED') && k.submissionCount < k.expectedSubmissions) || []

  return (
    <div className="max-w-[1200px] mx-auto p-4 md:p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Dynamic Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
           <button 
            type="button" 
            onClick={() => navigate(-1)}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all group shadow-sm active:scale-90"
          >
            <ChevronLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
          </button>
          <div className="space-y-1">
             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-900/30">
               <Sparkles size={12} className="fill-current" /> {isEdit ? 'Hiệu chỉnh dữ liệu' : 'Cập nhật kết quả'}
             </div>
             <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                {isEdit ? 'Cập nhật Báo cáo KPI' : 'Báo cáo Chỉ tiêu KPI'}
             </h1>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Main Form (Left) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-8 md:p-10 space-y-10">
            
            {/* KPI Selection */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest opacity-70">
                <Target size={18} className="text-indigo-600" /> KPI cần báo cáo <span className="text-rose-500">*</span>
              </label>
              <div className="relative group">
                <Controller
                  name="kpiCriteriaId"
                  control={control}
                  render={({ field }) => (
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value} 
                      disabled={isEdit}
                    >
                      <SelectTrigger className="w-full pl-6 pr-10 py-4 h-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 appearance-none transition-all disabled:opacity-50 cursor-pointer group-hover:bg-slate-100">
                        <SelectValue placeholder="-- Hãy chọn một chỉ tiêu KPI --" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] rounded-2xl border-slate-200 dark:border-slate-800 shadow-xl">
                        {isEdit ? (
                          <SelectItem value={existingSubmission?.kpiCriteriaId || ''}>
                            {existingSubmission?.kpiCriteriaName}
                          </SelectItem>
                        ) : (
                          approvedKpis.map((k) => (
                            <SelectItem key={k.id} value={k.id}>
                              <div className="flex items-center gap-2 py-0.5">
                                <span className="font-bold">{k.name}</span>
                                {k.targetValue != null && (
                                  <span className="text-[10px] text-slate-400 uppercase tracking-tighter opacity-80">
                                    — Mục tiêu: {formatNumber(k.targetValue)} {k.unit ?? ''}
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              {approvedKpis.length === 0 && !isEdit && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 flex items-center gap-3">
                   <Info size={18} className="text-amber-500 shrink-0" />
                   <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Bạn đã hoàn thành tất cả các báo cáo dự kiến hoặc không có KPI nào đã được duyệt.</p>
                </div>
              )}
            </div>

            {/* Actual Value Input */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest opacity-70">
                <Activity size={18} className="text-emerald-600" /> Trị số thực tế đã đạt <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-slate-400">
                   <span className="text-xl font-black">#</span>
                </div>
                <input 
                  {...register('actualValue', { valueAsNumber: true })} 
                  type="number" 
                  step="any" 
                  onWheel={(e) => e.currentTarget.blur()}
                  className="w-full pl-14 pr-24 py-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-3xl font-black focus:outline-none focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-inner" 
                  placeholder="0.00" 
                />
                {selectedKpi?.unit && (
                  <div className="absolute inset-y-0 right-6 flex items-center pointer-events-none">
                     <span className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 rounded-xl font-black text-xs uppercase tracking-widest border border-indigo-100 dark:border-indigo-900/40">
                       {selectedKpi.unit}
                     </span>
                  </div>
                )}
              </div>
              {errors.actualValue && <p className="text-rose-500 text-xs font-bold ml-2 flex items-center gap-1.5"><AlertCircle size={14} /> {errors.actualValue.message}</p>}
            </div>

            {/* Explanation & Evidence */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
               <div className="space-y-4">
                  <label className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest opacity-70">
                    <MessageSquare size={18} className="text-indigo-600" /> Báo cáo giải trình
                  </label>
                  <textarea 
                    {...register('note')} 
                    rows={8} 
                    className="w-full px-6 py-5 rounded-[28px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 resize-none transition-all placeholder:text-slate-400" 
                    placeholder="Mô tả cụ thể cách bạn đạt được kết quả này..." 
                  />
               </div>

               <div className="space-y-4">
                  <label className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest opacity-70">
                    <Paperclip size={18} className="text-indigo-600" /> Tài liệu Chứng minh
                  </label>
                  <div className="flex-1">
                    <FileDropzone
                      onFilesSelected={(acc) => setFiles(prev => [...prev, ...acc])}
                      files={files}
                      onRemove={(idx) => setFiles(files.filter((_, j) => j !== idx))}
                    />
                  </div>
               </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-10 flex flex-col-reverse sm:flex-row gap-4 border-t border-slate-100 dark:border-slate-800">
               <button 
                type="button" 
                onClick={() => navigate(-1)} 
                className="px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-95"
              >
                Hủy bỏ
              </button>
              
              <div className="flex-1 flex gap-4">
                <button 
                  type="button"
                  disabled={mutation.isPending}
                  onClick={handleSubmit(data => mutation.mutate({ data, isDraft: true }))}
                  className="flex-1 px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest border-2 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                >
                  <Save size={18} /> Lưu Nháp
                </button>
                <button 
                  type="button"
                  disabled={mutation.isPending} 
                  onClick={handleSubmit(data => {
                    setPendingData(data)
                    setShowConfirm(true)
                  })}
                  className="flex-1 px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  {mutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  {isEdit && existingSubmission?.status === 'DRAFT' ? 'Hoàn tất & Gửi duyệt' : 'Gửi báo cáo'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Info Cards (Right) */}
        <div className="lg:col-span-4 space-y-6">
          {selectedKpi && (
            <div className="bg-indigo-600 rounded-[40px] p-8 text-white relative overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
               <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
               <div className="relative z-10 space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xl flex items-center justify-center border border-white/10">
                      <Target size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">KPI Hiện tại</p>
                      <h4 className="text-sm font-black line-clamp-1">Thông tin tham chiếu</h4>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-3xl font-black leading-tight tracking-tight">{selectedKpi.name}</p>
                    <p className="text-xs font-medium opacity-60">{selectedKpi.description || 'Không có mô tả chi tiết cho chỉ tiêu này.'}</p>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="bg-black/20 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">Tối thiểu</p>
                        <p className="text-lg font-black truncate">
                          {selectedKpi.minimumValue != null ? formatNumber(selectedKpi.minimumValue) : '0'}
                          <span className="text-[8px] font-bold ml-0.5 opacity-60">{selectedKpi.unit ?? ''}</span>
                        </p>
                    </div>
                    <div className="bg-black/20 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">Mục tiêu</p>
                        <p className="text-lg font-black truncate">
                          {selectedKpi.targetValue != null ? formatNumber(selectedKpi.targetValue) : '—'}
                          <span className="text-[8px] font-bold ml-0.5 opacity-60">{selectedKpi.unit ?? ''}</span>
                        </p>
                    </div>
                    <div className="bg-black/20 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">Trọng số</p>
                        <p className="text-lg font-black">{selectedKpi.weight}%</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                    <Calendar size={18} className="text-indigo-200" />
                    <div>
                       <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Hạn báo cáo</p>
                       <p className="text-[11px] font-bold">
                          {selectedKpi.kpiPeriod?.name || 'Vô thời hạn'}
                       </p>
                    </div>
                  </div>
               </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 p-8 space-y-6 shadow-sm">
             <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
                   <Info size={20} />
                </div>
                <h4 className="font-black text-sm uppercase tracking-widest">Lưu ý khi nộp bài</h4>
             </div>
             <ul className="space-y-4">
                <ListItem icon={CheckCircle2} text="Dữ liệu thực tế phải được nhập bằng số để hệ thống có thể tính toán điểm thưởng." />
                <ListItem icon={CheckCircle2} text="Hãy đính kèm hình ảnh hoặc file tài liệu (PDF, Word, Excel...) để tăng độ tin cậy của báo cáo." />
                <ListItem icon={CheckCircle2} text="Báo cáo ở trạng thái Nháp có thể chỉnh sửa bất cứ lúc nào trước khi Gửi duyệt." />
             </ul>
          </div>
        </div>
      </div>

      {/* Confirmation Modal - Premium Dangerous Style */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-500">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-[48px] border border-rose-200 dark:border-rose-900/30 shadow-[0_32px_64px_-16px_rgba(244,63,94,0.3)] max-w-md w-full overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
            {/* Top Danger Bar */}
            <div className="h-2 bg-gradient-to-r from-rose-500 via-orange-500 to-rose-500" />
            
            <div className="p-10 text-center space-y-8">
              <div className="relative">
                <div className="absolute inset-0 bg-rose-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
                <div className="relative w-24 h-24 bg-gradient-to-br from-rose-500 to-rose-600 rounded-[32px] flex items-center justify-center mx-auto shadow-2xl shadow-rose-500/40 rotate-3">
                  <ShieldAlert className="w-12 h-12 text-white" />
                </div>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Xác nhận nộp báo cáo?</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed">
                  Hành động này sẽ gửi kết quả trực tiếp đến quản lý. <br/>
                  <span className="text-rose-500 font-bold">Lưu ý:</span> Bạn sẽ không thể tự ý sửa đổi sau khi đã gửi đi.
                </p>
              </div>

              <div className="flex flex-col gap-4 pt-4">
                <button
                  onClick={() => {
                    if (pendingData) {
                      mutation.mutate({ data: pendingData, isDraft: false })
                      setShowConfirm(false)
                    }
                  }}
                  className="w-full py-5 bg-gradient-to-r from-rose-600 to-rose-500 text-white rounded-2xl font-black text-sm shadow-2xl shadow-rose-500/40 hover:shadow-rose-500/60 hover:-translate-y-1 transition-all active:scale-95 uppercase tracking-widest"
                >
                  TÔI ĐÃ KIỂM TRA & GỬI NGAY
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="w-full py-5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all uppercase tracking-widest"
                >
                  ĐỢI ĐÃ, QUAY LẠI
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal - Smart Flow */}
      {showSuccess && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-500">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl" />
          <div className="relative bg-white dark:bg-slate-900 rounded-[48px] border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-12 text-center space-y-10 animate-in zoom-in-95 duration-500">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
              <div className="relative w-28 h-28 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-[40px] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/40">
                <CheckCircle2 className="w-14 h-14 text-white" />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Ghi nhận hiệu suất</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Dữ liệu báo cáo của bạn đã được hệ thống ghi nhận thành công. Để hoàn tất quy trình, mời bạn thực hiện bước <strong>"Tự đánh giá"</strong> cho chu kỳ này.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <button
                onClick={() => navigate(`/evaluations?action=self-eval&periodId=${selectedKpi?.kpiPeriod?.id}`)}
                className="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-sm shadow-2xl hover:bg-indigo-600 dark:hover:bg-indigo-50 transition-all flex items-center justify-center gap-3 uppercase tracking-widest active:scale-95"
              >
                <Sparkles size={20} className="text-amber-400" /> TIẾN HÀNH TỰ ĐÁNH GIÁ
              </button>
              <button
                onClick={() => navigate('/submissions')}
                className="w-full py-5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all uppercase tracking-widest"
              >
                ĐỂ SAU, QUAY LẠI DANH SÁCH
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ListItem({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <Icon size={16} className="text-indigo-500 shrink-0 mt-0.5" />
      <p className="text-xs font-medium text-slate-500 leading-relaxed">{text}</p>
    </li>
  )
}
