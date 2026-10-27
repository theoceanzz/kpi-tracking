import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Plus, Trash2, Workflow } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import FilterBar from '@/components/common/FilterBar'
import DataTable from '@/components/common/DataTable'
import Pagination from '@/components/common/Pagination'
import BulkActionBar from '@/components/common/BulkActionBar'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import UserAvatar from '@/components/common/UserAvatar'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePermission } from '@/hooks/usePermission'
import { useFormat } from '@/i18n/useFormat'
import { usePageTitle } from '@/features/organization/hooks/usePageTitle'
import {
  useApprovalProcessCatalog,
  useApprovalProcessList,
  useDeleteApprovalProcesses,
  useSetApprovalProcessActive,
} from '../hooks/useApprovalProcesses'
import type { ApprovalObjectType, ApprovalProcess, PersonRef } from '../types'

const PAGE_SIZE = 20
const ALL = '__all__'

function Followers({ people }: { people: PersonRef[] }) {
  if (people.length === 0) return <span className="text-[var(--color-subtle-foreground)]">—</span>
  const shown = people.slice(0, 3)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex items-center">
          {shown.map((p, i) => (
            <UserAvatar
              key={p.id}
              fullName={p.name}
              avatarUrl={p.avatarUrl}
              className={`h-7 w-7 rounded-full border-2 border-[var(--color-card)] text-xs ${i > 0 ? '-ml-2' : ''}`}
              fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]"
            />
          ))}
          {people.length > shown.length && (
            <span className="-ml-2 flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-[var(--color-card)] bg-[var(--color-muted)] px-1 text-xs font-medium">
              +{people.length - shown.length}
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>{people.map((p) => p.name).join(', ')}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Thiết lập công ty › Quy trình duyệt: danh sách quy trình của tổ chức. Bấm một dòng để mở trang
 * sửa (khung vẽ cần cả màn hình nên không làm hộp thoại).
 */
export default function ApprovalProcessListSection() {
  const { t } = useTranslation('approvalProcess')
  const navigate = useNavigate()
  const { hasPermission } = usePermission()
  const { dateTime } = useFormat()
  const canManage = hasPermission('WORKFLOW:MANAGE')
  const pageTitle = usePageTitle('approval-processes', t('list.title'))

  const [keyword, setKeyword] = useState('')
  const [objectType, setObjectType] = useState<string>(ALL)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: catalog } = useApprovalProcessCatalog()
  const { data, isLoading } = useApprovalProcessList({
    keyword: keyword.trim() || undefined,
    objectType: objectType === ALL ? undefined : (objectType as ApprovalObjectType),
    page,
    size: PAGE_SIZE,
  })
  const setActive = useSetApprovalProcessActive()
  const remove = useDeleteApprovalProcesses()

  const rows = data?.content ?? []
  const formName = useMemo(() => new Map((catalog?.forms ?? []).map((f) => [f.id, f.name])), [catalog])
  const subLabel = (p: ApprovalProcess) =>
    p.subObjectTypes.length === 0 ? t('list.allSubObjects')
      : p.subObjectTypes.map((s) => p.objectType === 'FORM_REQUEST' ? formName.get(s) ?? t('list.unknownForm') : t(`subObjects.${s}`)).join(', ')
  // Ô lọc đối tượng gom theo nhóm (KPI · BSC · Quà thưởng · Đơn từ), như ô chọn ở trang sửa.
  const objectGroups = useMemo(() => {
    const out = new Map<string, NonNullable<typeof catalog>['objects']>()
    for (const o of catalog?.objects ?? []) out.set(o.group, [...(out.get(o.group) ?? []), o])
    return [...out.entries()]
  }, [catalog])

  const columns = [
    {
      key: 'createdBy',
      header: t('list.createdBy'),
      className: 'w-20',
      render: (p: ApprovalProcess) => p.createdBy ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <UserAvatar fullName={p.createdBy.name} avatarUrl={p.createdBy.avatarUrl} className="h-8 w-8 rounded-full text-xs" fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]" />
            </span>
          </TooltipTrigger>
          <TooltipContent>{p.createdBy.name}</TooltipContent>
        </Tooltip>
      ) : <span className="text-[var(--color-subtle-foreground)]">—</span>,
    },
    {
      key: 'title',
      header: t('list.processTitle'),
      render: (p: ApprovalProcess) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium">{p.title}</span>
          <span className="block text-caption">{t('list.stepCount', { count: p.stepCount })}</span>
        </span>
      ),
    },
    { key: 'object', header: t('list.object'), render: (p: ApprovalProcess) => t(`objects.${p.objectType}`) },
    {
      key: 'subObjects',
      header: t('list.subObjects'),
      render: (p: ApprovalProcess) => <span className="line-clamp-2">{subLabel(p)}</span>,
    },
    { key: 'type', header: t('list.approvalType'), render: () => t('list.typeProcess') },
    { key: 'followers', header: t('list.followers'), render: (p: ApprovalProcess) => <Followers people={p.followers} /> },
    {
      key: 'active',
      header: t('list.active'),
      className: 'w-28',
      render: (p: ApprovalProcess) => (
        <span onClick={(e) => e.stopPropagation()} className="inline-flex">
          <Switch
            size="sm"
            checked={p.active}
            disabled={!canManage || setActive.isPending}
            onCheckedChange={(active) => setActive.mutate({ id: p.id, active })}
            aria-label={t('list.toggleActive', { title: p.title })}
          />
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: t('list.createdAt'),
      className: 'whitespace-nowrap text-right',
      render: (p: ApprovalProcess) => <span className="tabular-nums">{dateTime(p.createdAt)}</span>,
    },
  ]

  const ids = [...selected]
  return (
    // Ứng dụng không có TooltipProvider chung (như InfoHint): bọc tại chỗ cho avatar trong bảng.
    <TooltipProvider delayDuration={150}>
    <div className="mx-auto max-w-[1600px] space-y-4">
      <WorkspaceHeader
        title={pageTitle}
        description={t('list.description')}
        stats={[{ label: t('list.processes'), value: data?.totalElements ?? 0, icon: Workflow }]}
        actions={canManage && (
          <Button onClick={() => navigate('/processes/approval-processes/new')}>
            <Plus aria-hidden="true" /> {t('list.add')}
          </Button>
        )}
      />

      {catalog && !catalog.chainMode && (
        <div className="flex items-start gap-2.5 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm text-[var(--color-warning)]">
          <AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{t('editor.notChainMode')}</span>
        </div>
      )}

      <FilterBar search={{ value: keyword, onChange: (v) => { setKeyword(v); setPage(0) }, placeholder: t('list.search') }}>
        <Select value={objectType} onValueChange={(v) => { setObjectType(v); setPage(0) }}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-52" aria-label={t('list.object')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('list.allObjects')}</SelectItem>
            {objectGroups.map(([group, objects]) => (
              <SelectGroup key={group}>
                <SelectLabel>{t(`objectGroups.${group}`)}</SelectLabel>
                {objects.map((o) => <SelectItem key={o.code} value={o.code}>{t(`objects.${o.code}`)}</SelectItem>)}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      {selected.size > 0 && canManage && (
        <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())} itemLabel={t('list.itemLabel')}>
          <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden="true" /> {t('list.delete')}
          </Button>
        </BulkActionBar>
      )}

      {isLoading ? (
        <LoadingSkeleton type="table" rows={6} />
      ) : rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)]">
          <EmptyState
            icon={Workflow}
            title={keyword || objectType !== ALL ? t('list.noMatch') : t('list.empty')}
            description={keyword || objectType !== ALL ? undefined : t('list.emptyHint')}
            action={canManage && !keyword && objectType === ALL && (
              <Button onClick={() => navigate('/processes/approval-processes/new')}>
                <Plus aria-hidden="true" /> {t('list.add')}
              </Button>
            )}
          />
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={rows}
            keyExtractor={(p) => p.id}
            onRowClick={(p) => navigate(`/processes/approval-processes/${p.id}`)}
            selectable={canManage}
            selectedKeys={selected}
            onSelectionChange={setSelected}
          />
          <Pagination
            currentPage={page}
            totalPages={Math.max(data?.totalPages ?? 1, 1)}
            totalElements={data?.totalElements ?? 0}
            size={PAGE_SIZE}
            onPageChange={setPage}
            itemLabel={t('list.itemLabel')}
          />
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate(ids, {
          onSuccess: () => { setSelected(new Set()); setConfirmDelete(false) },
        })}
        title={t('list.deleteTitle', { count: ids.length })}
        description={t('list.deleteDescription')}
        confirmLabel={t('list.delete')}
        loading={remove.isPending}
      />
    </div>
    </TooltipProvider>
  )
}
