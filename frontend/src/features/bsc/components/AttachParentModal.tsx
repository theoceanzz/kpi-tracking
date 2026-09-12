import { useMemo, useState } from 'react'
import { Loader2, Check } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { ScorecardResponse } from '../types'

interface AttachParentModalProps {
  open: boolean
  onClose: () => void
  /** Thẻ đang cần gắn vào cây. */
  scorecard: ScorecardResponse
  /** Mọi bộ tiêu chí của tổ chức — dùng để dựng danh sách cấp trên hợp lệ. */
  all: ScorecardResponse[]
  pending: boolean
  onSubmit: (parentScorecardId: string, linkItems: boolean) => void
}

/**
 * Gắn một bộ tiêu chí đã có vào bộ tiêu chí cấp trên.
 *
 * <p>Dành cho thẻ do đơn vị tự dựng trước khi cấp trên phân rã: nó nằm mồ côi ở gốc cây, không vào
 * bảng độ phủ và không ai nhìn ra nó thuộc nhánh nào. Trước đây muốn nối lại thì cấp trên phải
 * phân rã một chỉ tiêu xuống đúng đơn vị đó — tức phải giao thêm việc chỉ để sửa hình cây.
 *
 * <p>Danh sách cấp trên loại chính nó và MỌI thẻ nằm dưới nó: chọn một thẻ con làm cha sẽ tạo vòng
 * trong cây (backend cũng chặn, đây là để không bày ra lựa chọn bấm vào là báo lỗi).
 */
export default function AttachParentModal({
  open, onClose, scorecard, all, pending, onSubmit,
}: AttachParentModalProps) {
  const [parentId, setParentId] = useState('')
  // Mặc định BẬT: gắn cây mà không nối chỉ tiêu thì quan hệ cha–con chỉ đổi cách vẽ, không đưa
  // được con số nào lên cấp trên — gần như chắc chắn không phải điều người dùng muốn.
  const [linkItems, setLinkItems] = useState(true)

  const candidates = useMemo(() => {
    const childrenOf = new Map<string, string[]>()
    for (const s of all) {
      if (!s.parentScorecardId) continue
      childrenOf.set(s.parentScorecardId, [...(childrenOf.get(s.parentScorecardId) || []), s.id])
    }
    const banned = new Set<string>([scorecard.id])
    const stack = [scorecard.id]
    while (stack.length) {
      for (const childId of childrenOf.get(stack.pop()!) || []) {
        if (banned.add(childId)) stack.push(childId)
      }
    }
    return all.filter(s => !banned.has(s.id))
  }, [all, scorecard.id])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      dismissible={!pending}
      title="Gắn vào bộ tiêu chí cấp trên"
      description={<span className="block truncate" title={scorecard.name}>{scorecard.name}</span>}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={pending}>Huỷ</Button>}
          primary={
            <Button onClick={() => parentId && onSubmit(parentId, linkItems)} disabled={!parentId || pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Gắn vào cây
            </Button>
          }
        />
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-label block">
            Bộ tiêu chí cấp trên
          </label>
          <Select value={parentId || undefined} onValueChange={setParentId}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Chọn bộ tiêu chí cấp trên" /></SelectTrigger>
            <SelectContent className="z-[1100]">
              {candidates.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}{s.orgUnitName ? ` · ${s.orgUnitName}` : ' · toàn tổ chức'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {candidates.length === 0 && (
            <p className="text-caption text-[var(--color-warning)]">
              Chưa có bộ tiêu chí nào khác để gắn vào.
            </p>
          )}
        </div>

        <button className="flex w-full items-center gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-left transition-colors hover:bg-[var(--color-muted)]" type="button" onClick={() => setLinkItems(v => !v)}>
          <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-all',
            linkItems ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'border-[var(--color-border-strong)]')}>
            {linkItems && <Check aria-hidden="true" strokeWidth={4} />}
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-[var(--color-foreground)]">
              Nối luôn các chỉ tiêu trùng hạng mục
            </span>
            <span className="block text-caption leading-relaxed mt-0.5">
              Chỉ tiêu nào của đơn vị trùng hạng mục với chỉ tiêu của cấp trên thì được nối lên dòng
              đó: bảng <b>Độ phủ phân rã</b> đếm được, và kết quả của đơn vị <b>cộng lên</b> cấp trên.
              Mục tiêu đơn vị tự đặt được lấy làm mức đóng góp; dòng vẫn do đơn vị giữ, không bị khoá.
            </span>
          </span>
        </button>

        <p className="text-caption leading-relaxed">
          Bỏ tick thì chỉ nối <b>quan hệ cha–con</b> để thẻ nằm đúng nhánh trên cây — độ phủ của cấp
          trên vẫn báo "chưa giao" và kết quả không cộng lên.
        </p>
      </div>

    </Dialog>
  )
}
