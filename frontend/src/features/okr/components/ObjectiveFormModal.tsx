import { useForm, Controller } from 'react-hook-form'
import { X, Target, Loader2 } from 'lucide-react'
import { ObjectiveRequest, OkrStatus, ObjectiveResponse } from '../types'
import { useOkrMutations } from '../hooks/useOkr'
import { useEffect } from 'react'
import { format } from 'date-fns'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useOrgUnitTree } from '../../orgunits/hooks/useOrgUnitTree'
import { OrgUnitTreeResponse } from '@/types/orgUnit'

interface ObjectiveFormModalProps {
  isOpen: boolean
  onClose: () => void
  organizationId: string
  objective?: ObjectiveResponse
}

export default function ObjectiveFormModal({ isOpen, onClose, organizationId, objective }: ObjectiveFormModalProps) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<ObjectiveRequest>({
    defaultValues: {
      startDate: today,
      endDate: today,
      status: OkrStatus.ACTIVE
    }
  })

  const startDate = watch('startDate')
  const { data: orgUnitTree } = useOrgUnitTree()

  const flattenOrgUnits = (units: OrgUnitTreeResponse[], level = 0): { id: string, name: string, level: number }[] => {
    return units.reduce((acc: any[], unit) => {
      acc.push({ id: unit.id, name: unit.name, level })
      if (unit.children && unit.children.length > 0) {
        acc.push(...flattenOrgUnits(unit.children, level + 1))
      }
      return acc
    }, [])
  }

  const allOrgUnits = orgUnitTree ? flattenOrgUnits(orgUnitTree) : []

  const { createObjective, updateObjective } = useOkrMutations()

  useEffect(() => {
    if (objective) {
      reset({
        name: objective.name,
        code: objective.code,
        description: objective.description,
        startDate: objective.startDate ? objective.startDate.split('T')[0] : '',
        endDate: objective.endDate ? objective.endDate.split('T')[0] : '',
        status: objective.status,
        orgUnitId: objective.orgUnitId
      })
    } else {
      reset({
        name: '',
        code: '',
        description: '',
        startDate: today,
        endDate: today,
        status: OkrStatus.ACTIVE,
        orgUnitId: allOrgUnits[0]?.id
      })
    }
  }, [objective, reset, isOpen, allOrgUnits[0]?.id])

  const onSubmit = (data: ObjectiveRequest) => {
    if (objective) {
      updateObjective.mutate({ objectiveId: objective.id, data }, {
        onSuccess: () => onClose()
      })
    } else {
      createObjective.mutate({ organizationId, data }, {
        onSuccess: () => onClose()
      })
    }
  }

  if (!isOpen) return null

  const isPending = createObjective.isPending || updateObjective.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-950/20 dark:to-slate-900">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none">
              <Target size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">{objective ? 'Chỉnh sửa mục tiêu' : 'Tạo mục tiêu mới'}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Objective Configuration</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col max-h-[85vh]">
          <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên mục tiêu</label>
                <input 
                  {...register('name', { required: 'Vui lòng nhập tên mục tiêu' })}
                  placeholder="VD: Mở rộng thị trường..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                />
                {errors.name && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mã</label>
                <input 
                  {...register('code', { required: 'Vui lòng nhập mã' })}
                  placeholder="OBJ001"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                />
                {errors.code && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.code.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mô tả chi tiết</label>
              <textarea 
                {...register('description')}
                placeholder="Mô tả cụ thể mục tiêu cần đạt được..."
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ngày bắt đầu</label>
                <div className="relative">
                  <input 
                    type="date"
                    {...register('startDate', { required: 'Vui lòng chọn ngày bắt đầu' })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-transparent"
                  />
                  <div className="absolute inset-0 left-4 flex items-center pointer-events-none text-sm font-bold text-slate-900 dark:text-white">
                    {startDate ? format(new Date(startDate as string), 'dd/MM/yyyy') : ''}
                  </div>
                </div>
                {errors.startDate && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.startDate.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ngày kết thúc</label>
                <div className="relative">
                  <input 
                    type="date"
                    {...register('endDate', { 
                      required: 'Vui lòng chọn ngày kết thúc',
                      validate: value => {
                        if (!startDate || !value) return true
                        return new Date(value) >= new Date(startDate) || 'Ngày kết thúc không được trước ngày bắt đầu'
                      }
                    })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-transparent"
                  />
                  <div className="absolute inset-0 left-4 flex items-center pointer-events-none text-sm font-bold text-slate-900 dark:text-white">
                    {watch('endDate') ? format(new Date(watch('endDate') as string), 'dd/MM/yyyy') : ''}
                  </div>
                </div>
                {errors.endDate && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.endDate.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phòng ban</label>
                <Controller
                  name="orgUnitId"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all">
                        <SelectValue placeholder="Chọn đơn vị" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 max-h-[200px]">
                        {allOrgUnits.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id} className="text-sm font-bold">
                            {Array(unit.level).fill('\u00A0\u00A0').join('')} {unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Trạng thái</label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all">
                        <SelectValue placeholder="Trạng thái" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                        <SelectItem value={OkrStatus.ACTIVE} className="text-sm font-bold text-emerald-600">Đang thực hiện</SelectItem>
                        <SelectItem value={OkrStatus.COMPLETED} className="text-sm font-bold text-blue-600">Hoàn thành</SelectItem>
                        <SelectItem value={OkrStatus.CANCELLED} className="text-sm font-bold text-rose-600">Hủy bỏ</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex gap-4">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              Hủy
            </button>
            <button 
              type="submit"
              disabled={isPending}
              className="flex-[2] px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 className="animate-spin" size={18} />}
              {objective ? 'Lưu thay đổi' : 'Xác nhận tạo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
