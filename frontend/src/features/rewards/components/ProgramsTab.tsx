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
        : `Hạng ${t.fromRank}–${t.toRank}: ${t.points}`,
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
    <div>
      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-4 py-3 text-sm">
        <Info size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-muted-foreground)]" />
        <p className="text-[var(--color-muted-foreground)]">
          Chương trình <b>không tự chạy</b>. Bấm <b>▷ Chạy</b> để chọn một đợt/kỳ, sửa bậc thưởng
          riêng cho lần đó nếu cần, xem trước bảng xếp hạng rồi mới phát. Bậc trong cấu hình chỉ là
          <b> mặc định</b>. Điểm phát từ chương trình lấy từ quỹ chung của tổ chức, không trừ hạn
          mức cá nhân của ai.
        </p>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {(data ?? []).length > 0 && `${(data ?? []).length} chương trình`}
        </span>
        <WorkspaceHeaderActions>
          <button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
            className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 h-10 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <Plus size={16} />
            Tạo chương trình
          </button>
        </WorkspaceHeaderActions>
      </div>

      {isLoading ? (
        <LoadingSkeleton type="table" rows={3} />
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)]">
          <EmptyState
            title="Chưa có chương trình thưởng tự động"
            description="Thay vì chọn tay từng người, hãy đặt luật một lần: ai lọt top của đợt/kỳ thì được bao nhiêu điểm."
            action={
              <button
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
              >
                <Plus size={16} />
                Tạo chương trình đầu tiên
              </button>
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
                <button
                  onClick={() => setRunning(row)}
                  disabled={!row.enabled}
                  className="flex-1 rounded-lg bg-[var(--color-primary)] py-2 text-sm text-white disabled:opacity-40"
                >
                  Chạy
                </button>
                <button
                  onClick={() => setViewingRuns(row)}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-2"
                >
                  <History size={15} />
                </button>
                <button
                  onClick={() => {
                    setEditing(row)
                    setFormOpen(true)
                  }}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-2"
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
                    <span className="inline-block rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700">
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
                          <Zap size={11} className="text-amber-600" />
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
                  <button
                    onClick={() => setRunning(row)}
                    disabled={!row.enabled}
                    title={
                      row.enabled
                        ? 'Chạy: chọn kỳ/đợt, sửa bậc riêng nếu cần, xem trước rồi phát thưởng'
                        : 'Chương trình đang tắt'
                    }
                    className="rounded-lg p-1.5 text-[var(--color-primary)] hover:bg-[var(--color-accent)] disabled:opacity-30"
                  >
                    <Play size={16} />
                  </button>
                  <button
                    onClick={() => setViewingRuns(row)}
                    title="Lịch sử phát thưởng"
                    className="rounded-lg p-1.5 hover:bg-[var(--color-accent)]"
                  >
                    <History size={15} />
                  </button>
                  <button
                    onClick={() => {
                      setEditing(row)
                      setFormOpen(true)
                    }}
                    className="rounded-lg p-1.5 hover:bg-[var(--color-accent)]"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setDeleting(row)}
                    disabled={row.issuedRunCount > 0}
                    title={
                      row.issuedRunCount > 0
                        ? 'Đã phát thưởng — không xoá được, hãy tắt chương trình'
                        : 'Xoá'
                    }
                    className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Trash2 size={15} />
                  </button>
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
