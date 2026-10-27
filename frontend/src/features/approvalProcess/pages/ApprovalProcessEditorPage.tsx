import { useCallback, useMemo, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Info, Loader2, Save, Workflow } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import DraftNotice from '@/components/common/DraftNotice'
import { InfoHint } from '@/components/common/InfoHint'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useStateDraft } from '@/hooks/useFormDraft'
import { usePermission } from '@/hooks/usePermission'
import {
  useApprovalProcess,
  useApprovalProcessCatalog,
  useSaveApprovalProcess,
} from '../hooks/useApprovalProcesses'
import { useProcessOptions } from '../hooks/useProcessOptions'
import { useGraphHistory } from '../model/useGraphHistory'
import { emptyGraph, validateGraph } from '../model/processGraphModel'
import { CHAIN_MODE_OBJECTS, type ApprovalProcess, type ApprovalProcessCatalog, type PersonRef, type ProcessGraph } from '../types'
import ProcessInfoForm, { type ProcessInfo } from '../components/ProcessInfoForm'
import ProcessDesigner from '../components/ProcessDesigner'
import { formConditionFields } from '@/features/approvalForms/model/formIssues'
import i18n from 'i18next'

export const APPROVAL_PROCESS_LIST_PATH = '/processes?section=approval-processes'

interface EditorState {
  info: ProcessInfo
  graph: ProcessGraph
  /** Tên những người đã nhắc tới (chip người duyệt, điều kiện "người gửi", người theo dõi). */
  users: Record<string, PersonRef>
}

const snapshot = (s: { info: ProcessInfo; graph: ProcessGraph }) => JSON.stringify({ info: s.info, graph: s.graph })

function initialState(process: ApprovalProcess | null): EditorState {
  const users: Record<string, PersonRef> = { ...(process?.refUsers ?? {}) }
  for (const f of process?.followers ?? []) users[f.id] = f
  return {
    info: {
      title: process?.title ?? '',
      objectType: process?.objectType ?? null,
      subObjectTypes: process?.subObjectTypes ?? [],
      followers: process?.followers ?? [],
      showInObject: process?.showInObject ?? false,
      active: process?.active ?? true,
    },
    graph: process?.definition ?? emptyGraph(),
    users,
  }
}

/**
 * Trang tạo / sửa quy trình duyệt (/processes/approval-processes/new | /:id): form thông tin phía
 * trên, khung vẽ sơ đồ chiếm phần còn lại. Toàn bộ trang giữ bản nháp trên máy (form + sơ đồ),
 * rời trang khi chưa lưu thì hỏi lại.
 */
export default function ApprovalProcessEditorPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const { t } = useTranslation('approvalProcess')
  const navigate = useNavigate()
  const { data: process, isLoading, isError } = useApprovalProcess(isNew ? undefined : id)
  const { data: catalog } = useApprovalProcessCatalog()

  if (!isNew && isLoading) {
    return <div className="mx-auto max-w-[1600px]"><LoadingSkeleton type="form" rows={6} /></div>
  }
  if (!isNew && (isError || !process)) {
    return (
      <div className="mx-auto max-w-[1600px]">
        <EmptyState
          icon={Workflow}
          title={t('editor.notFound')}
          description={t('editor.notFoundHint')}
          action={<Button variant="outline" onClick={() => navigate(APPROVAL_PROCESS_LIST_PATH)}>{t('editor.backToList')}</Button>}
        />
      </div>
    )
  }
  return <Editor key={process?.id ?? 'new'} process={process ?? null} catalog={catalog} />
}

function Editor({ process, catalog }: { process: ApprovalProcess | null; catalog: ApprovalProcessCatalog | undefined }) {
  const { t } = useTranslation('approvalProcess')
  const navigate = useNavigate()
  const { hasPermission } = usePermission()
  const readOnly = process ? !process.canManage : !hasPermission('WORKFLOW:MANAGE')
  const options = useProcessOptions()
  const save = useSaveApprovalProcess()

  const initial = useMemo(() => initialState(process), [process])
  const [info, setInfo] = useState<ProcessInfo>(initial.info)
  const [users, setUsers] = useState<Record<string, PersonRef>>(initial.users)
  const history = useGraphHistory(initial.graph)
  const versionRef = useRef(process?.version)
  const [baseline, setBaseline] = useState(() => snapshot(initial))
  const leavingRef = useRef(false)

  const [showErrors, setShowErrors] = useState(false)
  const [issuesOpen, setIssuesOpen] = useState(false)

  // Bản nháp: form + sơ đồ (+ tên người để chip hiện đúng). Khôi phục nháp thì lịch sử hoàn tác
  // bắt đầu lại từ bản nháp.
  const combined = useMemo<EditorState>(() => ({ info, graph: history.graph, users }), [info, history.graph, users])
  const { reset: resetGraph } = history
  const applyDraft = useCallback((v: EditorState) => {
    setInfo(v.info)
    setUsers(v.users ?? {})
    resetGraph(v.graph)
  }, [resetGraph])
  const draftKey = process ? `approval-process:${process.id}` : 'approval-process:new'
  const draft = useStateDraft(combined, applyDraft, { key: draftKey, enabled: !readOnly })

  const dirty = !readOnly && snapshot(combined) !== baseline
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirty && !leavingRef.current && currentLocation.pathname !== nextLocation.pathname)

  // Quy trình đơn từ gắn đúng MỘT đơn ⇒ điều kiện rẽ nhánh dùng được trường số / lựa chọn của đơn đó.
  const formFields = useMemo(() => {
    if (info.objectType !== 'FORM_REQUEST' || info.subObjectTypes.length !== 1) return undefined
    const form = catalog?.forms?.find((f) => f.id === info.subObjectTypes[0])
    return form ? formConditionFields(form.schema, (w) => w.durationLabel
      || (w.durationUnit === 'HOUR' ? i18n.t('approvalForms:settings.unitHour') : i18n.t('approvalForms:settings.unitDay'))) : undefined
  }, [info.objectType, info.subObjectTypes, catalog])
  const issues = useMemo(() => validateGraph(history.graph, info.objectType, catalog, formFields),
    [history.graph, info.objectType, catalog, formFields])
  const errors = issues.filter((i) => i.severity === 'error')

  const addUsers = useCallback((people: PersonRef[]) => {
    setUsers((u) => {
      const next = { ...u }
      for (const p of people) next[p.id] = p
      return next
    })
  }, [])

  const patchInfo = (patch: Partial<ProcessInfo>) => setInfo((i) => ({ ...i, ...patch }))

  const goBack = () => navigate(APPROVAL_PROCESS_LIST_PATH)

  const onSave = async () => {
    setShowErrors(true)
    // Sơ đồ còn lỗi thì mở luôn danh sách việc còn thiếu ngay trên khung vẽ — kể cả khi form phía
    // trên cũng thiếu — thay vì để người dùng tự đi tìm.
    if (errors.length) setIssuesOpen(true)
    if (!info.title.trim() || !info.objectType) {
      toast.error(t('editor.fillRequired'))
      return
    }
    if (errors.length) {
      toast.error(t('editor.fixDiagram', { count: errors.length }))
      return
    }
    const saved = await save.mutateAsync({
      id: process?.id,
      data: {
        title: info.title.trim(),
        objectType: info.objectType,
        subObjectTypes: info.subObjectTypes,
        followerIds: info.followers.map((f) => f.id),
        showInObject: info.showInObject,
        active: info.active,
        definition: history.graph,
        version: versionRef.current,
      },
    }).catch(() => null)
    if (!saved) return
    draft.clear()
    versionRef.current = saved.version
    setBaseline(snapshot(combined))
    if (!process) {
      leavingRef.current = true
      navigate(`/processes/approval-processes/${saved.id}`, { replace: true })
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" onClick={goBack} aria-label={t('editor.backToList')} title={t('editor.backToList')}>
          <ArrowLeft aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-page-title">
            {process ? t('editor.editTitle') : t('editor.createTitle')}
          </h1>
          <p className="truncate text-caption">{process?.title ?? t('editor.createHint')}</p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            {dirty && <span className="hidden text-caption sm:inline">{t('editor.unsaved')}</span>}
            <Button variant="outline" onClick={goBack}>{t('common.cancel')}</Button>
            <Button onClick={onSave} disabled={save.isPending}>
              {save.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
              {process ? t('common.update') : t('common.save')}
            </Button>
          </div>
        )}
      </div>

      <DraftNotice draft={draft} />

      {catalog && !catalog.chainMode && info.objectType && CHAIN_MODE_OBJECTS.includes(info.objectType) && (
        <div className="flex items-start gap-2.5 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm text-[var(--color-warning)]">
          <AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{t('editor.notChainMode')}</span>
        </div>
      )}
      {readOnly && (
        <div className="flex items-start gap-2.5 rounded-card border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-4 py-3 text-sm text-[var(--color-info)]">
          <Info size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{t('editor.readOnly')}</span>
        </div>
      )}

      <section className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4 sm:p-5">
        <ProcessInfoForm
          value={info}
          onChange={patchInfo}
          catalog={catalog}
          readOnly={readOnly}
          showErrors={showErrors}
          onUsers={addUsers}
        />
      </section>

      <section className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="text-section-title">
            {t('editor.processSetup')} <span className="text-[var(--color-error)]">*</span>
          </h2>
          <InfoHint label={t('common.moreInfo')} side="bottom">
            {readOnly ? t('editor.canvasHintReadOnly') : t('editor.canvasHint')}
            {process?.active && !readOnly && <span className="mt-1 block">{t('editor.appliesToNextSubmissions')}</span>}
          </InfoHint>
        </div>
        <ProcessDesigner
          history={history}
          issues={issues}
          objectType={info.objectType}
          catalog={catalog}
          options={options}
          users={users}
          onUsers={addUsers}
          readOnly={readOnly}
          draftKey={draftKey}
          formFields={formFields}
          issuesPopover={{ open: issuesOpen, onOpenChange: setIssuesOpen }}
          className="h-[calc(100vh-260px)] min-h-[560px]"
        />
      </section>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        title={t('editor.leaveTitle')}
        description={t('editor.leaveDescription')}
        confirmLabel={t('editor.leave')}
      />
    </div>
  )
}
