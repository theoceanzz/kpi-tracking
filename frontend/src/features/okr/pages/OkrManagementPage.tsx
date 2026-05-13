import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useObjectives, useOkrMutations } from '../hooks/useOkr'
import { 
  Plus, Target, ChevronDown, ChevronRight, 
  Edit2, Trash2, Calendar, 
  BarChart3, PlusCircle, CheckCircle2, Clock, FileUp
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { OkrStatus, ObjectiveResponse, KeyResultResponse } from '../types'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import PageTour from '@/components/common/PageTour'
import { okrManagementSteps } from '@/components/common/tourSteps'
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
  const [targetObjectiveId, setTargetObjectiveId] = useState<string>('')
  
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

  const handleAddKeyResult = (objectiveId: string) => {
    setTargetObjectiveId(objectiveId)
    setSelectedKeyResult(undefined)
    setIsKeyResultModalOpen(true)
  }

  const handleEditKeyResult = (objectiveId: string, kr: KeyResultResponse) => {
    setTargetObjectiveId(objectiveId)
    setSelectedKeyResult(kr)
    setIsKeyResultModalOpen(true)
  }

  const handleDeleteKeyResult = (id: string) => {
    setDeleteTarget({ id, type: 'keyResult' })
  }

  if (isLoading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <PageTour pageKey="okr-management" steps={okrManagementSteps} />
      
      <div id="tour-okr-header" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Target className="text-indigo-600" size={32} />
            Quản lý OKR
          </h1>
          <p className="text-slate-500 font-medium mt-1">Thiết lập mục tiêu chiến lược và đo lường kết quả then chốt</p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="file" 
            className="hidden" 
            id="okr-import" 
            ref={fileInputRef}
            accept=".xlsx"
            onChange={handleImport}
          />
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <FileUp size={20} />
            Import Excel
          </button>
          <button 
            id="tour-okr-add-btn" 
            onClick={handleAddObjective}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
          >
            <Plus size={20} />
            Mục tiêu mới
          </button>
        </div>
      </div>

      <div id="tour-okr-list" className="grid gap-6">
        {objectives?.map(objective => (
          <ObjectiveCard 
            key={objective.id} 
            objective={objective} 
            isExpanded={!!expandedObjectives[objective.id]}
            onToggle={() => toggleObjective(objective.id)}
            onEdit={() => handleEditObjective(objective)}
            onDelete={() => handleDeleteObjective(objective.id)}
            onAddKR={() => handleAddKeyResult(objective.id)}
            onEditKR={(kr) => handleEditKeyResult(objective.id, kr)}
            onDeleteKR={(krId) => handleDeleteKeyResult(krId)}
          />
        ))}

        {(!objectives || objectives.length === 0) && (
          <div className="flex flex-col items-center justify-center p-20 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 mb-4">
              <Target size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Chưa có mục tiêu nào</h3>
            <p className="text-slate-500 max-w-sm mt-2">Hãy bắt đầu bằng cách tạo mục tiêu chiến lược đầu tiên cho tổ chức của bạn.</p>
          </div>
        )}
      </div>

      <ObjectiveFormModal 
        isOpen={isObjectiveModalOpen}
        onClose={() => setIsObjectiveModalOpen(false)}
        organizationId={organizationId || ''}
        objective={selectedObjective}
      />

      <KeyResultFormModal 
        isOpen={isKeyResultModalOpen}
        onClose={() => setIsKeyResultModalOpen(false)}
        objectiveId={targetObjectiveId}
        keyResult={selectedKeyResult}
      />

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
  if (progress < 30) return 'text-rose-500'
  if (progress < 70) return 'text-amber-500'
  if (progress < 100) return 'text-emerald-500'
  return 'text-blue-600 dark:text-blue-500'
}

const getProgressBgColor = (progress: number) => {
  if (progress < 30) return 'bg-rose-500'
  if (progress < 70) return 'bg-amber-500'
  if (progress < 100) return 'bg-emerald-500'
  return 'bg-blue-600'
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
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-all hover:shadow-xl hover:shadow-indigo-500/5 group">
      <div className="p-6 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start gap-4">
          <div className="mt-1">
            {isExpanded ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronRight size={20} className="text-slate-400" />}
          </div>
          
          <div className="flex-1 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider",
                    objective.status === OkrStatus.ACTIVE ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-slate-100 text-slate-600"
                  )}>
                    {objective.status === OkrStatus.ACTIVE ? 'Đang thực hiện' : objective.status === OkrStatus.COMPLETED ? 'Hoàn thành' : 'Hủy bỏ'}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-tight">
                    <Calendar size={12} />
                    {objective.startDate ? format(new Date(objective.startDate), 'dd/MM/yyyy', { locale: vi }) : 'N/A'}
                    {' - '}
                    {objective.endDate ? format(new Date(objective.endDate), 'dd/MM/yyyy', { locale: vi }) : 'N/A'}
                  </div>
                  {objective.orgUnitName && (
                    <div className="flex items-center gap-1.5 text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-lg w-fit">
                      <PlusCircle size={12} className="rotate-45" />
                      {objective.orgUnitName}
                    </div>
                  )}
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                  {objective.code && <span className="text-indigo-600 dark:text-indigo-400 mr-2">[{objective.code}]</span>}
                  {objective.name}
                </h3>
                {objective.description && <p className="text-sm text-slate-500 line-clamp-1">{objective.description}</p>}
              </div>

              <div className="flex items-center gap-6 shrink-0">
                <div className="text-right space-y-1">
                  <div className={cn("flex items-center justify-end gap-2 text-sm font-black", getProgressColor(overallProgress))}>
                    <BarChart3 size={16} className="opacity-80" />
                    {Math.round(overallProgress)}%
                  </div>
                  <div className="w-32 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full transition-all duration-1000", getProgressBgColor(overallProgress))} 
                      style={{ width: `${overallProgress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button 
                    onClick={(e) => { e.stopPropagation(); onEdit() }}
                    className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDelete() }}
                    className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-6 pb-6 pt-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 animate-in slide-in-from-top-2 duration-300">
          <div className="ml-9 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Các kết quả then chốt (Key Results)</h4>
              <button 
                onClick={onAddKR}
                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                <PlusCircle size={14} />
                Thêm KR
              </button>
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
                <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center">
                  <p className="text-xs font-bold text-slate-400 uppercase">Chưa có kết quả then chốt nào</p>
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
    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-indigo-200 dark:hover:border-indigo-800">
      <div className="flex items-start gap-4 flex-1">
        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
          <CheckCircle2 size={16} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {kr.code && <span className="text-emerald-600 dark:text-emerald-400 mr-2">[{kr.code}]</span>}
            {kr.name}
          </p>
          <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {kr.periodName && (
              <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                <Clock size={10} /> {kr.periodName}
              </span>
            )}
            <span>Mục tiêu: {kr.targetValue} {kr.unit}</span>
            <span>Hiện tại: {kr.currentValue} {kr.unit}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          <span className={cn("text-sm font-black", getProgressColor(kr.progress))}>{Math.round(kr.progress)}%</span>
          <div className="w-24 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
            <div 
              className={cn("h-full rounded-full transition-all duration-1000", getProgressBgColor(kr.progress))} 
              style={{ width: `${kr.progress}%` }}
            />
          </div>
        </div>
        <div className="flex items-center">
          <button onClick={onEdit} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
            <Edit2 size={16} />
          </button>
          <button onClick={onDelete} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
