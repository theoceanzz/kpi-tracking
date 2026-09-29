import { useRef, useState } from 'react'
import {
  Check, ChevronDown, Copy, FileText, Inbox, Loader2, Lock, MoreVertical, Pencil, PlayCircle, Trash2, Undo2, Upload, X,
  CirclePause,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { HintOn, InfoHint } from '@/components/common/InfoHint'
import { cn } from '@/lib/utils'
import AiUnitSelect from './AiUnitSelect'
import AiCriteriaReconcileDialog from './AiCriteriaReconcileDialog'
import AiCriteriaSetMetaDialog, { type MetaMode } from './AiCriteriaSetMetaDialog'
import UnitLockNotice, { UnitReplaceNote } from './UnitLockNotice'
import { activeAt } from './aiUnitScope'
import {
  useAiCriteriaScope, useAiCriteriaSets, useApproveAiCriteriaRequest, useCancelAiCriteriaRequest,
  useDeleteAiCriteriaSet, usePendingAiCriteriaRequests, useRejectAiCriteriaRequest, useStopAiCriteriaSet,
  useUploadAiCriteriaSet,
} from '../hooks/useAiReview'
import type { AiCriteriaChangeRequest, AiCriteriaSet } from '../api/aiReviewApi'

const ACCEPT = '.docx,.doc,.pdf,.xlsx,.xls,.png,.jpg,.jpeg,.txt'

function StatusBadge({ s }: { s: AiCriteriaSet }) {
  if (s.status === 'DRAFT') {
    if (s.pendingRequest) {
      return (
        <HintOn hint={`Đã gửi đề nghị áp cho ${s.pendingRequest.orgUnitName ?? 'đơn vị'} — đang chờ ${s.pendingRequest.approverName ?? 'cấp trên'} duyệt.`}>
          <Badge variant="info">Chờ duyệt đề nghị</Badge>
        </HintOn>
      )
    }
    return <HintOn hint="AI vừa bóc, chưa dùng để chấm. Bấm “Duyệt” để kiểm từng dòng rồi xác nhận."><Badge variant="warning">Bản nháp</Badge></HintOn>
  }
  if (s.status === 'CONFIRMED') {
    const by = s.appliedByName ? ` Người áp: ${s.appliedByName}${s.appliedByRole ? ` (${s.appliedByRole})` : ''}.` : ''
    if (s.locked) {
      return (
        <HintOn hint={`Cấp trên áp cho đơn vị của bạn — bạn không tự thay được, chỉ gửi đề nghị.${by}`}>
          <Badge variant="secondary"><Lock size={11} aria-hidden="true" /> Cấp trên áp</Badge>
        </HintOn>
      )
    }
    return <HintOn hint={`AI dùng tài liệu này khi chấm bài của đơn vị và các đơn vị con.${by}`}><Badge variant="success">Đang áp dụng</Badge></HintOn>
  }
  return <HintOn hint="Không còn dùng để chấm. Áp lại được cho đơn vị bất kỳ."><Badge variant="secondary">Ngừng áp dụng</Badge></HintOn>
}

/**
 * Bộ tiêu chí chấm cho AI: tải quy chế lên, AI bóc thành bản nháp, người duyệt rồi áp cho đơn vị. Mỗi đơn vị một
 * tài liệu đang áp; quản lý áp trong phạm vi của mình, tài liệu của cấp trên thì gửi đề nghị. Tài liệu đã ngừng
 * gom lại, mở khi cần.
 */
export default function AiCriteriaSetSection() {
  const { data: sets = [], isLoading } = useAiCriteriaSets()
  const { data: scope } = useAiCriteriaScope()
  const { data: requests = [] } = usePendingAiCriteriaRequests()
  const upload = useUploadAiCriteriaSet()
  const remove = useDeleteAiCriteriaSet()
  const stop = useStopAiCriteriaSet()
  const cancelRequest = useCancelAiCriteriaRequest()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  // Người áp được cho cả tổ chức thì mặc định "Cả tổ chức"; quản lý đơn vị phải chọn đơn vị của mình.
  const [unitChoice, setUnitChoice] = useState<string | null | undefined>(undefined)
  const unitId = unitChoice !== undefined ? unitChoice : scope?.orgWide ? null : undefined
  const [unitLabel, setUnitLabel] = useState('')
  const [title, setTitle] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<AiCriteriaSet | null>(null)
  const [stopping, setStopping] = useState<AiCriteriaSet | null>(null)
  const [showOld, setShowOld] = useState(false)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ mode: MetaMode; set: AiCriteriaSet } | null>(null)

  const current = sets.filter(s => s.status !== 'ARCHIVED')
  const archived = sets.filter(s => s.status === 'ARCHIVED')
  const atUploadUnit = unitId === undefined ? undefined : activeAt(sets, unitId)

  const onUpload = () => {
    if (!file || unitId === undefined) return
    upload.mutate({ file, orgUnitId: unitId, title: title.trim() || undefined }, {
      onSuccess: set => {
        setFile(null)
        setTitle('')
        if (fileRef.current) fileRef.current.value = ''
        setOpenId(set.id)
      },
    })
  }

  const pick = (fn: () => void) => () => { setMenuId(null); fn() }

  const menuFor = (s: AiCriteriaSet) => {
    const items: React.ReactNode[] = []
    const manage = !!s.canManage
    if (s.status === 'CONFIRMED' && manage) {
      items.push(<MenuItem key="edit" icon={<Pencil />} label="Sửa tên, đơn vị áp dụng" onClick={pick(() => setMeta({ mode: 'edit', set: s }))} />)
      items.push(<MenuItem key="stop" icon={<CirclePause />} label="Ngừng áp dụng" onClick={pick(() => setStopping(s))} />)
    }
    if (s.status === 'ARCHIVED' && manage) {
      items.push(<MenuItem key="apply" icon={<PlayCircle />} label="Áp dụng lại cho…" onClick={pick(() => setMeta({ mode: 'apply', set: s }))} />)
      items.push(<MenuItem key="rename" icon={<Pencil />} label="Đổi tên" onClick={pick(() => setMeta({ mode: 'edit', set: s }))} />)
    }
    if (s.status === 'DRAFT' && manage) {
      items.push(<MenuItem key="edit" icon={<Pencil />} label="Sửa tên, đơn vị áp dụng" onClick={pick(() => setMeta({ mode: 'edit', set: s }))} />)
      if (s.pendingRequest?.mine) {
        items.push(<MenuItem key="withdraw" icon={<Undo2 />} label="Rút đề nghị" onClick={pick(() => cancelRequest.mutate(s.pendingRequest!.id))} />)
      }
    }
    items.push(<MenuItem key="clone" icon={<Copy />} label="Nhân bản cho đơn vị khác" onClick={pick(() => setMeta({ mode: 'clone', set: s }))} />)
    if (manage) {
      items.push(<div key="sep" className="my-1 h-px bg-[var(--color-border)]" role="separator" />)
      items.push(<MenuItem key="delete" icon={<Trash2 />} label="Xoá" danger onClick={pick(() => setDeleting(s))} />)
    }
    return items
  }

  // Một nút chính (Duyệt / Xem) + menu "⋯" cho mọi thao tác khác — hàng không dài thêm khi có thêm thao tác.
  const row = (s: AiCriteriaSet) => (
    <li key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium" title={s.title}>{s.title}</p>
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-xs text-[var(--color-muted-foreground)]">
            {s.orgUnitName ?? 'Cả tổ chức'}
            {s.status === 'CONFIRMED' && s.appliedByName && <> · áp bởi {s.appliedByName}</>}
          </p>
          {/* Điện thoại: trạng thái xuống dòng dưới để tên không bị cắt cụt. */}
          <span className="shrink-0 sm:hidden"><StatusBadge s={s} /></span>
        </div>
      </div>
      <span className="hidden shrink-0 sm:inline-flex"><StatusBadge s={s} /></span>
      <Button variant={s.status === 'DRAFT' && s.canManage && !s.pendingRequest ? 'outline' : 'ghost'} size="sm"
              onClick={() => setOpenId(s.id)}>
        {s.status === 'DRAFT' && s.canManage && !s.pendingRequest ? 'Duyệt' : 'Xem'}
      </Button>
      <Popover open={menuId === s.id} onOpenChange={o => setMenuId(o ? s.id : null)}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Thao tác với ${s.title}`} title="Thao tác">
            <MoreVertical aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-60 p-1" role="menu">{menuFor(s)}</PopoverContent>
      </Popover>
    </li>
  )

  const uploadUnitLabel = unitId === null ? 'Cả tổ chức' : unitLabel || 'Đơn vị này'

  return (
    <div className="space-y-4 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex items-start gap-3">
        <FileText size={20} className="mt-0.5 text-[var(--color-ai)]" aria-hidden="true" />
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-foreground)]">
            Bộ tiêu chí chấm
            <InfoHint>
              Mỗi đơn vị áp một tài liệu; đơn vị con không có tài liệu riêng thì dùng của đơn vị cha. Không có tài liệu
              nào thì AI dùng thang chất lượng chung của công ty.
            </InfoHint>
          </p>
          <p className="text-sm text-[var(--color-muted-foreground)]">Tải quy chế lên, AI bóc thành tiêu chí để bạn duyệt rồi áp cho đơn vị.</p>
        </div>
      </div>

      {requests.length > 0 && <PendingRequests requests={requests} onView={setOpenId} />}

      <div className="space-y-2">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
          <div className="space-y-1">
            <span className="text-label">Tài liệu</span>
            <input ref={fileRef} type="file" accept={ACCEPT} className="sr-only" id="ai-criteria-file"
                   onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <Button variant="outline" className="w-full justify-start" onClick={() => fileRef.current?.click()}>
              <Upload aria-hidden="true" />
              <span className="truncate">{file ? file.name : 'Word, PDF, Excel'}</span>
            </Button>
          </div>
          <div className="space-y-1">
            <span className="text-label flex items-center gap-1">
              Áp cho
              <InfoHint>Tài liệu của một đơn vị áp cho đơn vị đó và các đơn vị con không có tài liệu riêng.</InfoHint>
            </span>
            <AiUnitSelect value={unitId} onChange={(id, label) => { setUnitChoice(id); setUnitLabel(label) }}
                          allLabel={scope?.orgWide ? 'Cả tổ chức' : undefined}
                          onlyUnitIds={scope ? new Set(scope.unitIds) : undefined} />
          </div>
          <label className="space-y-1">
            <span className="text-label">Tên</span>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Tên tệp" />
          </label>
          <Button disabled={!file || unitId === undefined || upload.isPending} onClick={onUpload}>
            {upload.isPending ? <><Loader2 className="animate-spin" aria-hidden="true" /> Đang bóc…</> : 'Bóc bằng AI'}
          </Button>
        </div>
        {atUploadUnit?.locked ? (
          <UnitLockNotice current={atUploadUnit} onView={() => setOpenId(atUploadUnit.id)}>
            <span className="text-xs text-[var(--color-muted-foreground)]">Bạn vẫn tải lên được — duyệt xong bấm “Gửi đề nghị áp dụng”.</span>
          </UnitLockNotice>
        ) : atUploadUnit ? (
          <UnitReplaceNote current={atUploadUnit} unitLabel={uploadUnitLabel} />
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="animate-spin text-[var(--color-muted-foreground)]" /></div>
      ) : sets.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Chưa có — AI chấm theo thang chung.</p>
      ) : (
        <div className="space-y-2">
          {current.length > 0 && (
            <ul className="divide-y divide-[var(--color-border)] rounded-control border border-[var(--color-border)]">
              {current.map(row)}
            </ul>
          )}
          {archived.length > 0 && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setShowOld(v => !v)}
                      className="text-[var(--color-muted-foreground)]">
                <ChevronDown className={cn('transition-transform', showOld && 'rotate-180')} aria-hidden="true" />
                Ngừng áp dụng ({archived.length})
              </Button>
              {showOld && (
                <ul className="divide-y divide-[var(--color-border)] rounded-control border border-[var(--color-border)]">
                  {archived.map(row)}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {meta && (
        <AiCriteriaSetMetaDialog key={`${meta.mode}-${meta.set.id}`} mode={meta.mode} set={meta.set} sets={sets}
                                 onClose={() => setMeta(null)} onView={setOpenId} />
      )}
      {/* Sau hộp nhân bản / áp lại: "Xem tài liệu đang áp" mở chồng lên trên. */}
      <AiCriteriaReconcileDialog setId={openId} onClose={() => setOpenId(null)} />
      <ConfirmDialog
        open={!!stopping}
        onClose={() => setStopping(null)}
        onConfirm={() => stopping && stop.mutate(stopping.id, { onSuccess: () => setStopping(null) })}
        loading={stop.isPending}
        title="Ngừng áp dụng?"
        description={`${stopping?.orgUnitName ?? 'Cả tổ chức'} thôi dùng “${stopping?.title ?? ''}” — AI chấm theo tài liệu của đơn vị cấp trên (nếu có), không thì theo thang chung. Tài liệu vẫn còn, áp lại được.`}
        confirmLabel="Ngừng áp dụng"
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        loading={remove.isPending}
        title="Xoá bộ tiêu chí?"
        description={deleting?.status === 'CONFIRMED'
          ? `“${deleting.title}” đang được áp dụng. Xoá xong, AI chấm theo tài liệu cấp trên / thang chung.`
          : `Xoá “${deleting?.title ?? ''}”. Kết quả AI đã chấm trước đó không bị ảnh hưởng.`}
        confirmLabel="Xoá"
      />
    </div>
  )
}

/** Đề nghị đổi quy chế đang chờ người xem duyệt. */
function PendingRequests({ requests, onView }: { requests: AiCriteriaChangeRequest[]; onView: (setId: string) => void }) {
  const approve = useApproveAiCriteriaRequest()
  const reject = useRejectAiCriteriaRequest()
  const [rejecting, setRejecting] = useState<AiCriteriaChangeRequest | null>(null)
  const [reason, setReason] = useState('')
  const busy = approve.isPending || reject.isPending

  return (
    <div className="space-y-2 rounded-control border border-[var(--color-info-border)] bg-[var(--color-info-bg)] p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Inbox size={15} className="text-[var(--color-info)]" aria-hidden="true" /> Đề nghị chờ bạn duyệt ({requests.length})
      </p>
      <ul className="space-y-2">
        {requests.map(r => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <p>
                <span className="font-medium">{r.requestedByName}</span>
                {r.requestedByRole && <span className="text-[var(--color-muted-foreground)]"> ({r.requestedByRole})</span>}
                {' '}đề nghị áp <span className="font-medium">«{r.proposedSetTitle}»</span> cho {r.orgUnitName}
                {r.currentSetTitle && <> thay <span className="text-[var(--color-muted-foreground)]">«{r.currentSetTitle}»</span></>}
              </p>
              {r.note && <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">Ghi chú: {r.note}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => onView(r.proposedSetId)}>Xem tài liệu</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => { setRejecting(r); setReason('') }}>
                <X aria-hidden="true" /> Từ chối
              </Button>
              <Button size="sm" disabled={busy} onClick={() => approve.mutate({ id: r.id })}>
                <Check aria-hidden="true" /> Đồng ý
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {rejecting && (
        <Dialog open onClose={() => setRejecting(null)} size="sm" title="Từ chối đề nghị"
                description={`«${rejecting.proposedSetTitle}» cho ${rejecting.orgUnitName}`}
                footer={(
                  <DialogFooter
                    secondary={<Button variant="outline" onClick={() => setRejecting(null)} disabled={reject.isPending}>Huỷ</Button>}
                    primary={(
                      <Button variant="destructive" disabled={reject.isPending}
                              onClick={() => reject.mutate({ id: rejecting.id, note: reason.trim() || undefined },
                                { onSuccess: () => setRejecting(null) })}>
                        Từ chối
                      </Button>
                    )}
                  />
                )}>
          <label className="block space-y-1">
            <span className="text-label">Lý do <span className="font-normal text-[var(--color-muted-foreground)]">(người đề nghị sẽ thấy)</span></span>
            <Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} />
          </label>
        </Dialog>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm transition-colors focus-visible:outline-none [&_svg]:size-4 [&_svg]:shrink-0',
        danger
          ? 'text-[var(--color-error)] hover:bg-[var(--color-error-bg)] focus-visible:bg-[var(--color-error-bg)]'
          : 'text-[var(--color-foreground)] hover:bg-[var(--color-muted)] focus-visible:bg-[var(--color-muted)] [&_svg]:text-[var(--color-muted-foreground)]',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
