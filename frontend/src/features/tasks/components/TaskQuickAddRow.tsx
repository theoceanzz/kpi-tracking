import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2, Plus } from 'lucide-react'
import GroupedPicker from './GroupedPicker'
import { getApiErrorMessage } from '@/lib/apiError'
import { taskApi } from '../api/taskApi'
import { useTaskMutations } from '../hooks/useTasks'
import type { GroupPreset } from '../taskUtils'
import { tourAnchor } from '@/components/common/tours/anchors'

interface Props {
  preset: GroupPreset
  /** KPI đang lọc (trang lọc theo KPI / tab Công việc của KPI) — dùng khi nhóm không tự biết KPI. */
  defaultKpiId?: string
  onCreated?: (taskId: string) => void
}

/**
 * Dòng "+ Thêm việc" ở cuối một nhóm: gõ tên, Enter là tạo, tự điền theo nhóm (hạn của nhóm "Hôm nay", KPI của nhóm
 * KPI, người phụ trách của nhóm người…). Chưa xác định được KPI thì hiện ô chọn KPI ngay trong dòng.
 */
export default function TaskQuickAddRow({ preset, defaultKpiId, onCreated }: Props) {
  const { t } = useTranslation('tasks')
  const [active, setActive] = useState(false)
  const [title, setTitle] = useState('')
  const [pickedKpi, setPickedKpi] = useState<string | undefined>()
  const { create } = useTaskMutations()
  const kpiId = preset.kpiId ?? defaultKpiId ?? pickedKpi
  const needsKpi = !preset.kpiId && !defaultKpiId

  const { data: kpis = [] } = useQuery({
    queryKey: ['kpi-tasks', 'assignable-kpis', preset.ownerId ?? 'me'],
    queryFn: () => taskApi.assignableKpis(preset.ownerId),
    enabled: active && needsKpi,
    staleTime: 60_000,
  })

  const submit = () => {
    const v = title.trim()
    if (!v) return
    if (!kpiId) {
      toast.error(t('quickAdd.pickKpi'))
      return
    }
    create.mutate({
      kpiId,
      title: v,
      ownerId: preset.ownerId,
      priority: preset.priority,
      dueDate: preset.dueDate ?? undefined,
    }, {
      onSuccess: (task) => {
        setTitle('')
        onCreated?.(task.id)
        // Tạo trong nhóm "Đã xong" không có nghĩa; trạng thái khác ⇒ đổi ngay sau khi tạo.
        if (preset.status && preset.status !== 'TODO') {
          taskApi.changeStatus(task.id, { status: preset.status, version: task.version }).catch(() => {})
        }
      },
      onError: (e) => toast.error(getApiErrorMessage(e)),
    })
  }

  if (!active) {
    return (
      <button {...tourAnchor('tasks.quick-add')}
        type="button"
        onClick={() => setActive(true)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-subtle-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      >
        <Plus size={15} /> {t('quickAdd.label')}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-3 py-1.5">
      <Plus size={15} className="text-[var(--color-subtle-foreground)]" />
      {/* Ô nhập trong dòng danh sách — ngoại lệ có chủ đích của quy ước Input (giống ô sửa trong ô bảng). */}
      <input
        autoFocus
        value={title}
        maxLength={255}
        disabled={create.isPending}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); submit() }
          if (e.key === 'Escape') { setActive(false); setTitle('') }
        }}
        /* Dòng cần chọn KPI thì không tự đóng khi mất focus (bấm vào ô chọn KPI là mất focus) — Esc để đóng. */
        onBlur={() => { if (!title.trim() && !needsKpi) setActive(false) }}
        placeholder={t('quickAdd.placeholder')}
        className="no-edit-hint min-w-[160px] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-[var(--color-muted-foreground)]"
      />
      {needsKpi && (
        <div className="w-64">
          <GroupedPicker size="sm" options={kpis} value={pickedKpi ?? null} onChange={(v) => setPickedKpi(v ?? undefined)}
            placeholder={t('quickAdd.kpiPlaceholder')} searchPlaceholder={t('picker.searchKpi')} collapseNonCurrent groupOrder="desc"
            moreLabel={(n) => t('picker.morePeriods', { count: n })} />
        </div>
      )}
      {create.isPending && <Loader2 size={14} className="animate-spin text-[var(--color-subtle-foreground)]" />}
    </div>
  )
}
