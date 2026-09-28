import { intlDateLocale } from '@/i18n/format'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { Database, Plus, Trash2, Edit, Table2, BarChart3 } from 'lucide-react'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import FilterBar from '@/components/common/FilterBar'
import EmptyState from '@/components/common/EmptyState'
import EntityCard from '@/components/common/EntityCard'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Pagination from '@/components/common/Pagination'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useDatasources } from '../hooks/useDatasources'
import { useCreateDatasource, useDeleteDatasource } from '../hooks/useDatasourceMutations'
import { createDatasourceSchema, type CreateDatasourceFormData } from '../schemas/datasourceSchema'
import type { Datasource } from '@/types/datasource'
import { useTranslation } from 'react-i18next'
import { useFormDraft } from '@/hooks/useFormDraft'
import DraftNotice from '@/components/common/DraftNotice'

export default function DatasourcesPage() {
  const { t } = useTranslation('datasources')
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useDatasources({ page, size: 20 })
  const createMutation = useCreateDatasource()
  const deleteMutation = useDeleteDatasource()

  const filtered = data?.content?.filter(ds =>
    ds.name.toLowerCase().includes(search.toLowerCase())
  ) || []

  const formApi = useForm<CreateDatasourceFormData>({
    resolver: zodResolver(createDatasourceSchema()),
    defaultValues: { name: '', description: '' },
  })
  const { register, handleSubmit, reset, formState: { errors } } = formApi
  const draft = useFormDraft(formApi, { key: 'datasource:new', enabled: showCreate })

  const handleCreate = handleSubmit((data) => {
    createMutation.mutate({ name: data.name, description: data.description || undefined }, {
      onSuccess: () => { setShowCreate(false); reset({ name: '', description: '' }) }
    })
  })

  const getTypeIcon = (ds: Datasource) => ((ds.columns?.length || 0) === 0 ? <Table2 /> : <Database />)

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <WorkspaceHeader
        title={t('DatasourcesPage.dataSources')}
        description={t('DatasourcesPage.manuallyEnteredTablesLikeExcelUsed')}
        stats={[{ label: t('DatasourcesPage.dataSources'), value: data?.totalElements ?? 0, icon: Database }]}
        actions={<Button onClick={() => setShowCreate(true)}><Plus aria-hidden="true" /> {t('DatasourcesPage.createDataSource')}</Button>}
      />

      <FilterBar search={{ value: search, onChange: setSearch, placeholder: t('DatasourcesPage.searchDataSources') }} />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-36 animate-pulse rounded-card bg-[var(--color-muted)]" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
          <EmptyState
            icon={Database}
            title={search ? t('DatasourcesPage.noDataSourceFound') : t('DatasourcesPage.noDataSourcesYet')}
            description={search ? t('DatasourcesPage.tryAnotherKeywordOrClearThe') : t('DatasourcesPage.createTheFirstDataSourceThen')}
            action={!search ? <Button onClick={() => setShowCreate(true)}><Plus aria-hidden="true" /> {t('DatasourcesPage.createDataSource')}</Button> : undefined}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(ds => (
            <EntityCard
              key={ds.id}
              leading={ds.icon ? <span className="text-lg">{ds.icon}</span> : getTypeIcon(ds)}
              title={ds.name}
              description={ds.description}
              meta={<><span className="flex items-center gap-1"><Table2 size={12} aria-hidden="true" /> {ds.columns?.length || 0} {t('DatasourcesPage.columns')}</span><span className="flex items-center gap-1"><BarChart3 size={12} aria-hidden="true" /> {ds.rowCount} {t('DatasourcesPage.rows')}</span></>}
              footerLeft={ds.orgUnitName}
              footerRight={new Date(ds.createdAt).toLocaleDateString(intlDateLocale())}
              onOpen={() => navigate(`/datasources/${ds.id}`)}
              menu={[
                { label: t('DatasourcesPage.openEdit'), icon: <Edit />, onClick: () => navigate(`/datasources/${ds.id}`) },
                { label: t('DatasourcesPage.delete'), icon: <Trash2 />, destructive: true, onClick: () => setDeleteId(ds.id) },
              ]}
            />
          ))}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={data.totalPages} totalElements={data.totalElements} size={20} onPageChange={setPage} itemLabel={t('DatasourcesPage.dataSources2')} />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId, { onSettled: () => setDeleteId(null) }) }}
        title={t('DatasourcesPage.deleteDataSource')}
        description={t('DatasourcesPage.allColumnsAndRowsWillBe')}
        confirmLabel={t('DatasourcesPage.deleteDataSource2')}
        loading={deleteMutation.isPending}
      />

      {/* Tạo mới */}
      <Dialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        size="md"
        dismissible={!createMutation.isPending}
        title={t('DatasourcesPage.createANewDataSource')}
        footer={
          <DialogFooter
            secondary={<Button variant="outline" onClick={() => setShowCreate(false)} disabled={createMutation.isPending}>{t('DatasourcesPage.cancel')}</Button>}
            primary={<Button onClick={handleCreate} disabled={createMutation.isPending}>{createMutation.isPending ? t('DatasourcesPage.creating') : t('DatasourcesPage.create')}</Button>}
          />
        }
      >
        <DraftNotice draft={draft} className="mb-4" />
        <div className="space-y-4">
          <div>
            <label className="text-label block font-medium mb-1.5">{t('DatasourcesPage.dataSourceName')} <span className="text-[var(--color-error)]">*</span></label>
            <input
              type="text"
              {...register('name')}
              placeholder="VD: Doanh thu Q1 2026"
              className="w-full px-3 py-2.5 rounded-control border border-[var(--color-border)] bg-[var(--color-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
              autoFocus
            />
            {errors.name && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.name.message}</p>}
          </div>
          <div>
            <label className="text-label block font-medium mb-1.5">{t('DatasourcesPage.description')}</label>
            <textarea
              {...register('description')}
              placeholder={t('DatasourcesPage.shortDescription')}
              rows={3}
              className="w-full px-3 py-2.5 rounded-control border border-[var(--color-border)] bg-[var(--color-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 resize-none"
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}
