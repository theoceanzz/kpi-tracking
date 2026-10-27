import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronUp, Eye, FileText, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import DraftNotice from '@/components/common/DraftNotice'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { blockedByTour } from '@/components/common/tours/guard'
import { tourAnchor } from '@/components/common/tours/anchors'
import { useStateDraft } from '@/hooks/useFormDraft'
import { useFormat } from '@/i18n/useFormat'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import ProcessDesigner from '@/features/approvalProcess/components/ProcessDesigner'
import { PeopleSearchContext } from '@/features/approvalProcess/components/pickers/peopleSearch'
import { useGraphHistory } from '@/features/approvalProcess/model/useGraphHistory'
import { emptyGraph, validateGraph, type GraphIssue } from '@/features/approvalProcess/model/processGraphModel'
import type { ProcessOptions } from '@/features/approvalProcess/hooks/useProcessOptions'
import type { PersonRef, ProcessGraph } from '@/features/approvalProcess/types'
import {
  useCreateGroup, useFormAdmin, useFormDetail, useFormLibrary, useFormProcessOptions, useSaveForm,
} from '../hooks/useApprovalForms'
import { pickName } from '../model/formState'
import { basicIssues, formConditionFields, schemaIssues, type EditorStep, type FormIssue } from '../model/formIssues'
import { ALL_ADMIN_PERMISSIONS, type FormAdminPermission, type FormDetail, type FormGroup, type FormSchema, type LibraryTemplate, type Ref } from '../types'
import BasicInfoStep, { type EditorInfo } from '../components/editor/BasicInfoStep'
import FormDesignStep from '../components/editor/FormDesignStep'
import FormPreview from '../components/FormPreview'
import LocalizedNameDialog from '../components/LocalizedNameDialog'
import { DEFAULT_COLOR, DEFAULT_ICON } from '../model/icons'
import { directoryPeopleSearch } from '../api/approvalFormsApi'

export const ADMIN_LIST_PATH = '/requests?tab=admin'

interface Initial {
  info: EditorInfo
  schema: FormSchema
  graph: ProcessGraph
  users: Record<string, PersonRef>
  templateCode: string | null
}

interface DraftState {
  info: EditorInfo
  schema: FormSchema
  graph: ProcessGraph
  users: Record<string, PersonRef>
}

const snapshot = (s: Omit<DraftState, 'users'>) => JSON.stringify({ info: s.info, schema: s.schema, graph: s.graph })

function fromDetail(d: FormDetail, copySuffix?: string): Initial {
  const suffix = (v?: string) => (v && copySuffix ? `${v} ${copySuffix}` : v)
  return {
    info: {
      icon: d.icon,
      color: d.color,
      name: copySuffix ? { vi: suffix(d.name.vi), en: suffix(d.name.en) } : d.name,
      description: d.description,
      groupId: d.groupId,
      submitterScope: d.submitterScope,
      submitterUsers: d.submitterUsers,
      submitterUnits: d.submitterUnits,
      admins: d.admins,
    },
    schema: d.schema,
    graph: d.process ?? emptyGraph(),
    users: d.refUsers ?? {},
    templateCode: d.templateCode,
  }
}

function fromTemplate(tpl: LibraryTemplate | null, groups: FormGroup[]): Initial {
  return {
    info: {
      icon: tpl?.icon ?? DEFAULT_ICON,
      color: tpl?.color ?? DEFAULT_COLOR,
      name: tpl?.name ?? {},
      description: tpl?.description ?? {},
      groupId: groups.find((g) => g.code && g.code === tpl?.category)?.id ?? null,
      submitterScope: 'ALL',
      submitterUsers: [],
      submitterUnits: [],
      admins: [],
    },
    schema: tpl?.schema ?? { widgets: [] },
    graph: tpl?.process ?? emptyGraph(),
    users: {},
    templateCode: tpl?.code ?? null,
  }
}

/**
 * Trình sửa đơn từ toàn màn hình (/requests/admin/forms/new?template=…|copy=… và /:id) — 4 bước như Lark:
 * Thông tin cơ bản · Thiết kế form · Quy trình duyệt · Khác. Giữ bản nháp trên máy, rời trang khi chưa phát hành thì
 * hỏi lại. Phát hành khi còn thiếu ⇒ nhảy tới bước có lỗi đầu tiên và mở hộp "N chỗ chưa xong".
 */
export default function FormEditorPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const isNew = !id || id === 'new'
  const templateCode = isNew ? params.get('template') : null
  const copyId = isNew ? params.get('copy') : null
  const { t } = useTranslation('approvalForms')
  const { lang } = useFormat()
  const navigate = useNavigate()

  const admin = useFormAdmin()
  const detail = useFormDetail(isNew ? copyId ?? undefined : id)
  const library = useFormLibrary(lang, !!templateCode)
  const options = useFormProcessOptions()

  const loading = admin.isLoading || detail.isLoading || (!!templateCode && library.isLoading) || options.isLoading
  if (loading) {
    return <div className="mx-auto max-w-5xl p-6"><LoadingSkeleton type="form" rows={8} /></div>
  }
  if ((!isNew || copyId) && !detail.data) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <EmptyState icon={FileText} title={t('editor.notFound')} description={t('editor.notFoundHint')}
          action={<Button variant="outline" onClick={() => navigate(ADMIN_LIST_PATH)}>{t('editor.backToList')}</Button>} />
      </div>
    )
  }

  const groups = admin.data?.groups ?? []
  const initial = detail.data
    ? fromDetail(detail.data, copyId ? t('editor.copySuffix') : undefined)
    : fromTemplate(library.data?.templates.find((tpl) => tpl.code === templateCode) ?? null, groups)
  const editingId = isNew ? null : id!
  return (
    <Editor
      key={`${editingId ?? 'new'}:${templateCode ?? ''}:${copyId ?? ''}`}
      formId={editingId}
      version={isNew ? undefined : detail.data?.version}
      permissions={isNew ? ALL_ADMIN_PERMISSIONS : detail.data?.permissions ?? []}
      initial={initial}
      groups={groups}
      canManageAll={!!admin.data?.canManageAll}
      optionsData={options.data}
      draftKey={`approval-form:${editingId ?? (copyId ? `copy:${copyId}` : templateCode ? `tpl:${templateCode}` : 'new')}`}
      managedProcess={isNew ? null : detail.data?.managedProcess ?? null}
    />
  )
}

function Editor({ formId, version, permissions, initial, groups, canManageAll, optionsData, draftKey, managedProcess }: {
  managedProcess: Ref | null
  formId: string | null
  version: number | undefined
  permissions: FormAdminPermission[]
  initial: Initial
  groups: FormGroup[]
  canManageAll: boolean
  optionsData: ReturnType<typeof useFormProcessOptions>['data']
  draftKey: string
}) {
  const { t } = useTranslation('approvalForms')
  const { t: tp } = useTranslation('approvalProcess')
  const { lang } = useFormat()
  const navigate = useNavigate()
  const me = useAuthStore((s) => s.user)
  const save = useSaveForm()
  const createGroup = useCreateGroup()

  const canEditForm = permissions.includes('EDIT_FORM')
  const canEditAdmins = permissions.includes('MANAGE_ADMINS')
  const canEditProcess = permissions.includes('MANAGE_PROCESS')

  const [info, setInfo] = useState<EditorInfo>(() => {
    // Lark mặc định người tạo là người quản lý đơn; đơn dựng sẵn chưa có ai thì điền người đang sửa.
    if (initial.info.admins.length || !canEditAdmins || !me) return initial.info
    return { ...initial.info, admins: [{ user: { id: me.id, name: me.fullName, avatarUrl: me.avatarUrl }, permissions: [...ALL_ADMIN_PERMISSIONS] }] }
  })
  const [schema, setSchema] = useState<FormSchema>(initial.schema)
  const [users, setUsers] = useState<Record<string, PersonRef>>(initial.users)
  const history = useGraphHistory(initial.graph)
  const [baseline] = useState(() => snapshot({ info, schema: initial.schema, graph: initial.graph }))
  const leavingRef = useRef(false)
  const seqRef = useRef(0)

  const [step, setStep] = useState<EditorStep>(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [issuesOpen, setIssuesOpen] = useState(false)
  const [designFocus, setDesignFocus] = useState<{ widgetId: string; setting?: string; seq: number } | null>(null)
  const [jumpTo, setJumpTo] = useState<{ issue: GraphIssue; seq: number } | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [creatingGroup, setCreatingGroup] = useState(false)

  const combined = useMemo<DraftState>(() => ({ info, schema, graph: history.graph, users }), [info, schema, history.graph, users])
  const { reset: resetGraph } = history
  const applyDraft = useCallback((v: DraftState) => {
    setInfo(v.info)
    setSchema(v.schema)
    setUsers(v.users ?? {})
    resetGraph(v.graph)
  }, [resetGraph])
  const draft = useStateDraft(combined, applyDraft, { key: draftKey, enabled: true })

  const dirty = snapshot(combined) !== baseline
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirty && !leavingRef.current && currentLocation.pathname !== nextLocation.pathname)

  const options = useMemo<ProcessOptions>(() => {
    const roles = (optionsData?.roles ?? []).map((r) => ({ value: r.id, label: r.name }))
    const units = (optionsData?.units ?? []).map((u) => ({ value: u.id, label: u.name, depth: u.depth }))
    return {
      roles,
      units,
      levels: (optionsData?.levels ?? []).map((l) => ({ value: l.id, label: l.name })),
      periods: [],
      roleName: new Map(roles.map((o) => [o.value, o.label])),
      unitName: new Map(units.map((o) => [o.value, o.label])),
    }
  }, [optionsData])
  const catalog = optionsData?.catalog

  const formFields = useMemo(() => formConditionFields(schema, (w) =>
    w.durationLabel || (w.durationUnit === 'HOUR' ? t('settings.unitHour') : t('settings.unitDay'))), [schema, t])
  const graphIssues = useMemo(
    () => validateGraph(history.graph, 'FORM_REQUEST', catalog, formFields),
    [history.graph, catalog, formFields],
  )

  // Chỉ chặn phần người này sửa được — phần còn lại backend giữ nguyên bản đang lưu.
  const issues: FormIssue[] = useMemo(() => [
    ...basicIssues({
      name: info.name, description: info.description, groupId: info.groupId, submitterScope: info.submitterScope,
      submitterCount: info.submitterUsers.length + info.submitterUnits.length, adminCount: info.admins.length,
    }).filter((i) => (i.field === 'admins' ? canEditAdmins : canEditForm)),
    ...(canEditForm ? schemaIssues(schema) : []),
    ...(canEditProcess ? graphIssues.filter((g) => g.severity === 'error').map((g) => ({ step: 3 as const, key: g.key, graph: g })) : []),
  ], [info, schema, graphIssues, canEditForm, canEditAdmins, canEditProcess])

  const addUsers = useCallback((people: PersonRef[]) => {
    setUsers((u) => {
      const next = { ...u }
      for (const p of people) next[p.id] = p
      return next
    })
  }, [])

  const issueText = (i: FormIssue) => (i.graph ? tp(`graph.${i.key}`, i.graph.args) : t(`issues.${i.key}`, i.args))
  const issueWhere = (i: FormIssue) => {
    if (i.step === 1) return t(`steps.s1`)
    if (i.step === 2) {
      const w = schema.widgets.flatMap((x) => [x, ...(x.children ?? [])]).find((x) => x.id === i.widgetId)
      return w ? `${t('steps.s2')} · ${w.title || t('design.untitledField')}` : t('steps.s2')
    }
    return t('steps.s3')
  }

  /**
   * Tới chỗ lỗi. `focus = false` khi vừa bấm Phát hành: chỉ chuyển bước + chọn widget và để hộp "chỗ chưa xong" mở
   * (focus vào ô sẽ làm hộp đóng); bấm "Sửa" trong hộp mới focus đúng ô.
   */
  const goToIssue = (i: FormIssue, focus = true) => {
    setStep(i.step)
    if (!focus) {
      if (i.step === 2 && i.widgetId) setSelectedId(i.widgetId)
      return
    }
    setIssuesOpen(false)
    // Bấm "Sửa" trước khi Phát hành cũng tô đỏ luôn chỗ lỗi để người soạn thấy cần sửa gì.
    setShowErrors(true)
    if (i.step === 1 && i.field) {
      window.setTimeout(() => {
        const el = document.querySelector<HTMLElement>(`[data-field="${i.field}"]`)
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        el?.querySelector<HTMLElement>('input,textarea,button[role="combobox"],button')?.focus()
      }, 60)
    } else if (i.step === 2 && i.widgetId) {
      setSelectedId(i.widgetId)
      setDesignFocus({ widgetId: i.widgetId, setting: i.setting, seq: ++seqRef.current })
    } else if (i.step === 3 && i.graph) {
      setJumpTo({ issue: i.graph, seq: ++seqRef.current })
    }
  }

  const publish = async () => {
    if (blockedByTour()) return
    setShowErrors(true)
    if (issues.length) {
      goToIssue(issues[0]!, false)
      setIssuesOpen(true)
      toast.error(t('editor.fixBeforePublish', { count: issues.length }))
      return
    }
    const saved = await save.mutateAsync({
      id: formId ?? undefined,
      body: {
        groupId: info.groupId!,
        templateCode: initial.templateCode,
        icon: info.icon,
        color: info.color,
        name: info.name,
        description: info.description,
        submitterScope: info.submitterScope,
        submitters: { userIds: info.submitterUsers.map((u) => u.id), orgUnitIds: info.submitterUnits.map((u) => u.id) },
        admins: info.admins.map((a) => ({ userId: a.user.id, permissions: a.permissions })),
        schema,
        process: history.graph,
        version,
      },
    }).catch(() => null)
    if (!saved) return
    draft.clear()
    leavingRef.current = true
    navigate(ADMIN_LIST_PATH)
  }

  const steps: { n: EditorStep; label: string }[] = [
    { n: 1, label: t('steps.s1') }, { n: 2, label: t('steps.s2') }, { n: 3, label: t('steps.s3') }, { n: 4, label: t('steps.s4') },
  ]
  const stepHasError = (n: EditorStep) => showErrors && issues.some((i) => i.step === n)

  return (
    <PeopleSearchContext.Provider value={directoryPeopleSearch}>
      <div className="flex h-dvh flex-col bg-[var(--color-background)]">
        <header className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 sm:px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(ADMIN_LIST_PATH)} aria-label={t('editor.backToList')} title={t('editor.backToList')}>
            <ArrowLeft aria-hidden="true" />
          </Button>
          <p className="hidden max-w-[14rem] truncate font-semibold xl:block">{pickName(info.name, lang) || t('editor.untitled')}</p>
          <nav aria-label={t('editor.steps')} className="order-last flex w-full gap-1 overflow-x-auto md:order-none md:w-auto md:flex-1 md:justify-center"
            {...tourAnchor('formEditor.steps')}>
            {steps.map((s) => (
              <button key={s.n} type="button" onClick={() => setStep(s.n)} aria-current={step === s.n ? 'step' : undefined}
                className={cn('flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors',
                  step === s.n ? 'border-[var(--color-primary)] font-medium text-[var(--color-primary)]'
                    : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]')}>
                <span className={cn('flex h-6 w-6 items-center justify-center rounded-full border text-xs',
                  step === s.n ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                    : stepHasError(s.n) ? 'border-[var(--color-error)] text-[var(--color-error)]' : 'border-current')}>
                  {s.n}
                </span>
                {s.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {/* Luôn hiện số chỗ chưa xong (như Lark) — không đợi bấm Phát hành mới biết còn thiếu gì. */}
            {issues.length > 0 ? (
              <Popover open={issuesOpen} onOpenChange={setIssuesOpen}>
                <PopoverTrigger asChild>
                  <button type="button" className="flex h-9 items-center gap-1.5 rounded-control bg-[var(--color-error-bg)] px-3 text-sm font-medium text-[var(--color-error)]">
                    {t('editor.issueCount', { count: issues.length })}
                    <ChevronUp size={14} aria-hidden="true" className={cn('transition-transform', !issuesOpen && 'rotate-180')} />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[24rem] p-0">
                  <div className="border-b border-[var(--color-border)] px-3 py-2">
                    <p className="text-sm font-semibold">{t('editor.incomplete')}</p>
                    <p className="text-caption">{t('editor.incompleteHint')}</p>
                  </div>
                  <ul className="max-h-80 divide-y divide-[var(--color-border)] overflow-y-auto">
                    {issues.map((i, idx) => (
                      <li key={`${i.step}-${i.key}-${i.widgetId ?? i.field ?? i.graph?.nodeId ?? ''}-${idx}`}
                        className="flex items-start gap-3 bg-[var(--color-muted)]/40 px-3 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{issueWhere(i)}</span>
                          <span className="block text-sm text-[var(--color-muted-foreground)]">{issueText(i)}</span>
                        </span>
                        <Button variant="link" size="sm" onClick={() => goToIssue(i)}>{t('editor.modify')}</Button>
                      </li>
                    ))}
                  </ul>
                </PopoverContent>
              </Popover>
            ) : (
              <span className="hidden items-center gap-1 text-caption text-[var(--color-success)] sm:flex">
                <CheckCircle2 size={14} aria-hidden="true" /> {t('editor.complete')}
              </span>
            )}
            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
              <Eye aria-hidden="true" /> {t('editor.preview')}
            </Button>
            <Button onClick={publish} disabled={save.isPending} {...tourAnchor('formEditor.publish')}>
              {save.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
              {t('editor.publish')}
            </Button>
          </div>
        </header>

        <DraftNotice draft={draft} className="mx-4 mt-3" />

        <main className={cn('min-h-0 flex-1', step === 2 || step === 3 ? 'flex flex-col' : 'overflow-y-auto px-4')}>
          {step === 1 && (
            <BasicInfoStep
              info={info}
              onChange={(patch) => setInfo((i) => ({ ...i, ...patch }))}
              groups={groups}
              lang={lang}
              canEditForm={canEditForm}
              canEditAdmins={canEditAdmins}
              canCreateGroup={canManageAll}
              onCreateGroup={() => setCreatingGroup(true)}
              issues={issues}
              showErrors={showErrors}
            />
          )}
          {step === 2 && (
            <FormDesignStep
              schema={schema}
              onChange={setSchema}
              selectedId={selectedId}
              onSelect={setSelectedId}
              title={pickName(info.name, lang)}
              issues={issues}
              showErrors={showErrors}
              focus={designFocus}
              readOnly={!canEditForm}
            />
          )}
          {step === 3 && (
            <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
              <p className="mb-2 text-caption">{t('process.hint')}</p>
              {managedProcess && (
                <div className="mb-2 flex items-start gap-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-3 py-2 text-sm text-[var(--color-warning)]">
                  <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
                  <span>
                    {t('process.managedBy', { title: managedProcess.name })}{' '}
                    <Link className="font-medium underline" to={`/processes/approval-processes/${managedProcess.id}`}>{t('process.openManaged')}</Link>
                  </span>
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
                <ProcessDesigner
                  history={history}
                  issues={graphIssues}
                  objectType="FORM_REQUEST"
                  catalog={catalog}
                  options={options}
                  users={users}
                  onUsers={addUsers}
                  readOnly={!canEditProcess}
                  draftKey={draftKey}
                  formFields={formFields}
                  jumpTo={jumpTo}
                  issuesPopover={null}
                  className="h-full min-h-[480px]"
                />
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="mx-auto max-w-2xl py-10">
              <EmptyState icon={FileText} title={t('more.title')} description={t('more.description')} />
            </div>
          )}
        </main>
      </div>

      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} size="xl" title={t('editor.preview')}
        description={t('preview.hint')}>
        <FormPreview icon={info.icon} color={info.color} name={pickName(info.name, lang)}
          description={pickName(info.description, lang)} schema={schema} process={history.graph} />
      </Dialog>

      <LocalizedNameDialog
        open={creatingGroup}
        title={t('admin.createGroup')}
        value={{ name: {} }}
        saving={createGroup.isPending}
        draftKey="approval-form-group:new"
        onClose={() => setCreatingGroup(false)}
        onSave={async (v) => {
          const g = await createGroup.mutateAsync(v.name).catch(() => null)
          if (!g) return
          setInfo((i) => ({ ...i, groupId: g.id }))
          setCreatingGroup(false)
        }}
      />

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        title={t('editor.leaveTitle')}
        description={t('editor.leaveDescription')}
        confirmLabel={t('editor.leave')}
      />
    </PeopleSearchContext.Provider>
  )
}
