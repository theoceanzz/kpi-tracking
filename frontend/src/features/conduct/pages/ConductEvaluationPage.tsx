import { useEffect, useMemo, useState } from 'react'
import { Building2, Search, ChevronRight, ArrowLeft, CheckCircle2, Clock, HeartHandshake } from 'lucide-react'
import { cn } from '@/lib/utils'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import UserAvatar from '@/components/common/UserAvatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import ConductSheetTable from '../components/ConductSheetTable'
import ConductTargetPicker from '../components/ConductTargetPicker'
import { useConductSheet, useConductSummary } from '../hooks/useConduct'
import type { ConductStatus, ConductTarget } from '../api/conductApi'

/**
 * Chấm hạnh kiểm cho nhân sự trong đơn vị: chọn đợt/kỳ và đơn vị → danh sách nhân sự kèm
 * trạng thái → mở phiếu của một người ra chấm.
 *
 * Danh sách và phiếu ở CÙNG một trang chứ không phải modal: phiếu là một bảng rộng có
 * ô nhập dài (dẫn chứng, nhận xét), nhét vào modal thì vừa chật vừa phải cuộn hai tầng.
 */

const flattenTree = (nodes: any[], level = 0): any[] => {
  let result: any[] = []
  nodes.forEach(node => {
    result.push({ ...node, levelLabel: '—'.repeat(level) + (level > 0 ? ' ' : '') + node.name })
    if (node.children?.length) result = result.concat(flattenTree(node.children, level + 1))
  })
  return result
}

const STATUS_META: Record<ConductStatus, { label: string; cls: string }> = {
  DRAFT: { label: 'Chưa chấm', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
  SELF_SUBMITTED: { label: 'Đã tự đánh giá', cls: 'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400' },
  REVIEWED: { label: 'Quản lý đã chấm', cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' },
}

export default function ConductEvaluationPage() {
  const user = useAuthStore(s => s.user)
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(orgId)

  const [target, setTarget] = useState<ConductTarget>({ scope: 'PERIOD', periodId: null, cycleId: null })
  const [orgUnitId, setOrgUnitId] = useState<string>(user?.memberships?.[0]?.orgUnitId || '')
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const { data: treeData } = useOrgUnitTree()
  const flatUnits = useMemo(() => (treeData ? flattenTree(treeData) : []), [treeData])
  useEffect(() => {
    if (!orgUnitId && flatUnits.length) setOrgUnitId(flatUnits[0].id)
  }, [flatUnits, orgUnitId])

  const { data: rows, isLoading } = useConductSummary(target, orgUnitId)
  const {
    data: sheet, isLoading: isSheetLoading,
    saveSelf, isSavingSelf, saveManager, isSavingManager,
  } = useConductSheet(target, selectedUserId ?? undefined)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows ?? []
    return (rows ?? []).filter(r => r.userName.toLowerCase().includes(q))
  }, [rows, search])

  const reviewedCount = (rows ?? []).filter(r => r.status === 'REVIEWED').length

  if (org && !org.enableConduct) {
    return (
      <EmptyState
        title="Tổ chức chưa bật chấm hạnh kiểm"
        description="Bật ở Thiết lập công cụ → Module & tính năng, rồi chỉnh bộ tiêu chí ở mục Thang điểm."
      />
    )
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        description="Chấm điểm hành vi cho nhân sự theo bộ tiêu chí có trọng số của tổ chức, theo từng đợt hoặc cả kỳ."
        stats={
          rows
            ? [
                { label: 'Nhân sự', value: rows.length, icon: HeartHandshake },
                { label: 'Đã chấm', value: reviewedCount },
              ]
            : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <ConductTargetPicker organizationId={orgId} value={target} onChange={setTarget} />
          <Select value={orgUnitId} onValueChange={setOrgUnitId}>
            <SelectTrigger className="w-[260px] h-10">
              <Building2 size={14} className="mr-2 shrink-0 text-[var(--color-muted-foreground)]" />
              <SelectValue placeholder="Chọn đơn vị" />
            </SelectTrigger>
            <SelectContent className="z-[1100]">
              {flatUnits.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.levelLabel}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </WorkspaceHeader>

      {selectedUserId ? (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedUserId(null)}
            className="flex items-center gap-2 px-4 h-10 rounded-xl bg-[var(--color-muted)] text-[var(--color-muted-foreground)] text-xs font-black uppercase tracking-widest hover:text-[var(--color-primary)] transition-all"
          >
            <ArrowLeft size={14} /> Danh sách nhân sự
          </button>

          {isSheetLoading && <LoadingSkeleton rows={6} />}
          {!isSheetLoading && sheet && (
            <>
              <div className="flex items-center gap-3">
                <UserAvatar
                  fullName={sheet.userName}
                  avatarUrl={sheet.userAvatarUrl}
                  className="w-11 h-11 rounded-2xl"
                />
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{sheet.userName}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {[sheet.targetName, sheet.criteriaSetName, STATUS_META[sheet.status].label]
                      .filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              <ConductSheetTable
                sheet={sheet}
                onSaveSelf={saveSelf}
                onSaveManager={saveManager}
                isSavingSelf={isSavingSelf}
                isSavingManager={isSavingManager}
              />
            </>
          )}
        </div>
      ) : (
        <section className="bg-[var(--color-card)] rounded-3xl border border-[var(--color-border)] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center gap-3">
            <Search size={16} className="text-[var(--color-muted-foreground)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm nhân sự…"
              className="flex-1 bg-transparent outline-none text-sm font-medium"
            />
          </div>

          {isLoading && <div className="p-6"><LoadingSkeleton rows={5} /></div>}

          {!isLoading && filtered.length === 0 && (
            <EmptyState
              title="Chưa có nhân sự"
              description="Chọn đợt/kỳ và đơn vị có nhân sự để bắt đầu chấm hạnh kiểm."
            />
          )}

          {!isLoading && filtered.length > 0 && (
            <div className="divide-y divide-[var(--color-border)]">
              {filtered.map(row => (
                <button
                  key={row.userId}
                  onClick={() => setSelectedUserId(row.userId)}
                  className="w-full px-6 py-4 flex items-center gap-4 hover:bg-[var(--color-muted)] transition-all text-left"
                >
                  <UserAvatar
                    fullName={row.userName}
                    avatarUrl={row.userAvatarUrl}
                    className="w-10 h-10 rounded-xl shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-900 dark:text-white truncate">{row.userName}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate">
                      {[row.roleName, row.orgUnitName].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>

                  <div className="hidden sm:flex items-center gap-6 shrink-0">
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tự đánh giá</p>
                      <p className="text-sm font-black text-teal-600 dark:text-teal-400">{row.selfScore ?? '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Quản lý</p>
                      <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{row.managerScore ?? '—'}</p>
                    </div>
                  </div>

                  <span className={cn(
                    'shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider',
                    STATUS_META[row.status].cls
                  )}>
                    {row.status === 'REVIEWED' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                    {STATUS_META[row.status].label}
                  </span>
                  <ChevronRight size={16} className="text-slate-300 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
