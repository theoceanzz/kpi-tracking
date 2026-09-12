import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useObjectives, useOkrMutations } from '../hooks/useOkr'
import { useNavLabels } from '@/features/organization/hooks/useNavLabels'
import { findNavItem } from '@/config/navigation'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/common/EmptyState'
import {
  Plus, Target, ChevronDown, ChevronRight,
  Edit2, Trash2, Calendar,
  BarChart3, PlusCircle, CheckCircle2, Clock, FileUp
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { OkrStatus, ObjectiveResponse, KeyResultResponse } from '../types'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import ObjectiveFormModal from '../components/ObjectiveFormModal'
import KeyResultFormModal from '../components/KeyResultFormModal'
import ImportOkrGuideModal from '../components/ImportOkrGuideModal'
import OkrExcelPreviewModal from '../components/OkrExcelPreviewModal'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useRef } from 'react'



export default function OkrManagementPage() {
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: objectives, isLoading } = useObjectives(organizationId)
  const { deleteObjective, deleteKeyResult, importOkrs } = useOkrMutations()

  // Lấy nhãn qua `useNavLabels` như breadcrumb và hàng tab cấp 1, thay vì tự tra
  // `useSidebarSettings` bằng khoá '/okr' — trước đây đổi tên mục trong cấu hình
  // điều hướng thì ba chỗ này hiện ba tên khác nhau.
  const { labelOf } = useNavLabels()
  const okrNavItem = findNavItem('okr')
  const pageTitle = okrNavItem ? labelOf(okrNavItem) : 'Quản lý OKR'


  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [previewFile, setPreviewFile] = useState<File | null>(null)

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && organizationId) {
      setPreviewFile(file)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleConfirmImport = (file: File) => {
    if (organizationId) {
      importOkrs.mutate(
        { organizationId, file },
        {
          onSuccess: () => {
            setPreviewFile(null)
            setIsImportModalOpen(false) // optional: close guide modal too if open
          }
        }
      )
    }
  }

  const [expandedObjectives, setExpandedObjectives] = useState<Record<string, boolean>>({})

  // Modal states
  const [isObjectiveModalOpen, setIsObjectiveModalOpen] = useState(false)
  const [selectedObjective, setSelectedObjective] = useState<ObjectiveResponse | undefined>()

  const [isKeyResultModalOpen, setIsKeyResultModalOpen] = useState(false)
  const [selectedKeyResult, setSelectedKeyResult] = useState<KeyResultResponse | undefined>()
  const [targetObjective, setTargetObjective] = useState<ObjectiveResponse | undefined>()

  const [deleteTarget, setDeleteTarget] = useState<{ id: string, type: 'objective' | 'keyResult' } | null>(null)

  const toggleObjective = (id: string) => {
    setExpandedObjectives(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleAddObjective = () => {
    setSelectedObjective(undefined)
    setIsObjectiveModalOpen(true)
  }

  const handleEditObjective = (obj: ObjectiveResponse) => {
    setSelectedObjective(obj)
    setIsObjectiveModalOpen(true)
  }

  const handleDeleteObjective = (id: string) => {
    setDeleteTarget({ id, type: 'objective' })
  }

  const handleAddKeyResult = (objective: ObjectiveResponse) => {
    setTargetObjective(objective)
    setSelectedKeyResult(undefined)
    setIsKeyResultModalOpen(true)
  }

  const handleEditKeyResult = (objective: ObjectiveResponse, kr: KeyResultResponse) => {
    setTargetObjective(objective)
    setSelectedKeyResult(kr)
    setIsKeyResultModalOpen(true)
  }

  const handleDeleteKeyResult = (id: string) => {
    setDeleteTarget({ id, type: 'keyResult' })
  }

  if (isLoading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]"></div></div>

  return (
    <div className="space-y-5">

      <WorkspaceHeader
        id="tour-okr-header"
        title={pageTitle}
        description="Thiết lập mục tiêu chiến lược và đo lường kết quả then chốt."
        actions={
          /* Mobile: 2 nút chia đôi bề ngang, không tràn/đè; desktop giữ nguyên */
          <div className="flex flex-1 items-center gap-3">
            <input
              type="file"
              className="hidden"
              id="okr-import"
              ref={fileInputRef}
              accept=".xlsx"
              onChange={handleImport}
            />
            <Button variant="outline" className="flex-1 md:flex-none" onClick={() => setIsImportModalOpen(true)}>
              <FileUp aria-hidden="true" /> Nhập Excel
            </Button>
            <Button id="tour-okr-add-btn" className="flex-1 md:flex-none" onClick={handleAddObjective}>
              <Plus aria-hidden="true" /> Mục tiêu mới
            </Button>
          </div>
        }
      />

      <div id="tour-okr-list" className="grid gap-4">
        {objectives?.map(objective => (
          <ObjectiveCard
            key={objective.id}
            objective={objective}
            isExpanded={!!expandedObjectives[objective.id]}
            onToggle={() => toggleObjective(objective.id)}
            onEdit={() => handleEditObjective(objective)}
            onDelete={() => handleDeleteObjective(objective.id)}
            onAddKR={() => handleAddKeyResult(objective)}
            onEditKR={(kr) => handleEditKeyResult(objective, kr)}
            onDeleteKR={(krId) => handleDeleteKeyResult(krId)}
          />
        ))}

        {(!objectives || objectives.length === 0) && (
          <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
            <EmptyState
              icon={Target}
              title="Chưa có mục tiêu nào"
              description="Tạo mục tiêu chiến lược đầu tiên, rồi thêm các kết quả then chốt và gắn KPI vào từng kết quả."
              action={<Button onClick={handleAddObjective}><Plus aria-hidden="true" /> Mục tiêu mới</Button>}
            />
          </div>
        )}
      </div>

      <ObjectiveFormModal
        isOpen={isObjectiveModalOpen}
        onClose={() => setIsObjectiveModalOpen(false)}
        organizationId={organizationId || ''}
        objective={selectedObjective}
      />

      {targetObjective && (
        <KeyResultFormModal
          isOpen={isKeyResultModalOpen}
          onClose={() => setIsKeyResultModalOpen(false)}
          objective={targetObjective}
          keyResult={selectedKeyResult}
        />
      )}

      <ImportOkrGuideModal
        open={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSelectFile={() => fileInputRef.current?.click()}
      />

      <OkrExcelPreviewModal
        open={!!previewFile}
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onImport={handleConfirmImport}
        isImporting={importOkrs.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          if (deleteTarget.type === 'objective') {
            deleteObjective.mutate(deleteTarget.id)
          } else {
            deleteKeyResult.mutate(deleteTarget.id)
          }
          setDeleteTarget(null)
        }}
        title={deleteTarget?.type === 'objective' ? 'Xóa Mục tiêu' : 'Xóa Kết quả then chốt'}
        description={deleteTarget?.type === 'objective'
          ? 'Bạn có chắc chắn muốn xóa mục tiêu này? Tất cả các kết quả then chốt liên quan cũng sẽ bị xóa.'
          : 'Bạn có chắc chắn muốn xóa kết quả then chốt này?'}
        confirmLabel="Xóa"
        loading={deleteObjective.isPending || deleteKeyResult.isPending}
      />
    </div>
  )
}

const getProgressColor = (progress: number) => {
  if (progress < 30) return 'text-[var(--color-error)]'
  if (progress < 70) return 'text-[var(--color-warning)]'
  if (progress < 100) return 'text-[var(--color-success)]'
  return 'text-[var(--color-info)]'
}

const getProgressBgColor = (progress: number) => {
  if (progress < 30) return 'bg-[var(--color-error-solid)]'
  if (progress < 70) return 'bg-[var(--color-warning-solid)]'
  if (progress < 100) return 'bg-[var(--color-success-solid)]'
  return 'bg-[var(--color-info-solid)]'
}

interface ObjectiveCardProps {
  objective: ObjectiveResponse
  isExpanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onAddKR: () => void
  onEditKR: (kr: KeyResultResponse) => void
  onDeleteKR: (krId: string) => void
}

function ObjectiveCard({ objective, isExpanded, onToggle, onEdit, onDelete, onAddKR, onEditKR, onDeleteKR }: ObjectiveCardProps) {
  const overallProgress = objective.keyResults.length > 0
    ? objective.keyResults.reduce((acc, kr) => acc + kr.progress, 0) / objective.keyResults.length
    : 0

  return (
    <div className="bg-[var(--color-card)] rounded-widget border border-[var(--color-border)] overflow-hidden transition-all group">
      <div className="p-4 md:p-6 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start gap-3 md:gap-4">
          <div className="mt-1 shrink-0">
            {isExpanded ? <ChevronDown size={20} className="text-[var(--color-subtle-foreground)]" /> : <ChevronRight size={20} className="text-[var(--color-subtle-foreground)]" />}
          </div>

          <div className="flex-1 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn(
                    "text-eyebrow px-2 py-0.5 rounded-control whitespace-nowrap",
                    objective.status === OkrStatus.ACTIVE ? "bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)] dark:text-[var(--color-success)]" : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"
                  )}>
                    {objective.status === OkrStatus.ACTIVE ? 'Đang thực hiện' : objective.status === OkrStatus.COMPLETED ? 'Hoàn thành' : 'Hủy bỏ'}
                  </span>
                  {objective.perspectiveName && (
                    <span
                      className="text-eyebrow inline-flex items-center gap-1 px-2 py-0.5 rounded-control whitespace-nowrap"
                      style={{ color: objective.perspectiveColor || '#8b5cf6', backgroundColor: `${objective.perspectiveColor || '#8b5cf6'}1a` }}
                      title={`Hạng mục BSC: ${objective.perspectiveName}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: objective.perspectiveColor || '#8b5cf6' }} />
                      {objective.perspectiveName}
                    </span>
                  )}
                  <div className="flex items-center gap-1 text-eyebrow tracking-tight">
                    <Calendar size={11} />
                    {objective.startDate ? format(new Date(objective.startDate), 'dd/MM/yyyy', { locale: vi }) : 'N/A'}
                    {' - '}
                    {objective.endDate ? format(new Date(objective.endDate), 'dd/MM/yyyy', { locale: vi }) : 'N/A'}
                  </div>
                </div>
                {objective.orgUnitNames && objective.orgUnitNames.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    {objective.orgUnitNames.slice(0, 5).map((name, idx) => (
                      <div key={idx} className="flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary-soft)] px-2 py-0.5 rounded-control whitespace-nowrap">
                        <PlusCircle size={11} className="rotate-45" />
                        {name}
                      </div>
                    ))}
                    {objective.orgUnitNames.length > 5 && (
                      <div className="text-caption bg-[var(--color-muted)] px-2 py-0.5 rounded-control">
                        +{objective.orgUnitNames.length - 5}
                      </div>
                    )}
                  </div>
                )}
                <h3 className="text-section-title">
                  {objective.code && <span className="text-[var(--color-primary)] mr-1">[{objective.code}]</span>}
                  {objective.name}
                </h3>
                {objective.description && <p className="text-xs md:text-sm text-[var(--color-muted-foreground)] line-clamp-1">{objective.description}</p>}
                {/* Progress bar — mobile only (below title) */}
                <div className="flex items-center gap-2 md:hidden pt-1">
                  <div className="flex-1 h-1.5 bg-[var(--color-muted)] rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-1000", getProgressBgColor(overallProgress))} style={{ width: `${overallProgress}%` }} />
                  </div>
                  <span className={cn("text-xs font-semibold shrink-0", getProgressColor(overallProgress))}>{Math.round(overallProgress)}%</span>
                </div>
              </div>

              {/* Right side — desktop only */}
              <div className="hidden md:flex items-center gap-6 shrink-0">
                <div className="text-right space-y-1">
                  <div className={cn("flex items-center justify-end gap-2 text-sm font-semibold", getProgressColor(overallProgress))}>
                    <BarChart3 size={16} className="opacity-80" />
                    {Math.round(overallProgress)}%
                  </div>
                  <div className="w-32 h-1.5 bg-[var(--color-muted)] rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-1000", getProgressBgColor(overallProgress))} style={{ width: `${overallProgress}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); onEdit() }} aria-label="Sửa mục tiêu" title="Sửa"><Edit2 aria-hidden="true" /></Button>
                  <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); onDelete() }} aria-label="Xoá mục tiêu" title="Xoá" className="text-[var(--color-muted-foreground)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]"><Trash2 aria-hidden="true" /></Button>
                </div>
              </div>
              {/* Buttons — mobile only: hàng riêng cuối thẻ (trước đây absolute nên đè lên badge/tiêu đề).
                  Sửa & Xoá có nhãn, cao 44px và cách nhau 12px để không bấm nhầm. */}
              <div className="md:hidden flex items-center justify-end gap-3 pt-3 border-t border-[var(--color-border)]">
                <Button variant="outline" onClick={(e) => { e.stopPropagation(); onEdit() }}><Edit2 aria-hidden="true" /> Sửa</Button>
                <Button variant="outline" onClick={(e) => { e.stopPropagation(); onDelete() }} className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]"><Trash2 aria-hidden="true" /> Xoá</Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 md:px-6 pb-4 md:pb-6 pt-2 border-t border-[var(--color-border)] bg-[var(--color-muted)] animate-in slide-in-from-top-2 duration-300">
          <div className="ml-0 md:ml-9 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-eyebrow">Kết quả then chốt</h4>
              <Button variant="ghost" size="sm" onClick={onAddKR} className="text-[var(--color-primary)] hover:text-[var(--color-primary)]">
                <PlusCircle aria-hidden="true" /> Thêm kết quả
              </Button>
            </div>

            <div className="grid gap-3">
              {objective.keyResults.map(kr => (
                <KeyResultRow
                  key={kr.id}
                  kr={kr}
                  onEdit={() => onEditKR(kr)}
                  onDelete={() => onDeleteKR(kr.id)}
                />
              ))}

              {objective.keyResults.length === 0 && (
                <div className="rounded-card border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm text-[var(--color-muted-foreground)]">
                  Chưa có kết quả then chốt nào. Thêm ít nhất một kết quả để đo được tiến độ mục tiêu.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface KeyResultRowProps {
  kr: KeyResultResponse
  onEdit: () => void
  onDelete: () => void
}

function KeyResultRow({ kr, onEdit, onDelete }: KeyResultRowProps) {
  return (
    <div className="bg-[var(--color-card)] p-4 rounded-card border border-[var(--color-border)] flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 transition-all hover:border-[var(--color-border)]">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-card bg-[var(--color-primary-soft)] flex items-center justify-center text-[var(--color-primary)] shrink-0 mt-0.5">
          <CheckCircle2 size={16} />
        </div>
        <div className="space-y-1.5 min-w-0">
          <p className="text-sm font-medium text-[var(--color-foreground)]">
            {kr.code && <span className="text-[var(--color-success)] mr-1">[{kr.code}]</span>}
            {kr.name}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-caption tabular-nums">
            {kr.periodName && (
              <span className="flex items-center gap-1 text-[var(--color-primary)]">
                <Clock size={10} /> {kr.periodName}
              </span>
            )}
            <span>Mục tiêu: {kr.targetValue} {kr.unit}</span>
            <span>Hiện tại: {kr.currentValue} {kr.unit}</span>
          </div>
          {kr.unitWeights && kr.unitWeights.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {kr.unitWeights.map((uw, idx) => (
                <div key={idx} className="flex items-center gap-1 text-caption bg-[var(--color-muted)] px-2 py-0.5 rounded-control whitespace-nowrap">
                  {uw.orgUnitName}
                  <span className="text-[var(--color-primary)] font-semibold">{uw.weightPercentage}%</span>
                </div>
              ))}
            </div>
          )}
          {/* Progress — mobile only (nút bấm tách sang hàng riêng bên dưới) */}
          <div className="flex items-center gap-2 md:hidden pt-0.5">
            <div className="flex-1 h-1 bg-[var(--color-muted)] rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-1000", getProgressBgColor(kr.progress))} style={{ width: `${kr.progress}%` }} />
            </div>
            <span className={cn("text-xs font-semibold shrink-0", getProgressColor(kr.progress))}>{Math.round(kr.progress)}%</span>
          </div>
        </div>
      </div>

      {/* Buttons — mobile only: hàng riêng, 44px và cách nhau 12px */}
      <div className="md:hidden flex items-center justify-end gap-3 pt-3 border-t border-[var(--color-border)]">
        <Button variant="outline" onClick={onEdit}><Edit2 aria-hidden="true" /> Sửa</Button>
        <Button variant="outline" onClick={onDelete} className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]"><Trash2 aria-hidden="true" /> Xoá</Button>
      </div>

      {/* Right side — desktop only */}
      <div className="hidden md:flex items-center gap-4 shrink-0">
        <div className="text-right">
          <span className={cn("text-sm font-semibold", getProgressColor(kr.progress))}>{Math.round(kr.progress)}%</span>
          <div className="w-24 h-1 bg-[var(--color-muted)] rounded-full mt-1 overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-1000", getProgressBgColor(kr.progress))} style={{ width: `${kr.progress}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label="Sửa kết quả" title="Sửa"><Edit2 aria-hidden="true" /></Button>
          <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Xoá kết quả" title="Xoá" className="text-[var(--color-muted-foreground)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]"><Trash2 aria-hidden="true" /></Button>
        </div>
      </div>
    </div>
  )
}
