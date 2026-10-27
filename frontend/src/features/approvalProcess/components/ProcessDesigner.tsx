import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GraphHistory } from '../model/useGraphHistory'
import { nodeById, stepCodes as computeStepCodes, updateNode, type GraphIssue } from '../model/processGraphModel'
import type { ApprovalObjectType, ApprovalProcessCatalog, FormConditionField, PersonRef } from '../types'
import type { ProcessOptions } from '../hooks/useProcessOptions'
import ProcessCanvas from './canvas/ProcessCanvas'
import IssuesPopover, { type IssueView } from './canvas/IssuesPopover'
import ConditionSettingsDialog from './dialogs/ConditionSettingsDialog'
import StepSettingsDialog from './dialogs/StepSettingsDialog'

/** Lỗi sửa được trong hộp cài đặt của bước / điều kiện (khác lỗi về nối nhánh, phải sửa trên sơ đồ). */
const SETTINGS_ISSUES = new Set([
  'stepNoName', 'stepNoApprover', 'stepBadApprover', 'nameTooLong',
  'conditionEmpty', 'conditionEmptyGroup', 'ruleIncomplete', 'ruleFieldNotForObject', 'ruleBadOperator',
  'ruleMissingValue', 'ruleBadNumber', 'ruleBadValue', 'ruleWidgetMissing',
])

interface Props {
  history: GraphHistory
  /** Kết quả `validateGraph` — trang chủ tính để còn chặn lưu. */
  issues: GraphIssue[]
  objectType: ApprovalObjectType | null
  catalog: ApprovalProcessCatalog | undefined
  options: ProcessOptions
  users: Record<string, PersonRef>
  onUsers: (people: PersonRef[]) => void
  readOnly?: boolean
  draftKey: string
  /** Widget số / chọn của đơn từ cho điều kiện — chỉ khi sửa quy trình của một đơn. */
  formFields?: FormConditionField[]
  /** Hộp "N lỗi" trên thanh công cụ; null khi trang đã có hộp lỗi chung. */
  issuesPopover?: { open: boolean; onOpenChange: (open: boolean) => void } | null
  /** Trang yêu cầu nhảy tới một lỗi (vd. bấm "Sửa" ở hộp lỗi chung): đưa node vào giữa, mở hộp cài đặt nếu lỗi nằm trong đó. */
  jumpTo?: { issue: GraphIssue; seq: number } | null
  className?: string
}

/**
 * Khung vẽ quy trình duyệt kèm hộp cài đặt bước / điều kiện — dùng chung cho màn Quy trình duyệt và bước
 * "Quy trình duyệt" của trình sửa đơn từ. Trạng thái sơ đồ (hoàn tác, nháp) nằm ở trang chủ qua {@link GraphHistory}.
 */
export default function ProcessDesigner({
  history, issues, objectType, catalog, options, users, onUsers, readOnly, draftKey, formFields,
  issuesPopover, jumpTo, className,
}: Props) {
  const { t } = useTranslation('approvalProcess')
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [focusRequest, setFocusRequest] = useState<{ nodeId: string; seq: number } | null>(null)

  const codes = useMemo(() => computeStepCodes(history.graph), [history.graph])
  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')

  const editing = useMemo(() => (readOnly ? undefined : {
    onChange: history.set,
    onDragBegin: history.beginTransient,
    onDragMove: history.setTransient,
    onDragEnd: history.endTransient,
    onEditNode: setEditingNodeId,
    onUndo: history.undo,
    onRedo: history.redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
  }), [readOnly, history.set, history.beginTransient, history.setTransient, history.endTransient, history.undo,
    history.redo, history.canUndo, history.canRedo])

  const editingNode = editingNodeId ? nodeById(history.graph, editingNodeId) ?? null : null
  const closeNodeDialog = () => setEditingNodeId(null)
  const saveNode = (patch: Parameters<typeof updateNode>[2]) => {
    if (editingNodeId) history.set(updateNode(history.graph, editingNodeId, patch))
    setEditingNodeId(null)
  }

  const nodeLabel = (nodeId?: string) => {
    const n = nodeId ? nodeById(history.graph, nodeId) : undefined
    if (!n) return null
    if (n.type === 'STEP') return [codes[n.id], n.name].filter(Boolean).join(' · ')
    return n.name || t(`nodeTypes.${n.type}`)
  }
  /** Lỗi nằm trong hộp cài đặt của node (tên, người duyệt, dòng điều kiện) — bấm là mở hộp đó. */
  const opensSettings = (i: GraphIssue) => {
    const n = i.nodeId ? nodeById(history.graph, i.nodeId) : undefined
    return !!n && (n.type === 'STEP' || n.type === 'CONDITION') && SETTINGS_ISSUES.has(i.key)
  }
  const issueViews: IssueView[] = [...errors, ...warnings].map((i) => ({
    issue: i,
    node: nodeLabel(i.nodeId),
    text: t(`graph.${i.key}`, i.args),
    action: readOnly || !i.nodeId ? null : opensSettings(i) ? t('editor.actionOpenSettings') : t('editor.actionShowOnCanvas'),
  }))
  const pickIssue = (i: GraphIssue) => {
    issuesPopover?.onOpenChange(false)
    if (!i.nodeId) return
    setFocusRequest({ nodeId: i.nodeId, seq: Date.now() })
    if (!readOnly && opensSettings(i)) setEditingNodeId(i.nodeId)
  }

  const jumpSeq = jumpTo?.seq
  useEffect(() => {
    if (jumpTo) pickIssue(jumpTo.issue)
    // Chỉ chạy khi có yêu cầu nhảy MỚI (seq đổi).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpSeq])

  return (
    <>
      <ProcessCanvas
        graph={history.graph}
        stepCodes={codes}
        issues={issues}
        editing={editing}
        focusRequest={focusRequest}
        className={className}
        toolbarExtra={!readOnly && issuesPopover && (
          <IssuesPopover items={issueViews} open={issuesPopover.open} onOpenChange={issuesPopover.onOpenChange} onPick={pickIssue} />
        )}
      />
      <ConditionSettingsDialog
        open={editingNode?.type === 'CONDITION'}
        node={editingNode?.type === 'CONDITION' ? editingNode : null}
        objectType={objectType}
        catalog={catalog}
        options={options}
        users={users}
        onUsers={onUsers}
        readOnly={readOnly}
        draftKey={`${draftKey}:node:${editingNodeId ?? ''}`}
        formFields={formFields}
        onClose={closeNodeDialog}
        onSave={saveNode}
      />
      <StepSettingsDialog
        open={editingNode?.type === 'STEP'}
        node={editingNode?.type === 'STEP' ? editingNode : null}
        code={editingNodeId ? codes[editingNodeId] : undefined}
        options={options}
        users={users}
        onUsers={onUsers}
        maxLevelsUp={catalog?.maxLevelsUp ?? 3}
        readOnly={readOnly}
        draftKey={`${draftKey}:node:${editingNodeId ?? ''}`}
        onClose={closeNodeDialog}
        onSave={saveNode}
      />
    </>
  )
}
