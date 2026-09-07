import { useMemo, useState } from 'react'
import type { ConductScoreInput, ConductSheet } from '../api/conductApi'
import type { ConductExportRow } from '../utils/conductSheetExport'

/**
 * Phần "nháp" của một phiếu hạnh kiểm: điểm đang gõ, tổng đã tính trọng số, và cách gom
 * lại thành payload để lưu.
 *
 * Tách khỏi giao diện vì cùng một phiếu được vẽ bằng hai hình dạng — bảng ngang ở trang
 * "Hạnh kiểm của tôi", và khối dọc nhét trong modal chấm đợt/chấm kỳ. Hai chỗ đó phải
 * tính điểm y hệt nhau, nên công thức chỉ được có một bản.
 */

export interface ConductDraftRow {
  selfScore: string
  selfEvidence: string
  managerScore: string
  managerComment: string
}

export const EMPTY_DRAFT: ConductDraftRow = {
  selfScore: '', selfEvidence: '', managerScore: '', managerComment: '',
}

export const num = (v: string): number | null => {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Điểm đã tính trọng số của MỘT dòng, hoặc null khi dòng chưa chấm. */
export const weighted = (score: number | null, weight: number) =>
  score == null ? null : Math.round((score * weight) / 100 * 100) / 100

export const fmt = (v: number | null | undefined) =>
  v == null ? '—' : Number(v.toFixed(2)).toString()

const toDraft = (sheet: ConductSheet): Record<number, ConductDraftRow> =>
  Object.fromEntries(
    sheet.items.map(i => [
      i.position,
      {
        selfScore: i.selfScore != null ? String(i.selfScore) : '',
        selfEvidence: i.selfEvidence ?? '',
        managerScore: i.managerScore != null ? String(i.managerScore) : '',
        managerComment: i.managerComment ?? '',
      },
    ])
  )

export function useConductDraft(sheet: ConductSheet) {
  const [draft, setDraft] = useState<Record<number, ConductDraftRow>>(() => toDraft(sheet))
  const [comment, setComment] = useState(sheet.comment ?? '')

  // Phiếu đổi (chọn người khác, đổi đợt, hoặc vừa lưu xong) ⇒ nạp lại nháp từ server.
  // Nạp NGAY trong lúc render chứ không qua useEffect: làm ở effect thì có đúng một nhịp
  // vẽ ra ô nhập còn giữ điểm của người trước.
  const [syncedSheet, setSyncedSheet] = useState(sheet)
  if (syncedSheet !== sheet) {
    setSyncedSheet(sheet)
    setDraft(toDraft(sheet))
    setComment(sheet.comment ?? '')
  }

  const set = (position: number, patch: Partial<ConductDraftRow>) =>
    setDraft(prev => ({ ...prev, [position]: { ...(prev[position] ?? EMPTY_DRAFT), ...patch } }))

  const rowOf = (position: number) => draft[position] ?? EMPTY_DRAFT

  const totals = useMemo(() => {
    let self = 0
    let manager = 0
    let hasSelf = false
    let hasManager = false
    sheet.items.forEach(i => {
      const d = draft[i.position]
      if (!d) return
      const s = weighted(num(d.selfScore), i.weight)
      const m = weighted(num(d.managerScore), i.weight)
      if (s != null) { self += s; hasSelf = true }
      if (m != null) { manager += m; hasManager = true }
    })
    return {
      self: hasSelf ? Math.round(self * 100) / 100 : null,
      manager: hasManager ? Math.round(manager * 100) / 100 : null,
    }
  }, [draft, sheet.items])

  const totalWeight = sheet.items.reduce((s, i) => s + (i.weight || 0), 0)

  const collect = (side: 'self' | 'manager'): ConductScoreInput[] =>
    sheet.items.map(i => {
      const d = draft[i.position]
      return {
        criteriaId: i.criteriaId ?? null,
        position: i.position,
        score: side === 'self' ? num(d?.selfScore ?? '') : num(d?.managerScore ?? ''),
        note: side === 'self' ? (d?.selfEvidence ?? '') : (d?.managerComment ?? ''),
      }
    })

  // Xuất đúng thứ đang hiển thị (kể cả điểm vừa gõ chưa lưu) — file phải khớp với màn hình.
  const exportRows = (): ConductExportRow[] =>
    sheet.items.map(i => {
      const d = rowOf(i.position)
      const selfScore = num(d.selfScore)
      const managerScore = num(d.managerScore)
      return {
        name: i.name,
        description: i.description,
        weight: i.weight,
        selfScore,
        selfEvidence: d.selfEvidence,
        managerScore,
        managerComment: d.managerComment,
        selfWeighted: weighted(selfScore, i.weight),
        managerWeighted: weighted(managerScore, i.weight),
      }
    })

  return { draft, rowOf, set, comment, setComment, totals, totalWeight, collect, exportRows }
}
