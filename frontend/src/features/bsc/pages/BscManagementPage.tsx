import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useBscPerspectives, useBscMutations, useScorecards, useScorecardMutations } from '../hooks/useBsc'
import { useSidebarSettings } from '@/features/organization/hooks/useSidebarSettings'
import { Plus, Layers, Edit2, Trash2, GripVertical, FileUp, LayoutGrid, Calendar, BarChart3, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PerspectiveResponse, BscPerspectiveStatus, ScorecardResponse, BscScorecardStatus, BscScoringMode } from '../types'
import PerspectiveFormModal from '../components/PerspectiveFormModal'
import ScorecardFormModal from '../components/ScorecardFormModal'
import ImportBscGuideModal from '../components/ImportBscGuideModal'
import BscExcelPreviewModal from '../components/BscExcelPreviewModal'
import ImportScorecardGuideModal from '../components/ImportScorecardGuideModal'
import ScorecardExcelPreviewModal from '../components/ScorecardExcelPreviewModal'
import ConfirmDialog from '@/components/common/ConfirmDialog'

type Tab = 'perspectives' | 'scorecards'

export default function BscManagementPage() {
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: perspectives, isLoading } = useBscPerspectives(organizationId)
  const { data: scorecards } = useScorecards(organizationId)
  const { deletePerspective, importPerspectives } = useBscMutations()
  const { deleteScorecard, importScorecards } = useScorecardMutations()

  const { data: customLabels = {} } = useSidebarSettings(organizationId!)
  const pageTitle = (customLabels as Record<string, string>)['/bsc'] || 'Thẻ điểm cân bằng (BSC)'

  const [tab, setTab] = useState<Tab>('perspectives')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selected, setSelected] = useState<PerspectiveResponse | undefined>()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isImportGuideOpen, setIsImportGuideOpen] = useState(false)
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isScorecardModalOpen, setIsScorecardModalOpen] = useState(false)
  const [selectedScorecard, setSelectedScorecard] = useState<ScorecardResponse | undefined>()
  const [deleteScorecardId, setDeleteScorecardId] = useState<string | null>(null)
  const [isScorecardImportGuideOpen, setIsScorecardImportGuideOpen] = useState(false)
  const [scorecardPreviewFile, setScorecardPreviewFile] = useState<File | null>(null)
  const scorecardFileInputRef = useRef<HTMLInputElement>(null)

  const handleScorecardFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setScorecardPreviewFile(file)
    if (scorecardFileInputRef.current) scorecardFileInputRef.current.value = ''
  }

  const handleConfirmScorecardImport = (file: File) => {
    if (organizationId) importScorecards.mutate({ organizationId, file }, { onSuccess: () => setScorecardPreviewFile(null) })
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setPreviewFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleConfirmImport = (file: File) => {
    if (organizationId) importPerspectives.mutate({ organizationId, file }, { onSuccess: () => setPreviewFile(null) })
  }

  if (isLoading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Layers className="text-indigo-600" size={32} />
            {pageTitle}
          </h1>
          <p className="text-slate-500 font-medium mt-1">Cấu hình viễn cảnh chiến lược & thẻ điểm cân bằng</p>
        </div>
        <div className="flex items-center gap-3">
          {tab === 'perspectives' ? (
            <>
              <input type="file" className="hidden" ref={fileInputRef} accept=".xlsx" onChange={handleFileSelect} />
              <button onClick={() => setIsImportGuideOpen(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95">
                <FileUp size={20} /> Import
              </button>
              <button onClick={() => { setSelected(undefined); setIsModalOpen(true) }}
                className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all active:scale-95">
                <Plus size={20} /> Viễn cảnh mới
              </button>
            </>
          ) : (
            <>
              <input type="file" className="hidden" ref={scorecardFileInputRef} accept=".xlsx" onChange={handleScorecardFileSelect} />
              <button onClick={() => setIsScorecardImportGuideOpen(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95">
                <FileUp size={20} /> Import
              </button>
              <button onClick={() => { setSelectedScorecard(undefined); setIsScorecardModalOpen(true) }}
                className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all active:scale-95">
                <Plus size={20} /> Thẻ điểm mới
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/50 w-fit">
        <button onClick={() => setTab('perspectives')}
          className={cn('flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all', tab === 'perspectives' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          <Layers size={16} /> Viễn cảnh
        </button>
        <button onClick={() => setTab('scorecards')}
          className={cn('flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all', tab === 'scorecards' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
          <LayoutGrid size={16} /> Thẻ điểm
        </button>
      </div>

      {tab === 'perspectives' && (
        <div className="grid gap-3">
          {perspectives?.map(p => (
            <div key={p.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4 transition-all hover:shadow-lg hover:shadow-indigo-500/5">
              <GripVertical size={18} className="text-slate-300 shrink-0" />
              <div className="w-3 h-10 rounded-full shrink-0" style={{ backgroundColor: p.color || '#94a3b8' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-md uppercase">{p.code}</span>
                  {p.status === BscPerspectiveStatus.INACTIVE && <span className="text-[10px] font-black text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md uppercase">Tạm ẩn</span>}
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">{p.name}</h3>
                {p.description && <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{p.description}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => { setSelected(p); setIsModalOpen(true) }} className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all"><Edit2 size={18} /></button>
                <button onClick={() => setDeleteId(p.id)} className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"><Trash2 size={18} /></button>
              </div>
            </div>
          ))}
          {(!perspectives || perspectives.length === 0) && (
            <div className="flex flex-col items-center justify-center p-20 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center">
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 mb-4"><Layers size={32} /></div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Chưa có viễn cảnh nào</h3>
              <p className="text-slate-500 max-w-sm mt-2">Hãy tạo các viễn cảnh BSC (Tài chính, Khách hàng, Quy trình nội bộ, Học hỏi & phát triển) cho tổ chức.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'scorecards' && (
        <div className="grid gap-3">
          {scorecards?.map(sc => (
            <div key={sc.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 transition-all hover:shadow-lg hover:shadow-indigo-500/5">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-md uppercase',
                      sc.status === BscScorecardStatus.ACTIVE ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : sc.status === BscScorecardStatus.ARCHIVED ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>
                      {sc.status === BscScorecardStatus.ACTIVE ? 'Đang áp dụng' : sc.status === BscScorecardStatus.ARCHIVED ? 'Lưu trữ' : 'Nháp'}
                    </span>
                    <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-md uppercase',
                      sc.scoringMode === BscScoringMode.OFFICIAL ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-slate-100 text-slate-500')}>
                      {sc.scoringMode === BscScoringMode.OFFICIAL ? 'Chính thức' : 'Chạy song song'}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase"><Calendar size={11} /> {sc.kpiPeriodName}</span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white mt-1.5">{sc.name}</h3>
                  {sc.vision && <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 italic">"{sc.vision}"</p>}
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    {sc.perspectives.map(p => (
                      <span key={p.id} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border"
                        style={{ color: p.color || '#8b5cf6', borderColor: `${p.color || '#8b5cf6'}44`, backgroundColor: `${p.color || '#8b5cf6'}12` }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color || '#8b5cf6' }} />
                        {p.name} <b>{p.weightPercentage}%</b>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Link to={`/bsc/dashboard?scorecard=${sc.id}`} className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all" title="Xem dashboard"><BarChart3 size={18} /></Link>
                  <button onClick={() => { setSelectedScorecard(sc); setIsScorecardModalOpen(true) }} className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all"><Edit2 size={18} /></button>
                  <button onClick={() => setDeleteScorecardId(sc.id)} className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"><Trash2 size={18} /></button>
                </div>
              </div>
            </div>
          ))}
          {(!scorecards || scorecards.length === 0) && (
            <div className="flex flex-col items-center justify-center p-20 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center">
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 mb-4"><Target size={32} /></div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Chưa có thẻ điểm nào</h3>
              <p className="text-slate-500 max-w-sm mt-2">Tạo thẻ điểm cho một kỳ, gán trọng số cho các viễn cảnh (tổng 100%) để theo dõi dashboard cân bằng.</p>
            </div>
          )}
        </div>
      )}

      <PerspectiveFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} organizationId={organizationId || ''} perspective={selected} />
      <ScorecardFormModal isOpen={isScorecardModalOpen} onClose={() => setIsScorecardModalOpen(false)} organizationId={organizationId || ''} scorecard={selectedScorecard} />

      <ImportBscGuideModal open={isImportGuideOpen} onClose={() => setIsImportGuideOpen(false)} onSelectFile={() => fileInputRef.current?.click()} />
      <BscExcelPreviewModal open={!!previewFile} file={previewFile} onClose={() => setPreviewFile(null)} onImport={handleConfirmImport} isImporting={importPerspectives.isPending} />

      <ImportScorecardGuideModal open={isScorecardImportGuideOpen} onClose={() => setIsScorecardImportGuideOpen(false)} onSelectFile={() => scorecardFileInputRef.current?.click()} />
      <ScorecardExcelPreviewModal open={!!scorecardPreviewFile} file={scorecardPreviewFile} onClose={() => setScorecardPreviewFile(null)} onImport={handleConfirmScorecardImport} isImporting={importScorecards.isPending} />

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deletePerspective.mutate(deleteId); setDeleteId(null) }}
        title="Xóa viễn cảnh" description="Bạn có chắc chắn muốn xóa viễn cảnh này? Các KPI đang gán vào viễn cảnh sẽ được gỡ liên kết."
        confirmLabel="Xóa" loading={deletePerspective.isPending} />

      <ConfirmDialog open={!!deleteScorecardId} onClose={() => setDeleteScorecardId(null)}
        onConfirm={() => { if (deleteScorecardId) deleteScorecard.mutate(deleteScorecardId); setDeleteScorecardId(null) }}
        title="Xóa thẻ điểm" description="Bạn có chắc chắn muốn xóa thẻ điểm này?"
        confirmLabel="Xóa" loading={deleteScorecard.isPending} />
    </div>
  )
}
