import { intlDateLocale, intlLocale } from '@/i18n/format'
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
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(intlDateLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' })

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

const PHASE_BADGE = perLanguage((): Record<ReturnType<typeof budgetPhase>, { label: string; className: string }> => ({
  active: { label: i18n.t('rewards:BudgetsTab.inEffect'), className: 'bg-[var(--color-success-bg)] text-[var(--color-success)]' },
  upcoming: { label: i18n.t('rewards:BudgetsTab.notStarted'), className: 'bg-[var(--color-info-bg)] text-[var(--color-info)]' },
  expired: { label: i18n.t('rewards:BudgetsTab.expired'), className: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]' },
}))

export default function BudgetsTab() {
  const { t } = useTranslation('rewards')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RewardBudget | null>(null)
  const [deleting, setDeleting] = useState<RewardBudget | null>(null)

  const { data, isLoading, deleteBudget, isDeleting } = useRewardBudgets()

  return (
    <div id="tour-budgets-root">
      {/* Câu giải thích tách thành khối riêng, không chen cùng hàng với nút — đặt cạnh
          nhau thì chữ dài bị ép sát vào nút, đọc rất khó chịu. */}
      <div id="tour-budgets-note" className="mb-4 flex items-start gap-2.5 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-4 py-3 text-sm">
        <Info size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-muted-foreground)]" />
        <p className="text-[var(--color-muted-foreground)]">
          {t('BudgetsTab.peopleWithABudgetCanReward')}
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
                ? t('BudgetsTab.activeBudgets', { count: total })
                : t('BudgetsTab.budgetsActive', { active, total })
            })()}
        </span>
        <WorkspaceHeaderActions>
          <Button onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}>
            <Plus aria-hidden="true" />
            {t('BudgetsTab.grantBudget')}
          </Button>
        </WorkspaceHeaderActions>
      </div>

      {isLoading ? (
        <LoadingSkeleton type="table" rows={4} />
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)]">
          <EmptyState
            title={t('BudgetsTab.noBudgetsGrantedYet')}
            description={t('BudgetsTab.withoutABudgetEveryManagerReward')}
            action={
              <Button onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}>
                <Plus aria-hidden="true" />
                {t('BudgetsTab.grantTheFirstBudget')}
              </Button>
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
              pct >= 90 ? 'bg-[var(--color-error-solid)]' : pct >= 70 ? 'bg-[var(--color-warning-solid)]' : 'bg-[var(--color-success-solid)]'
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
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${PHASE_BADGE()[budgetPhase(row)].className}`}
                    >
                      {PHASE_BADGE()[budgetPhase(row)].label}
                    </span>
                  </div>
                  <div className="mt-1">
                    {fmtDate(row.periodStart)} – {fmtDate(row.periodEnd)}
                  </div>
                  {(row.kpiCycleName || row.kpiPeriodName) && (
                    <div className="text-xs text-[var(--color-muted-foreground)]">
                      {row.kpiCycleName
                        ? t('BudgetsTab.byCycle', { kpiCycleName: row.kpiCycleName })
                        : t('BudgetsTab.byPeriod', { kpiPeriodName: row.kpiPeriodName })}
                    </div>
                  )}
                  {row.cycleDatesOutOfSync && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-[var(--color-warning)]">
                      <AlertTriangle size={12} />
                      {t('BudgetsTab.datesOf')} {row.kpiPeriodName ? t('BudgetsTab.periods') : t('BudgetsTab.cycle')} {t('BudgetsTab.haveChanged')}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium tabular-nums">
                      {t('BudgetsTab.used')} {row.usedPoints.toLocaleString(intlLocale())} /{' '}
                      {row.allocatedPoints.toLocaleString(intlLocale())}
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
                    {t('BudgetsTab.remaining')} <span className="font-semibold">{row.remainingPoints.toLocaleString(intlLocale())}</span>
                    <span className="text-[var(--color-muted-foreground)]">
                      {' '}{t('BudgetsTab.maxPerson')}{' '}
                      {row.maxPerAward != null ? row.maxPerAward.toLocaleString(intlLocale()) : '∞'}
                    </span>
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditing(row)
                        setFormOpen(true)
                      }}
                      className="rounded-control border border-[var(--color-border)] p-2"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setDeleting(row)}
                      className="rounded-control border border-[var(--color-error-border)] p-2 text-[var(--color-error)]"
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
              header: t('BudgetsTab.recipient'),
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
              header: t('BudgetsTab.validity'),
              render: (row) => (
                <div>
                  <div className="mb-1">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${PHASE_BADGE()[budgetPhase(row)].className}`}
                    >
                      {PHASE_BADGE()[budgetPhase(row)].label}
                    </span>
                  </div>
                  <div
                    className={`whitespace-nowrap ${budgetPhase(row) !== 'active' ? 'text-[var(--color-muted-foreground)]' : ''}`}
                  >
                    {fmtDate(row.periodStart)} – {fmtDate(row.periodEnd)}
                  </div>
                  {row.kpiCycleName && (
                    <div className="text-xs text-[var(--color-muted-foreground)]">
                      {t('BudgetsTab.byCycle2')} {row.kpiCycleName}
                    </div>
                  )}
                  {row.kpiPeriodName && (
                    <div className="text-xs text-[var(--color-muted-foreground)]">
                      {t('BudgetsTab.byPeriod2')} {row.kpiPeriodName}
                    </div>
                  )}
                  {/* Ngày kỳ/đợt đổi sau khi cấp hạn mức. Hệ thống cố ý không tự dịch
                      chuyển vì hạn mức đã cấp là một cam kết — chỉ báo để người
                      quản trị tự quyết. */}
                  {row.cycleDatesOutOfSync && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-warning)]">
                      <AlertTriangle size={12} />
                      {t('BudgetsTab.datesOf')} {row.kpiPeriodName ? t('BudgetsTab.periods') : t('BudgetsTab.cycle')} {t('BudgetsTab.haveChanged')}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'usage',
              className: 'align-top',
              header: t('BudgetsTab.used'),
              render: (row) => {
                const pct =
                  row.allocatedPoints > 0
                    ? Math.min(100, Math.round((row.usedPoints / row.allocatedPoints) * 100))
                    : 0
                // Ba ngưỡng màu: dùng nhiều thì đổi màu để người quản trị biết ai sắp
                // hết hạn mức mà cấp thêm, thay vì đợi họ báo lên.
                const barColor =
                  pct >= 90 ? 'bg-[var(--color-error-solid)]' : pct >= 70 ? 'bg-[var(--color-warning-solid)]' : 'bg-[var(--color-success-solid)]'
                return (
                  <div className="min-w-[150px]">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium tabular-nums">
                        {row.usedPoints.toLocaleString(intlLocale())} /{' '}
                        {row.allocatedPoints.toLocaleString(intlLocale())}
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
              header: t('BudgetsTab.remaining2'),
              className: 'text-right align-top',
              render: (row) => (
                <span className="font-semibold">
                  {row.remainingPoints.toLocaleString(intlLocale())}
                </span>
              ),
            },
            {
              key: 'maxPerAward',
              header: t('BudgetsTab.maxPerson2'),
              className: 'text-right align-top',
              render: (row) =>
                row.maxPerAward != null ? row.maxPerAward.toLocaleString(intlLocale()) : t('BudgetsTab.unlimited'),
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
                    className="rounded-control p-1.5 hover:bg-[var(--color-accent)]"
                  >
                    <Pencil size={15} />
                  </button>
                  <Button variant="ghost" size="icon-sm" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" aria-label={
                      row.usedPoints > 0
                        ? t('BudgetsTab.pointsUsedCannotBeDeletedLower', { value: row.usedPoints.toLocaleString(intlLocale()) })
                        : t('BudgetsTab.delete')
                    } onClick={() => setDeleting(row)} disabled={row.usedPoints > 0} title={
                      row.usedPoints > 0
                        ? t('BudgetsTab.pointsUsedCannotBeDeletedLower', { value: row.usedPoints.toLocaleString(intlLocale()) })
                        : t('BudgetsTab.delete')
                    }>
                    <Trash2 aria-hidden="true" />
                  </Button>
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
        title={t('BudgetsTab.deleteTheBudget')}
        description={
          deleting
            ? t('BudgetsTab.willNoLongerBeAbleTo', { grantorName: deleting.grantorName }) +
              t('BudgetsTab.onlyBudgetsThatNoProposalHas') +
              t('BudgetsTab.toTheUsedAmountInsteadOf')
            : ''
        }
        confirmLabel={t('BudgetsTab.delete')}
        loading={isDeleting}
      />
    </div>
  )
}
