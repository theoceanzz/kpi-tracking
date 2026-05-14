import { useForm } from 'react-hook-form'
import { X, CheckCircle2, Loader2 } from 'lucide-react'
import { KeyResultRequest, KeyResultResponse } from '../types'
import { useOkrMutations } from '../hooks/useOkr'
import { useEffect } from 'react'

interface KeyResultFormModalProps {
  isOpen: boolean
  onClose: () => void
  objectiveId: string
  keyResult?: KeyResultResponse
}

export default function KeyResultFormModal({ isOpen, onClose, objectiveId, keyResult }: KeyResultFormModalProps) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<KeyResultRequest>()

  const { createKeyResult, updateKeyResult } = useOkrMutations()

  useEffect(() => {
    if (keyResult) {
      reset({
        name: keyResult.name,
        code: keyResult.code,
        description: keyResult.description,
        targetValue: keyResult.targetValue,
        currentValue: keyResult.currentValue,
        unit: keyResult.unit,
        objectiveId
      })
    } else {
      reset({
        name: '',
        code: '',
        description: '',
        targetValue: 0,
        currentValue: 0,
        unit: '',
        objectiveId
      })
    }
  }, [keyResult, reset, isOpen, objectiveId])

  const onSubmit = (data: KeyResultRequest) => {
    if (keyResult) {
      updateKeyResult.mutate({ keyResultId: keyResult.id, data: { ...data, objectiveId } }, {
        onSuccess: () => onClose()
      })
    } else {
      createKeyResult.mutate({ ...data, objectiveId }, {
        onSuccess: () => onClose()
      })
    }
  }

  if (!isOpen) return null

  const isPending = createKeyResult.isPending || updateKeyResult.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-900">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200 dark:shadow-none">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">{keyResult ? 'Chỉnh sửa kết quả' : 'Thêm kết quả then chốt'}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Key Result Configuration</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên kết quả then chốt</label>
              <input 
                {...register('name', { required: 'Vui lòng nhập tên KR' })}
                placeholder="VD: Đạt 1 tỷ doanh số miền Nam"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
              />
              {errors.name && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mã kết quả then chốt</label>
              <input 
                {...register('code', { required: 'Vui lòng nhập mã KR' })}
                placeholder="VD: KR001"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
              />
              {errors.code && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.code.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mô tả chi tiết</label>
              <textarea 
                {...register('description')}
                placeholder="Mô tả cụ thể cách đo lường kết quả này..."
                rows={3}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-medium focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5 col-span-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Đơn vị</label>
                <input 
                  {...register('unit')}
                  placeholder="VD: VNĐ, %"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5 col-span-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hiện tại</label>
                <input 
                  type="number"
                  {...register('currentValue', { valueAsNumber: true })}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5 col-span-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mục tiêu</label>
                <input 
                  type="number"
                  {...register('targetValue', { required: true, valueAsNumber: true })}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              Hủy
            </button>
            <button 
              type="submit"
              disabled={isPending}
              className="flex-[2] px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 className="animate-spin" size={18} />}
              {keyResult ? 'Cập nhật KR' : 'Tạo KR mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
