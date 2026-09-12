import { useMemo, useRef, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useFixedPerspectives, useScorecards, useScorecardMutations } from '../hooks/useBsc'
import { Plus, FileUp, Sliders } from 'lucide-react'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import { usePermission } from '@/hooks/usePermission'
import { useNavLabels } from '@/features/organization/hooks/useNavLabels'
import { findNavItem } from '@/config/navigation'
import { ScorecardResponse, BscScoringMode, BscFixedPerspective } from '../types'
import ScorecardFormModal from '../components/ScorecardFormModal'
import ImportScorecardGuideModal from '../components/ImportScorecardGuideModal'
import ScorecardExcelPreviewModal from '../components/ScorecardExcelPreviewModal'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import BscScorecardTree from '../components/BscScorecardTree'
import CascadeModal from '../components/CascadeModal'
import CascadePolicyModal from '../components/CascadePolicyModal'
import { Button } from '@/components/ui/button'

/**
 * BSC chỉ còn MỘT luồng: bộ tiêu chí. Hạng mục không còn màn riêng mà được tạo/sửa ngay
 * trong bộ tiêu chí chứa nó — giống OKR, nơi Key Result nằm trong Objective.
 *
 * Trước đây hai thứ này là hai tab ngang hàng, nên người dùng phải tự đoán rằng "phải
 * qua tab Hạng mục tạo trước thì tab Bộ tiêu chí mới có gì để gán trọng số". Tách đôi như
 * vậy chỉ đúng với mô hình dữ liệu (hạng mục dùng chung cho cả tổ chức), không đúng với
 * việc người dùng đang làm (dựng một bộ tiêu chí cho một kỳ).
 *
 * Cùng lý do đó, hai khung nhìn "Danh sách bộ tiêu chí" và "Cây phân rã" đã GỘP LÀM MỘT
 * ({@link BscScorecardTree}): chúng hiển thị cùng một tập bộ tiêu chí, chỉ khác chỗ đặt nút,
 * nên tách tab chỉ khiến người dùng phải nhớ việc nào làm ở tab nào.
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
  const { deleteScorecard, importScorecards, updateScoringMode } = useScorecardMutations()
  const { hasPermission } = usePermission()
  const canPublish = hasPermission('BSC:PUBLISH_SCORE')

  const { labelOf } = useNavLabels()
  const bscNavItem = findNavItem('bsc')
  const pageTitle = bscNavItem ? labelOf(bscNavItem) : 'Quản lý BSC'

  // `createFixed` khác undefined ⇒ mở luôn form tạo hạng mục cho lĩnh vực đó bên trong
  // modal bộ tiêu chí, để nút "Thêm hạng mục" trong cây đi thẳng tới việc cần làm.
  const [scorecardModal, setScorecardModal] = useState<
    { scorecard?: ScorecardResponse; createFixed?: BscFixedPerspective } | null
  >(null)
  const [deleteScorecardId, setDeleteScorecardId] = useState<string | null>(null)
  const [publishTarget, setPublishTarget] = useState<ScorecardResponse | null>(null)
  const [cascadeTarget, setCascadeTarget] = useState<ScorecardResponse | null>(null)
  const [isPolicyOpen, setIsPolicyOpen] = useState(false)
  const canManageBsc = hasPermission('BSC:MANAGE')

  /**
   * Người này sửa/xoá được bộ tiêu chí nào.
   *
   * <p>Soi gương đúng luật của {@code BscService.assertCanEditScorecard}: quản trị BSC toàn tổ chức
   * làm được tất; trưởng đơn vị chỉ đụng được thẻ mà MỌI đơn vị của nó nằm trong phạm vi mình phụ
   * trách; thẻ không gắn đơn vị nào (BSC toàn tổ chức) thì phải là quản trị.
   *
   * <p>Backend vẫn là nơi chặn thật — đây chỉ để không bày ra nút bấm vào là báo lỗi. Cũng vì thế
   * chỗ này được phép xấp xỉ: nó lấy mọi đơn vị người dùng được gán, trong khi backend lọc theo
   * đúng vai trò nào mang quyền BSC:MANAGE_UNIT.
   */
  const canManageUnitBsc = hasPermission('BSC:MANAGE_UNIT')
  const myUnitIds = useMemo(
    () => new Set((user?.memberships ?? []).map(m => m.orgUnitId)),
    [user],
  )
  const canEditScorecard = (sc: ScorecardResponse) => {
    if (canManageBsc) return true
    if (!canManageUnitBsc) return false
    const units = sc.orgUnits ?? []
    return units.length > 0 && units.every(u => myUnitIds.has(u.id))
  }

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
        id="tour-bsc-header"
        title={pageTitle}
        description="Cây BSC công ty → phòng ban. Mở một nhánh để sửa hạng mục và trọng số, phân rã chỉ tiêu xuống cấp dưới và xem kết quả của đợt."
        actions={
          <>
            <input type="file" className="hidden" ref={scorecardFileInputRef} accept=".xlsx" onChange={handleScorecardFileSelect} />
            {/* MỘT nút import duy nhất: tệp bộ tiêu chí giờ tạo luôn hạng mục còn thiếu, nên không
                còn lý do bắt người dùng chọn "import loại nào" rồi phải nhớ đúng thứ tự hai lần.
                Import ghi đè bộ tiêu chí của NHIỀU đơn vị theo mã trong tệp, không gác theo phạm vi
                từng dòng được — nên chỉ người quản trị BSC toàn tổ chức mới thấy nút này. */}
            {canManageBsc && (
              <Button variant="outline" onClick={() => setIsScorecardImportGuideOpen(true)}>
                <FileUp aria-hidden="true" /> Import
              </Button>
            )}
            {canManageBsc && (
              <Button variant="outline" onClick={() => setIsPolicyOpen(true)} title="Trần điểm công nhận và ràng buộc KPI phải liên kết BSC">
                <Sliders aria-hidden="true" /> Chính sách
              </Button>
            )}
            <Button onClick={() => setScorecardModal({})}>
              <Plus aria-hidden="true" /> Bộ tiêu chí mới
            </Button>
          </>
        }
      />

      <div id="tour-bsc-scorecards">
        <BscScorecardTree
          organizationId={organizationId}
          scorecards={scorecards}
          fixedPerspectives={fixedPerspectives || []}
          canPublish={canPublish}
          canEditScorecard={canEditScorecard}
          onCascade={setCascadeTarget}
          onEdit={sc => setScorecardModal({ scorecard: sc })}
          onDelete={sc => setDeleteScorecardId(sc.id)}
          onTogglePublish={setPublishTarget}
          onAddPerspective={(sc, code) => setScorecardModal({ scorecard: sc, createFixed: code })}
        />
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

      {/* Chỉ dựng khi thực sự mở: để component sống mãi thì state trong nó (đơn vị đã tick, số
          đang gõ dở) còn nguyên từ lần mở trước, lần sau mở ra thấy tick sẵn mà ô thì trống. */}
      {cascadeTarget && (
        <CascadeModal open onClose={() => setCascadeTarget(null)} scorecard={cascadeTarget} />
      )}
      <CascadePolicyModal open={isPolicyOpen} onClose={() => setIsPolicyOpen(false)} organizationId={organizationId} />
      <ImportScorecardGuideModal open={isScorecardImportGuideOpen} onClose={() => setIsScorecardImportGuideOpen(false)} onSelectFile={() => scorecardFileInputRef.current?.click()} />
      <ScorecardExcelPreviewModal open={!!scorecardPreviewFile} file={scorecardPreviewFile} onClose={() => setScorecardPreviewFile(null)} onImport={handleConfirmScorecardImport} isImporting={importScorecards.isPending} />

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
