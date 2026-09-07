import { useState } from 'react'
import { Plus, Pencil, Trash2, AlertTriangle, Info } from 'lucide-react'
import DataTable from '@/components/common/DataTable'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { WorkspaceHeaderActions } from '@/components/common/WorkspaceTabs'
import BudgetFormModal from './BudgetFormModal'
import { useRewardBudgets } from '../hooks/useRewards'
import type { RewardBudget } from '../types'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

/**
 * Hạn mức chỉ có tác dụng khi HÔM NAY nằm trong khoảng hiệu lực. Không hiện trạng thái
 * này ra thì người quản lý thấy hạn mức nằm chình ình trong danh sách nhưng lúc thưởng
 * hệ thống lại bảo không có — tưởng là lỗi.
 *
 * <p>So sánh theo chuỗi 'yyyy-MM-dd' để tránh lệch múi giờ khi dựng Date từ ngày trần.
 */
const budgetPhase = (b: RewardBudget): 'active' | 'expired' | 'upcoming' => {
  const today = new Date().toLocaleDateString('sv-SE') // 'sv-SE' cho ra đúng yyyy-MM-dd
  if (today < b.periodStart) return 'upcoming'
  if (today > b.periodEnd) return 'expired'
  return 'active'
}

const PHASE_BADGE: Record<ReturnType<typeof budgetPhase>, { label: string; className: string }> = {
  active: { label: 'Đang hiệu lực', className: 'bg-emerald-500/15 text-emerald-700' },
  upcoming: { label: 'Chưa bắt đầu', className: 'bg-sky-500/15 text-sky-700' },
  expired: { label: 'Đã hết hiệu lực', className: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]' },
}

export default function BudgetsTab() {
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RewardBudget | null>(null)
  const [deleting, setDeleting] = useState<RewardBudget | null>(null)

  const { data, isLoading, deleteBudget, isDeleting } = useRewardBudgets()

  return (
    <div id="tour-budgets-root">
      {/* Câu giải thích tách thành khối riêng, không chen cùng hàng với nút — đặt cạnh
          nhau thì chữ dài bị ép sát vào nút, đọc rất khó chịu. */}
      <div id="tour-budgets-note" className="mb-4 flex items-start gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-4 py-3 text-sm">
        <Info size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-muted-foreground)]" />
        <p className="text-[var(--color-muted-foreground)]">
          Người có hạn mức được tự thưởng mà không cần duyệt. Vượt hạn mức hoặc vượt mức tối đa
          mỗi lần thì đề nghị sẽ chuyển sang chờ duyệt.
        </p>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {/* Đếm riêng cái ĐANG hiệu lực — đếm gộp cả hạn mức đã hết hạn là nói sai. */}
          {(data ?? []).length > 0 &&
            (() => {
              const total = (data ?? []).length
              const active = (data ?? []).filter((b) => budgetPhase(b) === 'active').length
              return active === total
                ? `${total} hạn mức đang hiệu lực`
                : `${active}/${total} hạn mức đang hiệu lực`
            })()}
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
            Cấp hạn mức
          </button>
        </WorkspaceHeaderActions>
      </div>

      {isLoading ? (
        <LoadingSkeleton type="table" rows={4} />
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)]">
          <EmptyState
            title="Chưa cấp hạn mức cho ai"
            description="Khi chưa có hạn mức, mọi đề nghị thưởng của quản lý đều phải qua duyệt. Cấp hạn mức để họ tự chủ động ghi nhận nhân viên."
            action={
              <button
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
              >
                <Plus size={16} />
                Cấp hạn mức đầu tiên
              </button>
            }
          />
        </div>
      ) : (
        <DataTable<RewardBudget>
          data={data ?? []}
          keyExtractor={(row) => row.id}
          emptyMessage=""
          // Thẻ mobile tự viết: thanh tiến trình cần chiều rộng cả thẻ, bản tự sinh của
          // DataTable ép nó vào nửa phải một hàng flex nên bị bóp méo.
          renderMobileCard={(row) => {
            const pct =
              row.allocatedPoints > 0
                ? Math.min(100, Math.round((row.usedPoints / row.allocatedPoints) * 100))
                : 0
            const barColor =
              pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
            return (
              <div className="space-y-3">
                <div>
                  <div className="font-medium">{row.grantorName}</div>
                  <div className="text-xs text-[var(--color-muted-foreground)]">
                    {row.grantorEmail}
                  </div>
                </div>

                <div className="text-sm">
                  {/* Mỗi thông tin một dòng: nhồi badge + khoảng ngày + tên kỳ vào cùng
                      một dòng thì trên màn hình hẹp nó ngắt ở chỗ tuỳ ý, tên kỳ bị xé
                      làm đôi ("Kỳ: 6 Tháng" / "1 / 2026"). */}
                  <div>
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${PHASE_BADGE[budgetPhase(row)].className}`}
                    >
                      {PHASE_BADGE[budgetPhase(row)].label}
                    </span>
                  </div>
                  <div className="mt-1">
                    {fmtDate(row.periodStart)} – {fmtDate(row.periodEnd)}
                  </div>
                  {(row.kpiCycleName || row.kpiPeriodName) && (
                    <div className="text-xs text-[var(--color-muted-foreground)]">
                      {row.kpiCycleName
                        ? `Theo kỳ: ${row.kpiCycleName}`
                        : `Theo đợt: ${row.kpiPeriodName}`}
                    </div>
                  )}
                  {row.cycleDatesOutOfSync && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                      <AlertTriangle size={12} />
                      Ngày của {row.kpiPeriodName ? 'đợt' : 'kỳ'} đã thay đổi
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium tabular-nums">
                      Đã dùng {row.usedPoints.toLocaleString('vi-VN')} /{' '}
                      {row.allocatedPoints.toLocaleString('vi-VN')}
                    </span>
                    <span className="text-xs text-[var(--color-muted-foreground)]">{pct}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--color-muted)]">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2.5 text-sm">
                  <span>
                    Còn <span className="font-semibold">{row.remainingPoints.toLocaleString('vi-VN')}</span>
                    <span className="text-[var(--color-muted-foreground)]">
                      {' '}· tối đa/người{' '}
                      {row.maxPerAward != null ? row.maxPerAward.toLocaleString('vi-VN') : '∞'}
                    </span>
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditing(row)
                        setFormOpen(true)
                      }}
                      className="rounded-lg border border-[var(--color-border)] p-2"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setDeleting(row)}
                      className="rounded-lg border border-rose-500/40 p-2 text-rose-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )
          }}
          columns={[
            {
              key: 'grantorName',
              className: 'align-top',
              header: 'Người được cấp',
              render: (row) => (
                <div>
                  <div className="font-medium">{row.grantorName}</div>
                  <div className="text-xs text-[var(--color-muted-foreground)]">
                    {row.grantorEmail}
                  </div>
                </div>
              ),
            },
            {
              key: 'period',
              className: 'align-top',
              header: 'Hiệu lực',
              render: (row) => (
                <div>
                  <div className="mb-1">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${PHASE_BADGE[budgetPhase(row)].className}`}
                    >
                      {PHASE_BADGE[budgetPhase(row)].label}
                    </span>
                  </div>
                  <div
                    className={`whitespace-nowrap ${budgetPhase(row) !== 'active' ? 'text-[var(--color-muted-foreground)]' : ''}`}
                  >
                    {fmtDate(row.periodStart)} – {fmtDate(row.periodEnd)}
                  </div>
                  {row.kpiCycleName && (
                    <div className="text-xs text-[var(--color-muted-foreground)]">
                      Theo kỳ: {row.kpiCycleName}
                    </div>
                  )}
                  {row.kpiPeriodName && (
                    <div className="text-xs text-[var(--color-muted-foreground)]">
                      Theo đợt: {row.kpiPeriodName}
                    </div>
                  )}
                  {/* Ngày kỳ/đợt đổi sau khi cấp hạn mức. Hệ thống cố ý không tự dịch
                      chuyển vì hạn mức đã cấp là một cam kết — chỉ báo để người
                      quản trị tự quyết. */}
                  {row.cycleDatesOutOfSync && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-700">
                      <AlertTriangle size={12} />
                      Ngày của {row.kpiPeriodName ? 'đợt' : 'kỳ'} đã thay đổi
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'usage',
              className: 'align-top',
              header: 'Đã dùng',
              render: (row) => {
                const pct =
                  row.allocatedPoints > 0
                    ? Math.min(100, Math.round((row.usedPoints / row.allocatedPoints) * 100))
                    : 0
                // Ba ngưỡng màu: dùng nhiều thì đổi màu để người quản trị biết ai sắp
                // hết hạn mức mà cấp thêm, thay vì đợi họ báo lên.
                const barColor =
                  pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                return (
                  <div className="min-w-[150px]">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium tabular-nums">
                        {row.usedPoints.toLocaleString('vi-VN')} /{' '}
                        {row.allocatedPoints.toLocaleString('vi-VN')}
                      </span>
                      <span className="text-xs text-[var(--color-muted-foreground)]">{pct}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--color-muted)]">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              },
            },
            {
              key: 'remainingPoints',
              header: 'Còn lại',
              className: 'text-right align-top',
              render: (row) => (
                <span className="font-semibold">
                  {row.remainingPoints.toLocaleString('vi-VN')}
                </span>
              ),
            },
            {
              key: 'maxPerAward',
              header: 'Tối đa/người',
              className: 'text-right align-top',
              render: (row) =>
                row.maxPerAward != null ? row.maxPerAward.toLocaleString('vi-VN') : 'Không giới hạn',
            },
            {
              key: 'actions',
              header: '',
              className: 'text-right align-top',
              render: (row) => (
                <div className="flex justify-end gap-1">
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
                    disabled={row.usedPoints > 0}
                    title={
                      row.usedPoints > 0
                        ? `Đã dùng ${row.usedPoints.toLocaleString('vi-VN')} điểm — không xoá được. Hạ tổng điểm xuống bằng mức đã dùng để dừng quyền tự thưởng.`
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

      <BudgetFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editBudget={editing}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await deleteBudget(deleting.id)
          setDeleting(null)
        }}
        title="Xoá hạn mức?"
        description={
          deleting
            ? `${deleting.grantorName} sẽ không còn tự thưởng được — mọi đề nghị của họ sẽ phải qua duyệt. ` +
              'Chỉ xoá được hạn mức chưa từng có đề nghị nào tính vào; nếu đã dùng, hãy hạ tổng điểm ' +
              'xuống bằng mức đã dùng thay vì xoá, để sổ sách hạn mức không bị sai.'
            : ''
        }
        confirmLabel="Xoá"
        loading={isDeleting}
      />
    </div>
  )
}
