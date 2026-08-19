import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useBscPerspectives, useBscMutations, useScorecards, useScorecardMutations, useFixedPerspectives } from '../hooks/useBsc'
import { Plus, Edit2, Trash2, GripVertical, FileUp, Calendar, BarChart3, Target, ShieldCheck, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import { usePermission } from '@/hooks/usePermission'
import { PerspectiveResponse, BscPerspectiveStatus, ScorecardResponse, BscScorecardStatus, BscScoringMode, FixedPerspectiveResponse } from '../types'
import PerspectiveFormModal from '../components/PerspectiveFormModal'
import FixedPerspectiveFormModal from '../components/FixedPerspectiveFormModal'
import ScorecardFormModal from '../components/ScorecardFormModal'
import ImportBscGuideModal from '../components/ImportBscGuideModal'
import BscExcelPreviewModal from '../components/BscExcelPreviewModal'
import ImportScorecardGuideModal from '../components/ImportScorecardGuideModal'
import ScorecardExcelPreviewModal from '../components/ScorecardExcelPreviewModal'
import ConfirmDialog from '@/components/common/ConfirmDialog'

export type BscManagementView = 'perspectives' | 'scorecards'

/**
 * `view` do `BscWorkspace` truyền xuống chứ không còn là state nội bộ: "Hạng mục" và
 * "Thẻ điểm" đã được nâng lên ngang hàng với Dashboard và Bản đồ chiến lược. Trước đây
 * chúng là tầng tab thứ ba, và nhãn "Thẻ điểm" xuất hiện ở cả hai tầng nên không đoán
 * được bấm cái nào ra cái gì.
 */
export default function BscManagementPage({ view }: { view: BscManagementView }) {
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: perspectives, isLoading } = useBscPerspectives(organizationId)
  const { data: fixedPerspectives } = useFixedPerspectives()
  const { data: scorecards } = useScorecards(organizationId)
  const { deletePerspective, importPerspectives } = useBscMutations()
  const { deleteScorecard, importScorecards, updateScoringMode } = useScorecardMutations()
  const { hasPermission } = usePermission()
  const canPublish = hasPermission('BSC:PUBLISH_SCORE')
  const canManage = hasPermission('BSC:MANAGE')

  const tab = view
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selected, setSelected] = useState<PerspectiveResponse | undefined>()
  const [editingFixed, setEditingFixed] = useState<FixedPerspectiveResponse | undefined>()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isImportGuideOpen, setIsImportGuideOpen] = useState(false)
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isScorecardModalOpen, setIsScorecardModalOpen] = useState(false)
  const [selectedScorecard, setSelectedScorecard] = useState<ScorecardResponse | undefined>()
  const [deleteScorecardId, setDeleteScorecardId] = useState<string | null>(null)
  const [publishTarget, setPublishTarget] = useState<ScorecardResponse | null>(null)
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

  // Không thoát sớm khi đang tải: hàng tab cấp 2 nằm trên `WorkspaceHeader`, trả về
  // riêng cái spinner sẽ làm cả hàng tab biến mất và người dùng kẹt ở tab đang mở.
  if (isLoading) {
    return (
      <div className="space-y-5">
        <WorkspaceHeader />
        <div className="p-8 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        description={
          tab === 'perspectives'
            ? 'Cấu hình hạng mục theo 4 viễn cảnh cố định của thẻ điểm cân bằng.'
            : 'Thẻ điểm cân bằng theo đơn vị và kỳ, gồm cách chấm và trạng thái công bố.'
        }
        actions={
          tab === 'perspectives' ? (
            <>
              <input type="file" className="hidden" ref={fileInputRef} accept=".xlsx" onChange={handleFileSelect} />
              <button onClick={() => setIsImportGuideOpen(true)}
                className="flex items-center gap-2 px-4 h-10 rounded-xl border border-[var(--color-border)] text-sm font-bold text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] transition-all shadow-sm active:scale-95">
                <FileUp size={16} /> Import
              </button>
              <button onClick={() => { setSelected(undefined); setIsModalOpen(true) }}
                className="flex items-center gap-2 px-5 h-10 bg-[var(--color-primary)] text-white rounded-xl text-sm font-bold hover:opacity-90 shadow-sm transition-all active:scale-95">
                <Plus size={16} /> Hạng mục mới
              </button>
            </>
          ) : (
            <>
              <input type="file" className="hidden" ref={scorecardFileInputRef} accept=".xlsx" onChange={handleScorecardFileSelect} />
              <button onClick={() => setIsScorecardImportGuideOpen(true)}
                className="flex items-center gap-2 px-4 h-10 rounded-xl border border-[var(--color-border)] text-sm font-bold text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] transition-all shadow-sm active:scale-95">
                <FileUp size={16} /> Import
              </button>
              <button onClick={() => { setSelectedScorecard(undefined); setIsScorecardModalOpen(true) }}
                className="flex items-center gap-2 px-5 h-10 bg-[var(--color-primary)] text-white rounded-xl text-sm font-bold hover:opacity-90 shadow-sm transition-all active:scale-95">
                <Plus size={16} /> Thẻ điểm mới
              </button>
            </>
          )
        }
      />

      {tab === 'perspectives' && (
        <div className="space-y-6">
          {(fixedPerspectives || []).map(fp => {
            const items = (perspectives || []).filter(p => p.fixedPerspective === fp.code)
            return (
              <div key={fp.code}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: fp.color }} />
                  <h2 className="text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-300">{fp.name}</h2>
                  <span className="text-[10px] font-bold text-slate-400">({items.length} hạng mục)</span>
                  {canManage && (
                    <button
                      onClick={() => setEditingFixed(fp)}
                      title="Chỉnh sửa viễn cảnh (tên, màu, thứ tự)"
                      className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                </div>
                <div className="grid gap-3">
                  {items.map(p => (
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
                  {items.length === 0 && (
                    <div className="text-xs text-slate-400 italic px-4 py-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">Chưa có hạng mục nào thuộc viễn cảnh này.</div>
                  )}
                </div>
              </div>
            )
          })}
          {(!perspectives || perspectives.length === 0) && (
            <p className="text-slate-500 text-sm font-medium text-center pt-2">Chưa có hạng mục nào — hãy bấm <b>"+ Hạng mục mới"</b> để thêm (VD: Công tác giảng dạy, NCKH…) và gán vào 1 trong 4 viễn cảnh.</p>
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
                    {sc.orgUnits && sc.orgUnits.length > 0 ? (
                      sc.orgUnits.map(u => (
                        <span key={u.id} className="text-[10px] font-black px-2 py-0.5 rounded-md uppercase bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                          {u.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md uppercase bg-slate-100 text-slate-500">Toàn tổ chức</span>
                    )}
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
                  {canPublish && (
                    <button
                      onClick={() => setPublishTarget(sc)}
                      className={cn('p-2 rounded-xl transition-all',
                        sc.scoringMode === BscScoringMode.SHADOW
                          ? 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                          : 'text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30')}
                      title={sc.scoringMode === BscScoringMode.SHADOW ? 'Chuyển sang chấm điểm chính thức' : 'Đưa về chạy song song'}
                    >
                      {sc.scoringMode === BscScoringMode.SHADOW ? <ShieldCheck size={18} /> : <Undo2 size={18} />}
                    </button>
                  )}
                  <Link to={`/settings/tools?section=bsc&bsc=dashboard&scorecard=${sc.id}`} className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all" title="Xem dashboard"><BarChart3 size={18} /></Link>
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
              <p className="text-slate-500 max-w-sm mt-2">Tạo thẻ điểm cho một kỳ (theo phòng ban hoặc toàn tổ chức), gán trọng số cho các hạng mục (tổng 100%) để theo dõi dashboard cân bằng.</p>
            </div>
          )}
        </div>
      )}

      <PerspectiveFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} organizationId={organizationId || ''} perspective={selected} />
      <FixedPerspectiveFormModal
        isOpen={!!editingFixed}
        onClose={() => setEditingFixed(undefined)}
        organizationId={organizationId || ''}
        fixedPerspective={editingFixed}
        usedOrders={(fixedPerspectives || []).filter(fp => fp.code !== editingFixed?.code).map(fp => fp.displayOrder)}
      />
      <ScorecardFormModal isOpen={isScorecardModalOpen} onClose={() => setIsScorecardModalOpen(false)} organizationId={organizationId || ''} scorecard={selectedScorecard} />

      <ImportBscGuideModal open={isImportGuideOpen} onClose={() => setIsImportGuideOpen(false)} onSelectFile={() => fileInputRef.current?.click()} />
      <BscExcelPreviewModal open={!!previewFile} file={previewFile} onClose={() => setPreviewFile(null)} onImport={handleConfirmImport} isImporting={importPerspectives.isPending} />

      <ImportScorecardGuideModal open={isScorecardImportGuideOpen} onClose={() => setIsScorecardImportGuideOpen(false)} onSelectFile={() => scorecardFileInputRef.current?.click()} />
      <ScorecardExcelPreviewModal open={!!scorecardPreviewFile} file={scorecardPreviewFile} onClose={() => setScorecardPreviewFile(null)} onImport={handleConfirmScorecardImport} isImporting={importScorecards.isPending} />

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deletePerspective.mutate(deleteId); setDeleteId(null) }}
        title="Xóa hạng mục" description="Bạn có chắc chắn muốn xóa hạng mục này? Các KPI đang gán vào hạng mục sẽ được gỡ liên kết."
        confirmLabel="Xóa" loading={deletePerspective.isPending} />

      <ConfirmDialog open={!!deleteScorecardId} onClose={() => setDeleteScorecardId(null)}
        onConfirm={() => { if (deleteScorecardId) deleteScorecard.mutate(deleteScorecardId); setDeleteScorecardId(null) }}
        title="Xóa thẻ điểm" description="Bạn có chắc chắn muốn xóa thẻ điểm này?"
        confirmLabel="Xóa" loading={deleteScorecard.isPending} />

      <ConfirmDialog
        open={!!publishTarget}
        onClose={() => setPublishTarget(null)}
        onConfirm={() => {
          if (publishTarget) {
            const next = publishTarget.scoringMode === BscScoringMode.SHADOW ? BscScoringMode.OFFICIAL : BscScoringMode.SHADOW
            updateScoringMode.mutate({ scorecardId: publishTarget.id, mode: next })
          }
          setPublishTarget(null)
        }}
        title={publishTarget?.scoringMode === BscScoringMode.SHADOW ? 'Chuyển sang chấm điểm chính thức' : 'Đưa về chạy song song'}
        description={publishTarget?.scoringMode === BscScoringMode.SHADOW
          ? 'Từ giờ điểm BSC sẽ là ĐIỂM CHÍNH THỨC (thay điểm hệ thống) cho các đánh giá tính/chốt sau thời điểm này. Điểm BSC đã được tính sẵn từ trước nên KHÔNG có gì phải tính lại; các đánh giá đã chốt trước đó giữ nguyên. Lưu ý: khi ở chế độ chính thức, đánh giá sẽ bị chặn nếu còn KPI chưa gán hạng mục.'
          : 'Đưa thẻ điểm về chế độ chạy song song: điểm BSC vẫn được tính & lưu để đối chiếu, nhưng điểm chính thức quay lại dùng điểm hệ thống cũ.'}
        confirmLabel={publishTarget?.scoringMode === BscScoringMode.SHADOW ? 'Chuyển chính thức' : 'Đưa về song song'}
        loading={updateScoringMode.isPending}
      />
    </div>
  )
}
