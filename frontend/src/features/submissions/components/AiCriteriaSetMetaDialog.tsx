import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import AiUnitSelect from './AiUnitSelect'
import UnitLockNotice from './UnitLockNotice'
import { activeAt, unitMarks } from './aiUnitScope'
import {
  useAiCriteriaScope, useCloneAiCriteriaSet, useCloneAndRequestAiCriteria, useReapplyAiCriteriaSet,
  useRequestAiCriteriaChange, useUpdateAiCriteriaSetInfo,
} from '../hooks/useAiReview'
import type { AiCriteriaSet } from '../api/aiReviewApi'

/** `edit` sửa tên / đơn vị · `clone` nhân bản cho đơn vị khác · `apply` áp lại tài liệu đã ngừng. */
export type MetaMode = 'edit' | 'clone' | 'apply'

const TITLES: Record<MetaMode, string> = {
  edit: 'Sửa tên, đơn vị áp dụng',
  clone: 'Nhân bản cho đơn vị khác',
  apply: 'Áp dụng lại cho đơn vị',
}

/**
 * Tên + đơn vị của một bộ tiêu chí. Mỗi đơn vị một tài liệu đang áp: đơn vị có ✓ (tài liệu mình quản) không chọn
 * được — ngừng tài liệu đó trước. Đơn vị có 🔒 (cấp trên áp): khi nhân bản / áp lại vẫn chọn được, hộp hiện lý do +
 * "Xem tài liệu đang áp" và nút chính thành "Gửi đề nghị".
 */
export default function AiCriteriaSetMetaDialog({ mode, set, sets, onClose, onView }: {
  mode: MetaMode
  set: AiCriteriaSet
  sets: AiCriteriaSet[]
  onClose: () => void
  /** Mở xem một bộ (tài liệu cấp trên đang áp). */
  onView: (setId: string) => void
}) {
  const { data: scope } = useAiCriteriaScope()
  const update = useUpdateAiCriteriaSetInfo()
  const clone = useCloneAiCriteriaSet()
  const cloneRequest = useCloneAndRequestAiCriteria()
  const reapply = useReapplyAiCriteriaSet()
  const request = useRequestAiCriteriaChange()
  const isClone = mode === 'clone'
  const [title, setTitle] = useState(isClone ? '' : set.title)
  // Nhân bản / áp lại: bắt buộc chọn đơn vị (undefined = chưa chọn). Sửa: bắt đầu từ đơn vị hiện tại.
  const [unitId, setUnitId] = useState<string | null | undefined>(mode === 'edit' ? set.orgUnitId ?? null : undefined)
  const [unitLabel, setUnitLabel] = useState('')
  const [note, setNote] = useState('')

  const isDraft = set.status === 'DRAFT'
  const archived = set.status === 'ARCHIVED'
  // Nhân bản: đơn vị của CHÍNH bộ gốc cũng đã có tài liệu (bản sao sang đó phải gửi đề nghị / bị chặn).
  // Sửa / áp lại: bỏ chính nó — giữ nguyên đơn vị hiện tại được.
  const except = isClone ? undefined : set.id
  // Bản nháp chọn đơn vị nào cũng được (xác nhận sau sẽ thay / gửi đề nghị); còn lại đơn vị có tài liệu bị khoá.
  const marks = mode === 'edit' && isDraft ? undefined : unitMarks(sets, except, mode !== 'edit')
  const current = unitId === undefined ? undefined : activeAt(sets, unitId, except)
  const needsRequest = !!current?.locked && mode !== 'edit'
  const busy = [update, clone, cloneRequest, reapply, request].some(m => m.isPending)
  const autoTitle = `${set.title} – ${unitLabel}`
  const canSave = !busy && unitId !== undefined && (isClone || mode === 'apply' || !!title.trim())

  const save = () => {
    if (unitId === undefined) return
    const meta = { title: title.trim() || null, orgUnitId: unitId, note: note.trim() || null }
    const done = { onSuccess: onClose }
    if (mode === 'edit') update.mutate({ id: set.id, meta }, done)
    else if (mode === 'clone') (needsRequest ? cloneRequest : clone).mutate({ id: set.id, meta }, done)
    else if (needsRequest) request.mutate({ id: set.id, meta }, done)
    else reapply.mutate({ id: set.id, orgUnitId: unitId }, done)
  }

  const primaryLabel = needsRequest
    ? (isClone ? 'Nhân bản & gửi đề nghị' : 'Gửi đề nghị')
    : mode === 'clone' ? 'Nhân bản' : mode === 'apply' ? 'Áp dụng' : 'Lưu'

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      dismissible={!busy}
      title={TITLES[mode]}
      description={isClone
        ? (set.status === 'CONFIRMED'
          ? `Bản sao của “${set.title}” dùng ngay cho đơn vị bạn chọn, cùng nội dung đã duyệt.`
          : `Bản sao của “${set.title}” là bản nháp — duyệt rồi xác nhận để dùng.`)
        : set.title}
      footer={(
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={busy}>Huỷ</Button>}
          primary={(
            <Button onClick={save} disabled={!canSave}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />} {primaryLabel}
            </Button>
          )}
        />
      )}
    >
      <div className="space-y-4">
        {mode !== 'apply' && (
          <label className="block space-y-1">
            <span className="text-label">Tên{isClone && <span className="font-normal text-[var(--color-muted-foreground)]"> (không bắt buộc)</span>}</span>
            <Input value={title} onChange={e => setTitle(e.target.value)} maxLength={255}
                   placeholder={isClone ? 'Để trống thì tự đặt theo đơn vị' : 'Tên bộ tiêu chí'} invalid={!isClone && !title.trim()} />
            {isClone && !title.trim() && unitId !== undefined && (
              <span className="block text-xs text-[var(--color-muted-foreground)]">Để trống sẽ đặt tên “{autoTitle}”.</span>
            )}
          </label>
        )}

        <div className="space-y-1">
          <span className="text-label">Áp cho</span>
          <AiUnitSelect
            value={unitId}
            onChange={(id, label) => { setUnitId(id); setUnitLabel(label) }}
            allLabel={scope?.orgWide ? 'Cả tổ chức' : undefined}
            onlyUnitIds={scope ? new Set(scope.unitIds) : undefined}
            marks={marks}
            placeholder="Chọn đơn vị"
            disabled={mode === 'edit' && archived}
            className="w-full"
          />
          {mode === 'edit' && archived ? (
            <p className="text-xs text-[var(--color-muted-foreground)]">Tài liệu đã ngừng: dùng “Áp dụng lại cho…” để chọn đơn vị.</p>
          ) : marks && marks.size > 0 && !needsRequest ? (
            <p className="text-xs text-[var(--color-muted-foreground)]">
              ✓ đơn vị đang áp tài liệu khác — mỗi đơn vị một tài liệu, ngừng tài liệu đó trước.
              {mode !== 'edit' && ' 🔒 do cấp trên áp — chọn để gửi đề nghị.'}
            </p>
          ) : null}
        </div>

        {needsRequest && current && (
          <UnitLockNotice current={current} onView={() => onView(current.id)} />
        )}
        {needsRequest && (
          <label className="block space-y-1">
            <span className="text-label">Ghi chú cho người duyệt <span className="font-normal text-[var(--color-muted-foreground)]">(không bắt buộc)</span></span>
            <Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} maxLength={1000}
                      placeholder="Vì sao đơn vị cần quy chế riêng" />
          </label>
        )}
        {mode === 'edit' && isDraft && current && (
          <p className="text-xs text-[var(--color-warning)]">
            {current.locked
              ? `Đơn vị này đang áp «${current.title}» do cấp trên áp dụng — duyệt xong bản nháp thì gửi đề nghị.`
              : `Đơn vị này đang áp «${current.title}». Xác nhận bản nháp này sẽ thay tài liệu đó.`}
          </p>
        )}
      </div>
    </Dialog>
  )
}
