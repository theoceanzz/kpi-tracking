import { useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, ChevronDown, Check } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { OkrStatus, ObjectiveResponse } from '../types'
import { createObjectiveSchema, type ObjectiveFormData } from '../schemas/okrSchema'
import { useOkrMutations } from '../hooks/useOkr'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useOrgUnitTree } from '../../orgunits/hooks/useOrgUnitTree'
import { OrgUnitTreeResponse } from '@/types/orgUnit'
import { useBscPerspectives } from '@/features/bsc/hooks/useBsc'
import { perspectiveHint } from '@/features/bsc/utils/perspectiveHint'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useCodeRule } from '@/features/orgunits/hooks/useCodeRules'
import CodeField from '@/components/common/CodeField'

interface ObjectiveFormModalProps {
  isOpen: boolean
  onClose: () => void
  organizationId: string
  objective?: ObjectiveResponse
}

export default function ObjectiveFormModal({ isOpen, onClose, organizationId, objective }: ObjectiveFormModalProps) {
  const today = format(new Date(), 'yyyy-MM-dd')

  // Mã do tổ chức quyết định: tự sinh (ô mã khoá lại) hay nhập tay như trước.
  const codeRule = useCodeRule('OBJECTIVE', organizationId)
  const schema = useMemo(() => createObjectiveSchema({ requireCode: !codeRule.optional }), [codeRule.optional])

  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm<ObjectiveFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      startDate: today,
      endDate: today,
      status: OkrStatus.ACTIVE,
      orgUnitIds: [],
      perspectiveId: null,
    }
  })

  const startDate = watch('startDate')
  const { data: orgUnitTree } = useOrgUnitTree()
  const { data: org } = useOrganization(organizationId)
  const enableBsc = org?.enableBsc
  const { data: perspectives } = useBscPerspectives(enableBsc ? organizationId : undefined)

  const perspectiveOptions = useMemo(() => {
    const list = [...(perspectives || [])]
    if (objective?.perspectiveId && !list.some(p => p.id === objective.perspectiveId)) {
      list.unshift({
        id: objective.perspectiveId,
        code: '',
        name: objective.perspectiveName || 'Hạng mục',
        color: objective.perspectiveColor || undefined,
        displayOrder: 0,
        status: 'ACTIVE' as any,
      })
    }
    return list
  }, [perspectives, objective])

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
        orgUnitIds: objective.orgUnitIds ?? [],
        perspectiveId: objective.perspectiveId ?? null,
      })
    } else {
      reset({
        name: '',
        code: '',
        description: '',
        startDate: today,
        endDate: today,
        status: OkrStatus.ACTIVE,
        orgUnitIds: [],
        perspectiveId: null,
      })
    }
  }, [objective, reset, isOpen])

  const selectedOrgUnitIds = watch('orgUnitIds') || []

  const toggleOrgUnit = (unitId: string) => {
    const isRoot = allOrgUnits[0]?.id === unitId
    let nextIds: string[] = []

    if (isRoot) {
      nextIds = selectedOrgUnitIds.includes(unitId) ? [] : allOrgUnits.map(u => u.id)
    } else {
      if (selectedOrgUnitIds.includes(unitId)) {
        nextIds = selectedOrgUnitIds.filter(id => id !== unitId && id !== allOrgUnits[0]?.id)
      } else {
        const tempIds = [...selectedOrgUnitIds, unitId]
        const rootId = allOrgUnits[0]?.id
        const allOtherIds = allOrgUnits.filter(u => u.id !== rootId).map(u => u.id)
        const allOthersSelected = allOtherIds.every(id => tempIds.includes(id))
        nextIds = allOthersSelected && rootId ? allOrgUnits.map(u => u.id) : tempIds
      }
    }
    setValue('orgUnitIds', nextIds)
  }

  const onSubmit = (data: ObjectiveFormData) => {
    if (data.perspectiveId === 'NONE' || data.perspectiveId === '') data.perspectiveId = null
    // Ô mã bị khoá ⇒ không gửi mã lên: backend giữ mã cũ khi sửa, tự cấp mã khi tạo.
    if (codeRule.locked) data.code = undefined
    if (objective) {
      updateObjective.mutate({ objectiveId: objective.id, data }, {
        onSuccess: () => onClose()
      })
    } else {
      createObjective.mutate({ organizationId, data }, {
        onSuccess: () => { onClose(); reset() }
      })
    }
  }

  const isPending = createObjective.isPending || updateObjective.isPending

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      size="md"
      dismissible={!isPending}
      title={objective ? 'Chỉnh sửa mục tiêu' : 'Tạo mục tiêu mới'}
      description="Cấu hình mục tiêu"
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={isPending}>Hủy</Button>}
          primary={
            <Button type="submit" form="objective-form" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {objective ? 'Lưu thay đổi' : 'Xác nhận tạo'}
            </Button>
          }
        />
      }
    >
      <form id="objective-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-label">Tên mục tiêu <span className="text-[var(--color-error)]">*</span></label>
            <input
              {...register('name')}
              placeholder="VD: Mở rộng thị trường..."
              className="w-full px-4 py-2.5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] text-sm font-medium focus:ring-4 focus:ring-[var(--color-ring)] focus:border-[var(--color-primary)] outline-none transition-all"
            />
            {errors.name && <p className="text-xs font-medium text-[var(--color-error)] ml-1">{errors.name.message}</p>}
          </div>

          <CodeField
            rule={codeRule}
            currentCode={objective?.code}
            error={errors.code?.message}
            register={register('code')}
            fallbackPlaceholder="OBJ001"
            tone="indigo"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-label">Mô tả chi tiết</label>
          <textarea
            {...register('description')}
            placeholder="Mô tả cụ thể mục tiêu cần đạt được..."
            rows={2}
            className="w-full px-4 py-2.5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] text-sm font-medium focus:ring-4 focus:ring-[var(--color-ring)] focus:border-[var(--color-primary)] outline-none transition-all resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-label">Ngày bắt đầu <span className="text-[var(--color-error)]">*</span></label>
            <div className="relative">
              <input
                type="date"
                {...register('startDate')}
                className="w-full px-4 py-2.5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] text-sm font-medium focus:ring-4 focus:ring-[var(--color-ring)] focus:border-[var(--color-primary)] outline-none transition-all text-transparent"
              />
              <div className="absolute inset-0 left-4 flex items-center pointer-events-none text-sm font-medium text-[var(--color-foreground)]">
                {startDate ? format(new Date(startDate as string), 'dd/MM/yyyy') : ''}
              </div>
            </div>
            {errors.startDate && <p className="text-xs font-medium text-[var(--color-error)] ml-1">{errors.startDate.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-label">Ngày kết thúc <span className="text-[var(--color-error)]">*</span></label>
            <div className="relative">
              <input
                type="date"
                {...register('endDate')}
                className="w-full px-4 py-2.5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] text-sm font-medium focus:ring-4 focus:ring-[var(--color-ring)] focus:border-[var(--color-primary)] outline-none transition-all text-transparent"
              />
              <div className="absolute inset-0 left-4 flex items-center pointer-events-none text-sm font-medium text-[var(--color-foreground)]">
                {watch('endDate') ? format(new Date(watch('endDate') as string), 'dd/MM/yyyy') : ''}
              </div>
            </div>
            {errors.endDate && <p className="text-xs font-medium text-[var(--color-error)] ml-1">{errors.endDate.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-label">Phòng ban</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal" type="button">
                  <span className="truncate">
                    {selectedOrgUnitIds.length === 0 ? 'Chọn đơn vị' :
                     selectedOrgUnitIds.length === 1 ? allOrgUnits.find(u => u.id === selectedOrgUnitIds[0])?.name :
                     `Đã chọn ${selectedOrgUnitIds.length} đơn vị`}
                  </span>
                  <ChevronDown aria-hidden="true" className="shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-2 w-[var(--radix-popover-trigger-width)] max-h-[300px] overflow-y-auto custom-scrollbar" align="start">
                <div className="space-y-1">
                  {allOrgUnits.map((unit) => {
                    const isSelected = selectedOrgUnitIds.includes(unit.id)
                    return (
                      <div
                        key={unit.id}
                        onClick={() => toggleOrgUnit(unit.id)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-card cursor-pointer transition-colors group",
                          isSelected ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]" : "hover:bg-[var(--color-muted)]"
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-all",
                          isSelected ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-[var(--color-primary-foreground)]" : "border-[var(--color-border)] group-hover:border-[var(--color-primary)]"
                        )}>
                          {isSelected && <Check size={10} strokeWidth={4} />}
                        </div>
                        <span className="text-xs font-medium truncate" style={{ marginLeft: `${unit.level * 12}px` }}>
                          {unit.name}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <label className="text-label">Trạng thái</label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full h-10 rounded-card bg-[var(--color-muted)] border-[var(--color-border)] text-sm font-medium focus:ring-4 focus:ring-[var(--color-ring)] focus:border-[var(--color-primary)] outline-none transition-all">
                    <SelectValue placeholder="Trạng thái" />
                  </SelectTrigger>
                  <SelectContent className="rounded-card border-[var(--color-border)]">
                    <SelectItem value={OkrStatus.ACTIVE} className="text-sm font-medium text-[var(--color-success)]">Đang thực hiện</SelectItem>
                    <SelectItem value={OkrStatus.COMPLETED} className="text-sm font-medium text-[var(--color-info)]">Hoàn thành</SelectItem>
                    <SelectItem value={OkrStatus.CANCELLED} className="text-sm font-medium text-[var(--color-error)]">Hủy bỏ</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        {enableBsc && (
          <div className="space-y-1.5">
            <label className="text-label">Hạng mục BSC</label>
            <Controller
              name="perspectiveId"
              control={control}
              render={({ field }) => (

                <Select key={`${field.value ?? 'NONE'}-${perspectiveOptions.length}`} value={field.value || 'NONE'} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full h-10 rounded-card bg-[var(--color-muted)] border-[var(--color-border)] text-sm font-medium outline-none">
                    <SelectValue placeholder="-- Chưa gán hạng mục --" />
                  </SelectTrigger>
                  <SelectContent className="rounded-card border-[var(--color-border)] max-h-[280px]">
                    <SelectItem value="NONE" className="text-sm font-medium text-[var(--color-muted-foreground)]">-- Chưa gán hạng mục --</SelectItem>
                    {perspectiveOptions.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-sm font-medium"
                        /* Mục tiêu ở đây là con số MẶC ĐỊNH của danh mục hạng mục. Mục tiêu
                           riêng nằm trên từng bộ tiêu chí, mà objective chưa gắn với một bộ
                           tiêu chí cụ thể nào nên chưa suy ra được — đủ để định hướng khi
                           chọn, còn con số chấm điểm thật vẫn theo bộ tiêu chí của đơn vị. */
                        extra={perspectiveHint(p) && (
                          <span className="ml-auto pl-3 text-caption whitespace-nowrap">
                            {perspectiveHint(p)}
                          </span>
                        )}>
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color || '#8b5cf6' }} />
                          {p.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-caption">KPI thuộc mục tiêu này sẽ tự kế thừa hạng mục (nếu KPI chưa gán trực tiếp).</p>
          </div>
        )}
      </form>
    </Dialog>
  )
}
