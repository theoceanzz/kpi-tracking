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
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

const SCOPE_LABEL = perLanguage((): Record<RewardProgramScope, string> => ({
  [RewardProgramScope.CYCLE]: i18n.t('rewards:ProgramsTab.byCycle'),
  [RewardProgramScope.PERIOD]: i18n.t('rewards:ProgramsTab.byPeriod'),
}))

const METRIC_LABEL = perLanguage((): Record<RewardRankingMetric, string> => ({
  [RewardRankingMetric.FINAL_SCORE]: i18n.t('rewards:ProgramsTab.cycleFinalizedScore'),
  [RewardRankingMetric.MATRIX_RATING]: i18n.t('rewards:ProgramsTab.rating'),
  [RewardRankingMetric.PERFORMANCE]: i18n.t('rewards:ProgramsTab.performanceScore'),
}))

/** Mô tả bậc thưởng thành một dòng đọc được: "Hạng 1: 500đ · Hạng 2–3: 300đ". */
const tierSummary = (p: RewardProgram) =>
  p.tiers
    .map((t) =>
      t.fromRank === t.toRank
        ? i18n.t('rewards:ProgramsTab.rank', { fromRank: t.fromRank, points: t.points })
        : i18n.t('rewards:ProgramsTab.rank2', { fromRank: t.fromRank, toRank: t.toRank, points: t.points }),
    )
    .join(' · ')

export default function ProgramsTab() {
  const { t } = useTranslation('rewards')
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
          {t('ProgramsTab.programs')} <b>{t('ProgramsTab.doesNotRunByItself')}</b>{t('ProgramsTab.modeClick')} <b>{t('ProgramsTab.run')}</b> {t('ProgramsTab.toChooseAPeriodCycleEdit')}
          <b> {t('ProgramsTab.default')}</b>{t('ProgramsTab.pointsFromProgramsComeFromThe')}
        </p>
      </div>

      <div id="tour-programs-actions" className="mb-4 flex items-center justify-between gap-3">
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {(data ?? []).length > 0 && t('ProgramsTab.programs2', { count: (data ?? []).length })}
        </span>
        <WorkspaceHeaderActions>
          <Button onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}>
            <Plus aria-hidden="true" />
            {t('ProgramsTab.createProgram')}
          </Button>
        </WorkspaceHeaderActions>
      </div>

      {isLoading ? (
        <LoadingSkeleton type="table" rows={3} />
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)]">
          <EmptyState
            title={t('ProgramsTab.noAutomaticRewardProgramsYet')}
            description={t('ProgramsTab.insteadOfPickingPeopleByHand')}
            action={
              <Button onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}>
                <Plus aria-hidden="true" />
                {t('ProgramsTab.createTheFirstProgram')}
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
                    {SCOPE_LABEL()[row.scope]} · {METRIC_LABEL()[row.metric]} ·{' '}
                    {row.orgUnitName ?? t('ProgramsTab.organizationWide')}
                  </div>
                </div>
                {!row.enabled && (
                  <span className="flex-shrink-0 rounded-full bg-[var(--color-muted)] px-2.5 py-1 text-xs text-[var(--color-muted-foreground)]">
                    {t('ProgramsTab.off')}
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--color-muted-foreground)]">{tierSummary(row)}</div>
              <div className="flex gap-2 border-t border-[var(--color-border)] pt-2.5">
                <Button className="flex-1" onClick={() => setRunning(row)} disabled={!row.enabled}>
                  {t('ProgramsTab.run2')}
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
              header: t('ProgramsTab.programs'),
              render: (row) => (
                <div>
                  <div className="flex items-center gap-1.5 font-medium">
                    <Trophy size={14} className="text-[var(--color-primary)]" />
                    {row.name}
                  </div>
                  {/* Ghi rõ "mặc định": bậc này chỉ là điểm khởi đầu, mỗi lần chạy sửa
                      được cho riêng kỳ/đợt đó. Không nói thì người dùng tưởng đã cố định. */}
                  <div className="text-xs text-[var(--color-muted-foreground)]">
                    {t('ProgramsTab.default2')} {tierSummary(row)}
                  </div>
                </div>
              ),
            },
            {
              key: 'scope',
              className: 'align-top',
              header: t('ProgramsTab.appliesTo'),
              render: (row) => (
                <div>
                  {/* Gắn cứng một kỳ hay dùng chung là điều đầu tiên người quản lý cần
                      biết khi nhìn danh sách — nó quyết định bấm Chạy sẽ ra màn hình nào. */}
                  <div>
                    {row.fixedTargetName ?? t('ProgramsTab.every', { value: row.scope === RewardProgramScope.CYCLE ? t('ProgramsTab.cycle') : t('ProgramsTab.period') })}
                  </div>
                  <div className="text-xs text-[var(--color-muted-foreground)]">
                    {SCOPE_LABEL()[row.scope]} · {METRIC_LABEL()[row.metric]}
                  </div>
                </div>
              ),
            },
            {
              key: 'orgUnit',
              className: 'align-top',
              header: t('ProgramsTab.scope'),
              render: (row) => row.orgUnitName ?? t('ProgramsTab.organizationWide'),
            },
            {
              key: 'issuedRunCount',
              className: 'text-right align-top',
              header: t('ProgramsTab.awarded'),
              render: (row) => (
                <span className={row.issuedRunCount > 0 ? 'font-semibold' : ''}>
                  {row.issuedRunCount} {t('ProgramsTab.times')}
                </span>
              ),
            },
            {
              key: 'enabled',
              className: 'align-top',
              header: t('ProgramsTab.status'),
              render: (row) => (
                <div>
                  {row.enabled ? (
                    <span className="inline-block rounded-full bg-[var(--color-success-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-success)]">
                      {t('ProgramsTab.on')}
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-[var(--color-muted)] px-2.5 py-1 text-xs font-medium text-[var(--color-muted-foreground)]">
                      {t('ProgramsTab.off')}
                    </span>
                  )}
                  {/* Chương trình tự phát thì điểm vào ví không ai bấm — phải nhìn thấy
                      được ngay ở danh sách, không giấu trong màn hình sửa. */}
                  {row.enabled && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
                      {row.autoTrigger ? (
                        <>
                          <Zap size={11} className="text-[var(--color-warning)]" />
                          {t('ProgramsTab.awardsAutomaticallyAtTheEnd')}
                        </>
                      ) : (
                        t('ProgramsTab.manualAward')
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
                        ? t('ProgramsTab.runChooseTheCyclePeriodEdit')
                        : t('ProgramsTab.theProgramIsOff')
                    } onClick={() => setRunning(row)} disabled={!row.enabled} title={
                      row.enabled
                        ? t('ProgramsTab.runChooseTheCyclePeriodEdit')
                        : t('ProgramsTab.theProgramIsOff')
                    }>
                    <Play aria-hidden="true" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={t('ProgramsTab.awardHistory')} onClick={() => setViewingRuns(row)} title={t('ProgramsTab.awardHistory')}>
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
                        ? t('ProgramsTab.rewardsHaveBeenGivenCannotBe')
                        : t('ProgramsTab.delete')
                    } onClick={() => setDeleting(row)} disabled={row.issuedRunCount > 0} title={
                      row.issuedRunCount > 0
                        ? t('ProgramsTab.rewardsHaveBeenGivenCannotBe')
                        : t('ProgramsTab.delete')
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
        title={t('ProgramsTab.deleteTheRewardProgram')}
        description={
          deleting
            ? t('ProgramsTab.willBeDeletedOnlyProgramsThat', { name: deleting.name }) +
              t('ProgramsTab.ifItHasAwardedTurnThe')
            : ''
        }
        confirmLabel={t('ProgramsTab.delete')}
        loading={isDeleting}
      />
    </div>
  )
}
