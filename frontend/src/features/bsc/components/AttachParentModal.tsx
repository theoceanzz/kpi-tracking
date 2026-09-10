import { useMemo, useState } from 'react'
import { X, GitBranch, Loader2, Check } from 'lucide-react'
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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white">
              <GitBranch size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Gắn vào bộ tiêu chí cấp trên</h3>
              <p className="text-[11px] font-bold text-slate-400 truncate">{scorecard.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
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
              <p className="text-[11px] font-bold text-amber-600">
                Chưa có bộ tiêu chí nào khác để gắn vào.
              </p>
            )}
          </div>

          <button type="button" onClick={() => setLinkItems(v => !v)}
            className="w-full flex items-start gap-3 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left transition-colors">
            <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-all',
              linkItems ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600')}>
              {linkItems && <Check size={10} strokeWidth={4} />}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-black text-slate-800 dark:text-slate-200">
                Nối luôn các chỉ tiêu trùng hạng mục
              </span>
              <span className="block text-[11px] font-medium text-slate-400 leading-relaxed mt-0.5">
                Chỉ tiêu nào của đơn vị trùng hạng mục với chỉ tiêu của cấp trên thì được nối lên dòng
                đó: bảng <b>Độ phủ phân rã</b> đếm được, và kết quả của đơn vị <b>cộng lên</b> cấp trên.
                Mục tiêu đơn vị tự đặt được lấy làm mức đóng góp; dòng vẫn do đơn vị giữ, không bị khoá.
              </span>
            </span>
          </button>

          <p className="text-[11px] font-medium text-slate-400 leading-relaxed">
            Bỏ tick thì chỉ nối <b>quan hệ cha–con</b> để thẻ nằm đúng nhánh trên cây — độ phủ của cấp
            trên vẫn báo "chưa giao" và kết quả không cộng lên.
          </p>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            Huỷ
          </button>
          <button onClick={() => parentId && onSubmit(parentId, linkItems)} disabled={!parentId || pending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40">
            {pending && <Loader2 size={14} className="animate-spin" />}
            Gắn vào cây
          </button>
        </div>
      </div>
    </div>
  )
}
