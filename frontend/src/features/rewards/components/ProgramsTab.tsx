import { useState } from 'react'
import { Plus, Pencil, Trash2, Play, Trophy, Info, History, Zap } from 'lucide-react'
import DataTable from '@/components/common/DataTable'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { WorkspaceHeaderActions } from '@/components/common/WorkspaceTabs'
import ProgramFormModal from './ProgramFormModal'
import RunPreviewModal from './RunPreviewModal'
import ProgramRunsModal from './ProgramRunsModal'
import { useRewardPrograms } from '../hooks/usePrograms'
import {
  RewardProgramScope,
  RewardRankingMetric,
  type RewardProgram,
} from '../types'
import { Button } from '@/components/ui/button'

const SCOPE_LABEL: Record<RewardProgramScope, string> = {
  [RewardProgramScope.CYCLE]: 'Theo kỳ',
  [RewardProgramScope.PERIOD]: 'Theo đợt',
}

const METRIC_LABEL: Record<RewardRankingMetric, string> = {
  [RewardRankingMetric.FINAL_SCORE]: 'Điểm chốt kỳ',
  [RewardRankingMetric.MATRIX_RATING]: 'Xếp loại',
  [RewardRankingMetric.PERFORMANCE]: 'Điểm hiệu suất',
}

/** Mô tả bậc thưởng thành một dòng đọc được: "Hạng 1: 500đ · Hạng 2–3: 300đ". */
const tierSummary = (p: RewardProgram) =>
  p.tiers
    .map((t) =>
      t.fromRank === t.toRank
        ? `Hạng ${t.fromRank}: ${t.points}`
        : `Hạng ${t.fromRank} –${t.toRank}: ${t.points}`,
    )
    .join(' · ')

export default function ProgramsTab() {
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RewardProgram | null>(null)
  const [running, setRunning] = useState<RewardProgram | null>(null)
  const [viewingRuns, setViewingRuns] = useState<RewardProgram | null>(null)
  const [deleting, setDeleting] = useState<RewardProgram | null>(null)

  const { data, isLoading, deleteProgram, isDeleting } = useRewardPrograms()

  return (
    <div id="tour-programs-root">
      <div id="tour-programs-note" className="mb-4 flex items-start gap-2.5 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-4 py-3 text-sm">
        <Info size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-muted-foreground)]" />
        <p className="text-[var(--color-muted-foreground)]">
          Chương trình <b>không tự chạy</b>. Bấm <b>▷ Chạy</b> để chọn một đợt/kỳ, sửa bậc thưởng
          riêng cho lần đó nếu cần, xem trước bảng xếp hạng rồi mới phát. Bậc trong cấu hình chỉ là
          <b> mặc định</b>. Điểm phát từ chương trình lấy từ quỹ chung của tổ chức, không trừ hạn
          mức cá nhân của ai.
        </p>
      </div>

      <div id="tour-programs-actions" className="mb-4 flex items-center justify-between gap-3">
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {(data ?? []).length > 0 && `${(data ?? []).length} chương trình`}
        </span>
        <WorkspaceHeaderActions>
          <Button onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}>
            <Plus aria-hidden="true" />
            Tạo chương trình
          </Button>
        </WorkspaceHeaderActions>
      </div>

      {isLoading ? (
        <LoadingSkeleton type="table" rows={3} />
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)]">
          <EmptyState
            title="Chưa có chương trình thưởng tự động"
            description="Thay vì chọn tay từng người, hãy đặt luật một lần: ai lọt top của đợt/kỳ thì được bao nhiêu điểm."
            action={
              <Button onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}>
                <Plus aria-hidden="true" />
                Tạo chương trình đầu tiên
              </Button>
            }
          />
        </div>
      ) : (
        <DataTable<RewardProgram>
          data={data ?? []}
          keyExtractor={(row) => row.id}
          emptyMessage=""
          renderMobileCard={(row) => (
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{row.name}</div>
                  <div className="text-xs text-[var(--color-muted-foreground)]">
                    {SCOPE_LABEL[row.scope]} · {METRIC_LABEL[row.metric]} ·{' '}
                    {row.orgUnitName ?? 'Toàn tổ chức'}
                  </div>
                </div>
                {!row.enabled && (
                  <span className="flex-shrink-0 rounded-full bg-[var(--color-muted)] px-2.5 py-1 text-xs text-[var(--color-muted-foreground)]">
                    Đang tắt
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--color-muted-foreground)]">{tierSummary(row)}</div>
              <div className="flex gap-2 border-t border-[var(--color-border)] pt-2.5">
                <Button className="flex-1" onClick={() => setRunning(row)} disabled={!row.enabled}>
                  Chạy
                </Button>
                <button
                  onClick={() => setViewingRuns(row)}
                  className="rounded-control border border-[var(--color-border)] px-3 py-2"
                >
                  <History size={15} />
                </button>
                <button
                  onClick={() => {
                    setEditing(row)
                    setFormOpen(true)
                  }}
                  className="rounded-control border border-[var(--color-border)] px-3 py-2"
                >
                  <Pencil size={15} />
                </button>
              </div>
            </div>
          )}
          columns={[
            {
              key: 'name',
              className: 'align-top',
              header: 'Chương trình',
              render: (row) => (
                <div>
                  <div className="flex items-center gap-1.5 font-medium">
                    <Trophy size={14} className="text-[var(--color-primary)]" />
                    {row.name}
                  </div>
                  {/* Ghi rõ "mặc định": bậc này chỉ là điểm khởi đầu, mỗi lần chạy sửa
                      được cho riêng kỳ/đợt đó. Không nói thì người dùng tưởng đã cố định. */}
                  <div className="text-xs text-[var(--color-muted-foreground)]">
                    Mặc định: {tierSummary(row)}
                  </div>
                </div>
              ),
            },
            {
              key: 'scope',
              className: 'align-top',
              header: 'Áp dụng cho',
              render: (row) => (
                <div>
                  {/* Gắn cứng một kỳ hay dùng chung là điều đầu tiên người quản lý cần
                      biết khi nhìn danh sách — nó quyết định bấm Chạy sẽ ra màn hình nào. */}
                  <div>
                    {row.fixedTargetName ?? `Mọi ${row.scope === RewardProgramScope.CYCLE ? 'kỳ' : 'đợt'}`}
                  </div>
                  <div className="text-xs text-[var(--color-muted-foreground)]">
                    {SCOPE_LABEL[row.scope]} · {METRIC_LABEL[row.metric]}
                  </div>
                </div>
              ),
            },
            {
              key: 'orgUnit',
              className: 'align-top',
              header: 'Phạm vi',
              render: (row) => row.orgUnitName ?? 'Toàn tổ chức',
            },
            {
              key: 'issuedRunCount',
              className: 'text-right align-top',
              header: 'Đã phát',
              render: (row) => (
                <span className={row.issuedRunCount > 0 ? 'font-semibold' : ''}>
                  {row.issuedRunCount} lần
                </span>
              ),
            },
            {
              key: 'enabled',
              className: 'align-top',
              header: 'Trạng thái',
              render: (row) => (
                <div>
                  {row.enabled ? (
                    <span className="inline-block rounded-full bg-[var(--color-success-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-success)]">
                      Đang bật
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-[var(--color-muted)] px-2.5 py-1 text-xs font-medium text-[var(--color-muted-foreground)]">
                      Đang tắt
                    </span>
                  )}
                  {/* Chương trình tự phát thì điểm vào ví không ai bấm — phải nhìn thấy
                      được ngay ở danh sách, không giấu trong màn hình sửa. */}
                  {row.enabled && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
                      {row.autoTrigger ? (
                        <>
                          <Zap size={11} className="text-[var(--color-warning)]" />
                          Tự phát khi kết thúc
                        </>
                      ) : (
                        'Phát tay'
                      )}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'actions',
              className: 'text-right align-top',
              header: '',
              render: (row) => (
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label={
                      row.enabled
                        ? 'Chạy: chọn kỳ/đợt, sửa bậc riêng nếu cần, xem trước rồi phát thưởng'
                        : 'Chương trình đang tắt'
                    } onClick={() => setRunning(row)} disabled={!row.enabled} title={
                      row.enabled
                        ? 'Chạy: chọn kỳ/đợt, sửa bậc riêng nếu cần, xem trước rồi phát thưởng'
                        : 'Chương trình đang tắt'
                    }>
                    <Play aria-hidden="true" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Lịch sử phát thưởng" onClick={() => setViewingRuns(row)} title="Lịch sử phát thưởng">
                    <History aria-hidden="true" />
                  </Button>
                  <button
                    onClick={() => {
                      setEditing(row)
                      setFormOpen(true)
                    }}
                    className="rounded-control p-1.5 hover:bg-[var(--color-accent)]"
                  >
                    <Pencil size={15} />
                  </button>
                  <Button variant="ghost" size="icon-sm" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" aria-label={
                      row.issuedRunCount > 0
                        ? 'Đã phát thưởng — không xoá được, hãy tắt chương trình'
                        : 'Xoá'
                    } onClick={() => setDeleting(row)} disabled={row.issuedRunCount > 0} title={
                      row.issuedRunCount > 0
                        ? 'Đã phát thưởng — không xoá được, hãy tắt chương trình'
                        : 'Xoá'
                    }>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}

      <ProgramFormModal open={formOpen} onClose={() => setFormOpen(false)} editProgram={editing} />
      <RunPreviewModal program={running} onClose={() => setRunning(null)} />
      <ProgramRunsModal program={viewingRuns} onClose={() => setViewingRuns(null)} />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await deleteProgram(deleting.id)
          setDeleting(null)
        }}
        title="Xoá chương trình thưởng?"
        description={
          deleting
            ? `"${deleting.name}" sẽ bị xoá. Chỉ xoá được chương trình chưa từng phát thưởng — ` +
              'nếu đã phát, hãy TẮT chương trình để ngừng dùng mà vẫn giữ được lịch sử.'
            : ''
        }
        confirmLabel="Xoá"
        loading={isDeleting}
      />
    </div>
  )
}
