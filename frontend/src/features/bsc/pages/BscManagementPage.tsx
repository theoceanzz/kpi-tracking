import { useRef, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useBscMutations, useFixedPerspectives, useScorecards, useScorecardMutations } from '../hooks/useBsc'
import {
  Plus, Edit2, Trash2, FileUp, Calendar, Target, ShieldCheck, Undo2,
  ChevronDown, ChevronRight, PlusCircle, Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { usePermission } from '@/hooks/usePermission'
import { useNavLabels } from '@/features/organization/hooks/useNavLabels'
import { findNavItem } from '@/config/navigation'
import {
  ScorecardResponse, BscScorecardStatus, BscScoringMode, BscFixedPerspective, FixedPerspectiveResponse, BscScorecardApplyScope,
} from '../types'
import ScorecardFormModal from '../components/ScorecardFormModal'
import ImportBscGuideModal from '../components/ImportBscGuideModal'
import BscExcelPreviewModal from '../components/BscExcelPreviewModal'
import ImportScorecardGuideModal from '../components/ImportScorecardGuideModal'
import ScorecardExcelPreviewModal from '../components/ScorecardExcelPreviewModal'
import ConfirmDialog from '@/components/common/ConfirmDialog'

/**
 * BSC chỉ còn MỘT luồng: bộ tiêu chí. Hạng mục không còn màn riêng mà được tạo/sửa ngay
 * trong bộ tiêu chí chứa nó — giống OKR, nơi Key Result nằm trong Objective.
 *
 * Trước đây hai thứ này là hai tab ngang hàng, nên người dùng phải tự đoán rằng "phải
 * qua tab Hạng mục tạo trước thì tab Bộ tiêu chí mới có gì để gán trọng số". Tách đôi như
 * vậy chỉ đúng với mô hình dữ liệu (hạng mục dùng chung cho cả tổ chức), không đúng với
 * việc người dùng đang làm (dựng một bộ tiêu chí cho một kỳ).
 *
 * TỪ NGỮ: chữ hiển thị đã đổi theo phản hồi của người dùng cuối — "thẻ điểm" → **bộ tiêu chí**,
 * "viễn cảnh" → **lĩnh vực**. Tên bảng, entity, DTO và endpoint GIỮ NGUYÊN (`scorecard`,
 * `perspective`, `fixedPerspective`), nên đừng đổi theo khi đọc code.
 */
export default function BscManagementPage() {
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: scorecards, isLoading } = useScorecards(organizationId)
  const { data: fixedPerspectives } = useFixedPerspectives(organizationId)
  const { importPerspectives } = useBscMutations()
  const { deleteScorecard, importScorecards, updateScoringMode } = useScorecardMutations()
  const { hasPermission } = usePermission()
  const canPublish = hasPermission('BSC:PUBLISH_SCORE')

  const { labelOf } = useNavLabels()
  const bscNavItem = findNavItem('bsc')
  const pageTitle = bscNavItem ? labelOf(bscNavItem) : 'Quản lý BSC'

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  // `createFixed` khác undefined ⇒ mở luôn form tạo hạng mục cho lĩnh vực đó bên trong
  // modal bộ tiêu chí, để nút "Thêm hạng mục" ngoài danh sách đi thẳng tới việc cần làm.
  const [scorecardModal, setScorecardModal] = useState<
    { scorecard?: ScorecardResponse; createFixed?: BscFixedPerspective } | null
  >(null)
  const [deleteScorecardId, setDeleteScorecardId] = useState<string | null>(null)
  const [publishTarget, setPublishTarget] = useState<ScorecardResponse | null>(null)

  const [isScorecardImportGuideOpen, setIsScorecardImportGuideOpen] = useState(false)
  const [scorecardPreviewFile, setScorecardPreviewFile] = useState<File | null>(null)
  const scorecardFileInputRef = useRef<HTMLInputElement>(null)
  const [isPerspectiveImportGuideOpen, setIsPerspectiveImportGuideOpen] = useState(false)
  const [perspectivePreviewFile, setPerspectivePreviewFile] = useState<File | null>(null)
  const perspectiveFileInputRef = useRef<HTMLInputElement>(null)

  const handleScorecardFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setScorecardPreviewFile(file)
    if (scorecardFileInputRef.current) scorecardFileInputRef.current.value = ''
  }

  const handlePerspectiveFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setPerspectivePreviewFile(file)
    if (perspectiveFileInputRef.current) perspectiveFileInputRef.current.value = ''
  }

  const handleConfirmScorecardImport = (file: File) => {
    if (organizationId) importScorecards.mutate({ organizationId, file }, { onSuccess: () => setScorecardPreviewFile(null) })
  }

  const handleConfirmPerspectiveImport = (file: File) => {
    if (organizationId) importPerspectives.mutate({ organizationId, file }, { onSuccess: () => setPerspectivePreviewFile(null) })
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <WorkspaceHeader title={pageTitle} />
        <div className="p-8 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        title={pageTitle}
        description="Mỗi bộ tiêu chí gắn với một kỳ và một phạm vi đơn vị; hạng mục cùng trọng số được thêm ngay bên trong bộ tiêu chí."
        actions={
          <>
            <input type="file" className="hidden" ref={scorecardFileInputRef} accept=".xlsx" onChange={handleScorecardFileSelect} />
            <input type="file" className="hidden" ref={perspectiveFileInputRef} accept=".xlsx" onChange={handlePerspectiveFileSelect} />
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 px-4 h-10 rounded-xl border border-[var(--color-border)] text-sm font-bold text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] transition-all shadow-sm active:scale-95">
                  <FileUp size={16} /> Import
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="p-2 w-64">
                <button
                  onClick={() => setIsScorecardImportGuideOpen(true)}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <span className="block text-xs font-black text-slate-800 dark:text-slate-200">Bộ tiêu chí</span>
                  <span className="block text-[10px] font-medium text-slate-400">Bộ tiêu chí kèm trọng số từng hạng mục</span>
                </button>
                <button
                  onClick={() => setIsPerspectiveImportGuideOpen(true)}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <span className="block text-xs font-black text-slate-800 dark:text-slate-200">Hạng mục</span>
                  <span className="block text-[10px] font-medium text-slate-400">Chỉ danh mục hạng mục, chưa gán vào bộ tiêu chí</span>
                </button>
              </PopoverContent>
            </Popover>
            <button onClick={() => setScorecardModal({})}
              className="flex items-center gap-2 px-5 h-10 bg-[var(--color-primary)] text-white rounded-xl text-sm font-bold hover:opacity-90 shadow-sm transition-all active:scale-95">
              <Plus size={16} /> Bộ tiêu chí mới
            </button>
          </>
        }
      />

      <div className="grid gap-4">
        {scorecards?.map(sc => (
          <ScorecardCard
            key={sc.id}
            scorecard={sc}
            fixedPerspectives={fixedPerspectives || []}
            canPublish={canPublish}
            isExpanded={!!expanded[sc.id]}
            onToggle={() => setExpanded(prev => ({ ...prev, [sc.id]: !prev[sc.id] }))}
            onEdit={() => setScorecardModal({ scorecard: sc })}
            onDelete={() => setDeleteScorecardId(sc.id)}
            onTogglePublish={() => setPublishTarget(sc)}
            onAddPerspective={code => setScorecardModal({ scorecard: sc, createFixed: code })}
          />
        ))}

        {(!scorecards || scorecards.length === 0) && (
          <div className="flex flex-col items-center justify-center p-20 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 mb-4"><Target size={32} /></div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Chưa có bộ tiêu chí nào</h3>
            <p className="text-slate-500 max-w-md mt-2">
              Bấm <b>"+ Bộ tiêu chí mới"</b> để tạo bộ tiêu chí cho một kỳ (theo phòng ban hoặc toàn tổ chức).
              Ngay trong đó bạn thêm được hạng mục (VD: Công tác giảng dạy, NCKH…) vào 4 lĩnh vực và chia trọng số cho đủ 100%.
            </p>
          </div>
        )}
      </div>

      {scorecardModal && (
        <ScorecardFormModal
          isOpen
          onClose={() => setScorecardModal(null)}
          organizationId={organizationId || ''}
          scorecard={scorecardModal.scorecard}
          autoCreateFixed={scorecardModal.createFixed}
        />
      )}

      <ImportScorecardGuideModal open={isScorecardImportGuideOpen} onClose={() => setIsScorecardImportGuideOpen(false)} onSelectFile={() => scorecardFileInputRef.current?.click()} />
      <ScorecardExcelPreviewModal open={!!scorecardPreviewFile} file={scorecardPreviewFile} onClose={() => setScorecardPreviewFile(null)} onImport={handleConfirmScorecardImport} isImporting={importScorecards.isPending} />

      <ImportBscGuideModal open={isPerspectiveImportGuideOpen} onClose={() => setIsPerspectiveImportGuideOpen(false)} onSelectFile={() => perspectiveFileInputRef.current?.click()} />
      <BscExcelPreviewModal open={!!perspectivePreviewFile} file={perspectivePreviewFile} onClose={() => setPerspectivePreviewFile(null)} onImport={handleConfirmPerspectiveImport} isImporting={importPerspectives.isPending} />

      <ConfirmDialog open={!!deleteScorecardId} onClose={() => setDeleteScorecardId(null)}
        onConfirm={() => { if (deleteScorecardId) deleteScorecard.mutate(deleteScorecardId); setDeleteScorecardId(null) }}
        title="Xóa bộ tiêu chí" description="Bạn có chắc chắn muốn xóa bộ tiêu chí này? Các hạng mục vẫn được giữ lại để dùng cho bộ tiêu chí khác."
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
          : 'Đưa bộ tiêu chí về chế độ chạy song song: điểm BSC vẫn được tính & lưu để đối chiếu, nhưng điểm chính thức quay lại dùng điểm hệ thống cũ.'}
        confirmLabel={publishTarget?.scoringMode === BscScoringMode.SHADOW ? 'Chuyển chính thức' : 'Đưa về song song'}
        loading={updateScoringMode.isPending}
      />
    </div>
  )
}

interface ScorecardCardProps {
  scorecard: ScorecardResponse
  fixedPerspectives: FixedPerspectiveResponse[]
  canPublish: boolean
  isExpanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onTogglePublish: () => void
  onAddPerspective: (code: BscFixedPerspective) => void
}

function ScorecardCard({
  scorecard: sc, fixedPerspectives, canPublish, isExpanded,
  onToggle, onEdit, onDelete, onTogglePublish, onAddPerspective,
}: ScorecardCardProps) {
  const totalWeight = sc.perspectives.reduce((s, p) => s + (p.weightPercentage || 0), 0)
  const weightOk = Math.abs(totalWeight - 100) <= 0.01

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-all hover:shadow-xl hover:shadow-indigo-500/5">
      <div className="p-5 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start gap-3">
          <div className="mt-1 shrink-0">
            {isExpanded ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronRight size={20} className="text-slate-400" />}
          </div>
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
              <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase" title={sc.periodLabel}>
                <Calendar size={11} />
                {sc.applyScope === BscScorecardApplyScope.CYCLE ? `Kỳ: ${sc.kpiCycleName || '—'}` : (sc.periodLabel || '—')}
              </span>
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
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                {sc.perspectives.length} hạng mục
              </span>
              <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-md uppercase',
                weightOk ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                  : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400')}>
                Tổng trọng số {totalWeight.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canPublish && (
              <button
                onClick={e => { e.stopPropagation(); onTogglePublish() }}
                className={cn('p-2 rounded-xl transition-all',
                  sc.scoringMode === BscScoringMode.SHADOW
                    ? 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                    : 'text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30')}
                title={sc.scoringMode === BscScoringMode.SHADOW ? 'Chuyển sang chấm điểm chính thức' : 'Đưa về chạy song song'}
              >
                {sc.scoringMode === BscScoringMode.SHADOW ? <ShieldCheck size={18} /> : <Undo2 size={18} />}
              </button>
            )}
            <button onClick={e => { e.stopPropagation(); onEdit() }} title="Sửa bộ tiêu chí & hạng mục"
              className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all"><Edit2 size={18} /></button>
            <button onClick={e => { e.stopPropagation(); onDelete() }} title="Xoá bộ tiêu chí"
              className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"><Trash2 size={18} /></button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-5 pb-5 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 animate-in slide-in-from-top-2 duration-300">
          <div className="ml-0 md:ml-8 space-y-4">
            {fixedPerspectives.map(fp => {
              const items = sc.perspectives
                .filter(p => p.fixedPerspective === fp.code)
                .sort((a, b) => a.displayOrder - b.displayOrder)
              const groupWeight = items.reduce((s, p) => s + (p.weightPercentage || 0), 0)
              return (
                <div key={fp.code} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: fp.color }} />
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{fp.name}</h4>
                    <span className="text-[10px] font-bold text-slate-400">{groupWeight.toFixed(1)}%</span>
                    <button
                      onClick={() => onAddPerspective(fp.code)}
                      className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-xl text-[11px] font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors shrink-0"
                    >
                      <PlusCircle size={13} /> Thêm hạng mục
                    </button>
                  </div>

                  <div className="grid gap-2">
                    {items.map(p => (
                      <div key={p.id} className="bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${p.color || '#8b5cf6'}1a`, color: p.color || '#8b5cf6' }}>
                          <Layers size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{p.name}</p>
                          <span className="text-[10px] font-black text-slate-400 uppercase">{p.code}</span>
                        </div>
                        <span className="text-sm font-black text-slate-700 dark:text-slate-300 shrink-0">{p.weightPercentage}%</span>
                      </div>
                    ))}
                    {items.length === 0 && (
                      <div className="text-xs text-slate-400 italic px-4 py-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                        Chưa có hạng mục nào thuộc lĩnh vực này.
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
