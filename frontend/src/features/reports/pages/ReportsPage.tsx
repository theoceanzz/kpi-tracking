import { intlDateLocale } from '@/i18n/format'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { BarChart3, Plus, Trash2, Edit, FileBarChart } from 'lucide-react'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import FilterBar from '@/components/common/FilterBar'
import EmptyState from '@/components/common/EmptyState'
import EntityCard from '@/components/common/EntityCard'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Pagination from '@/components/common/Pagination'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useReports } from '../hooks/useReports'
import { useCreateReport, useDeleteReport } from '../hooks/useReportMutations'
import { createReportSchema, type CreateReportFormData } from '../schemas/reportSchema'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'
import { useFormDraft } from '@/hooks/useFormDraft'
import DraftNotice from '@/components/common/DraftNotice'

const STATUS_LABELS = perLanguage((): Record<string, { label: string; variant: 'warning' | 'success' | 'secondary' }> => ({
  DRAFT: { label: i18n.t('reports:ReportsPage.draft'), variant: 'warning' },
  PUBLISHED: { label: i18n.t('reports:ReportsPage.published'), variant: 'success' },
  ARCHIVED: { label: i18n.t('reports:ReportsPage.archived'), variant: 'secondary' },
}))

export default function ReportsPage() {
  const { t } = useTranslation('reports')
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useReports({ page, size: 20 })
  const createMutation = useCreateReport()
  const deleteMutation = useDeleteReport()

  const filtered = data?.content?.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  ) || []

  const formApi = useForm<CreateReportFormData>({
    resolver: zodResolver(createReportSchema()),
    defaultValues: { name: '', description: '' },
  })
  const { register, handleSubmit, reset, formState: { errors } } = formApi
  const draft = useFormDraft(formApi, { key: 'report:new', enabled: showCreate })

  const handleCreate = handleSubmit((data) => {
    createMutation.mutate({ name: data.name, description: data.description || undefined }, {
      onSuccess: (report) => {
        setShowCreate(false)
        reset({ name: '', description: '' })
        navigate(`/reports/${report.id}`)
      }
    })
  })

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <WorkspaceHeader
        title={t('ReportsPage.statisticalReports')}
        description={t('ReportsPage.dashboardsMadeOfChartsBuiltFrom')}
        stats={[{ label: t('ReportsPage.reports'), value: data?.totalElements ?? 0, icon: FileBarChart }]}
        actions={<Button onClick={() => setShowCreate(true)}><Plus aria-hidden="true" /> {t('ReportsPage.createReport')}</Button>}
      />

      <FilterBar search={{ value: search, onChange: setSearch, placeholder: t('ReportsPage.searchReports') }} />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-36 animate-pulse rounded-card bg-[var(--color-muted)]" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
          <EmptyState
            icon={FileBarChart}
            title={search ? t('ReportsPage.noReportFound') : t('ReportsPage.noReportsYet')}
            description={search ? t('ReportsPage.tryAnotherKeywordOrClearThe') : t('ReportsPage.createTheFirstReportConnectA')}
            action={!search ? <Button onClick={() => setShowCreate(true)}><Plus aria-hidden="true" /> {t('ReportsPage.createReport')}</Button> : undefined}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(report => {
            const st = STATUS_LABELS()[report.status]
            return (
              <EntityCard
                key={report.id}
                leading={<BarChart3 />}
                title={report.name}
                description={report.description}
                meta={<><span>{report.datasources?.length || 0} {t('ReportsPage.dataSources')}</span><span aria-hidden="true">·</span><span>{report.widgets?.length || 0} {t('ReportsPage.charts')}</span></>}
                footerLeft={<Badge variant={st?.variant ?? 'secondary'}>{st?.label ?? report.status}</Badge>}
                footerRight={new Date(report.createdAt).toLocaleDateString(intlDateLocale())}
                onOpen={() => navigate(`/reports/${report.id}`)}
                menu={[
                  { label: t('ReportsPage.openEdit'), icon: <Edit />, onClick: () => navigate(`/reports/${report.id}`) },
                  { label: t('ReportsPage.delete'), icon: <Trash2 />, destructive: true, onClick: () => setDeleteId(report.id) },
                ]}
              />
            )
          })}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={data.totalPages} totalElements={data.totalElements} size={20} onPageChange={setPage} itemLabel={t('ReportsPage.reports2')} />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId, { onSettled: () => setDeleteId(null) }) }}
        title={t('ReportsPage.deleteReport')}
        description={t('ReportsPage.theChartsInTheReportWill')}
        confirmLabel={t('ReportsPage.deleteReport2')}
        loading={deleteMutation.isPending}
      />

      {/* Tạo mới */}
      <Dialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        size="md"
        dismissible={!createMutation.isPending}
        title={t('ReportsPage.createANewReport')}
        footer={
          <DialogFooter
            secondary={<Button variant="outline" onClick={() => setShowCreate(false)} disabled={createMutation.isPending}>{t('ReportsPage.cancel')}</Button>}
            primary={<Button onClick={handleCreate} disabled={createMutation.isPending}>{createMutation.isPending ? t('ReportsPage.creating') : t('ReportsPage.create')}</Button>}
          />
        }
      >
        <DraftNotice draft={draft} className="mb-4" />
        <div className="space-y-4">
          <div>
            <label className="text-label block font-medium mb-1.5">{t('ReportsPage.reportName')} <span className="text-[var(--color-error)]">*</span></label>
            <input {...register('name')} placeholder={t('ReportsPage.eGQ1RevenueReport')} className="w-full px-3 py-2.5 rounded-control border border-[var(--color-border)] bg-[var(--color-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30" autoFocus />
            {errors.name && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.name.message}</p>}
          </div>
          <div>
            <label className="text-label block font-medium mb-1.5">{t('ReportsPage.description')}</label>
            <textarea {...register('description')} placeholder={t('ReportsPage.shortDescription')} rows={3} className="w-full px-3 py-2.5 rounded-control border border-[var(--color-border)] bg-[var(--color-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 resize-none" />
          </div>
        </div>
      </Dialog>
    </div>
  )
}
