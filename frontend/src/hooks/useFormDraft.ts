import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'
import { readDraft, removeDraft, sanitize, writeDraft } from '@/lib/formDraft'
import { queryClient } from '@/lib/queryClient'

/**
 * Bản nháp tự lưu cho form trong modal — xem `lib/formDraft.ts`.
 *
 * Cách gắn vào một modal:
 *   const draft = useFormDraft(form, { key: isEdit ? `gift:${id}` : 'gift:new', enabled: open })
 *   …trong thân modal: <DraftNotice draft={draft} />
 *
 * Xoá nháp khi đã lưu: tự động nếu trong lúc modal mở có một mutation (React Query) thành công rồi
 * modal đóng lại — đúng nhịp "bấm Lưu → thành công → đóng" của gần như mọi modal. Modal gọi API thẳng
 * (không qua useMutation) hoặc lưu xong vẫn để mở thì gọi `draft.clear()` sau khi lưu.
 *
 * `key` phải phân biệt tạo mới / sửa từng bản ghi (nháp của bản ghi A không được đổ vào form của B).
 */
export interface FormDraftHandle {
  /** Thời điểm lưu của bản nháp vừa khôi phục; null = không khôi phục gì. */
  restoredAt: number | null
  /** Bỏ bản nháp: xoá khỏi bộ nhớ và trả form về giá trị lúc mở. */
  discard: () => void
  /** Gọi khi lưu thành công: xoá bản nháp, không lưu nữa cho tới lần gõ tiếp theo. */
  clear: () => void
}

const SAVE_DELAY_MS = 400

const snapshot = (v: unknown) => JSON.stringify(sanitize(v) ?? null)

/**
 * Lõi dùng chung cho hai biến thể: chụp "mốc" (giá trị lúc mở, sau khi modal tự reset form), khôi
 * phục nháp, lưu có trễ, và ghi nốt phần đang chờ khi modal đóng / trang bị tải lại.
 */
function useDraftCore<T>(opts: {
  key: string
  enabled: boolean
  read: () => T
  apply: (values: T) => void
}): FormDraftHandle & { changed: (userInput: boolean, liftsClear?: boolean) => void } {
  const { key, enabled } = opts
  const [restoredAt, setRestoredAt] = useState<number | null>(null)
  const readRef = useRef(opts.read)
  const applyRef = useRef(opts.apply)
  // Cập nhật sau mỗi lần render (trước các effect bên dưới) để luôn đọc/ghi được giá trị mới nhất.
  useLayoutEffect(() => {
    readRef.current = opts.read
    applyRef.current = opts.apply
  })

  const baselineRef = useRef<{ raw: T; snap: string } | null>(null)
  const touchedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pendingRef = useRef(false)
  // Sau clear() (lưu thành công) modal thường tự reset form — thay đổi đó không phải nháp.
  const clearedRef = useRef(false)
  // Có mutation thành công trong lúc mở ⇒ đóng modal lúc này là "đã lưu xong", bỏ nháp.
  const savedRef = useRef(false)

  const flush = useCallback(() => {
    clearTimeout(timerRef.current)
    if (!pendingRef.current) return
    pendingRef.current = false
    const values = readRef.current()
    // Người dùng sửa rồi lại trả về y như lúc mở ⇒ không còn gì để giữ.
    if (baselineRef.current && snapshot(values) === baselineRef.current.snap) removeDraft(key)
    else writeDraft(key, values)
  }, [key])

  // Mở modal: đợi modal tự điền form xong (effect của nó chạy trước, setState của nó render trước
  // macrotask này) rồi mới chụp mốc và đổ nháp vào.
  useEffect(() => {
    if (!enabled) return
    touchedRef.current = false
    clearedRef.current = false
    savedRef.current = false
    baselineRef.current = null
    const unsubscribe = queryClient.getMutationCache().subscribe(event => {
      if (event.type === 'updated' && event.action.type === 'success') savedRef.current = true
    })
    const timer = setTimeout(() => {
      const raw = readRef.current()
      baselineRef.current = { raw, snap: snapshot(raw) }
      const draft = readDraft<T>(key)
      if (draft && snapshot(draft.values) !== baselineRef.current.snap) {
        applyRef.current(draft.values)
        touchedRef.current = true
        setRestoredAt(draft.savedAt)
      }
    }, 0)
    const onHide = () => flush()
    window.addEventListener('pagehide', onHide)
    return () => {
      clearTimeout(timer)
      unsubscribe()
      window.removeEventListener('pagehide', onHide)
      setRestoredAt(null) // lần mở sau bắt đầu không có dòng báo, trừ khi lại khôi phục được nháp
      if (savedRef.current) {
        clearTimeout(timerRef.current)
        pendingRef.current = false
        removeDraft(key)
      } else {
        flush() // đóng modal ngay sau khi gõ: vẫn giữ mấy phím cuối
      }
    }
  }, [enabled, key, flush])

  const changed = useCallback((userInput: boolean, liftsClear = userInput) => {
    if (!enabled || !baselineRef.current) return
    if (clearedRef.current) {
      if (!liftsClear) return
      clearedRef.current = false // form vẫn mở và người dùng gõ tiếp (vd. "lưu và tạo tiếp")
    }
    if (userInput) {
      touchedRef.current = true
      savedRef.current = false // lưu xong rồi lại sửa tiếp trong cùng lần mở
    }
    if (!touchedRef.current) return
    pendingRef.current = true
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flush, SAVE_DELAY_MS)
  }, [enabled, flush])

  const clear = useCallback(() => {
    clearTimeout(timerRef.current)
    pendingRef.current = false
    touchedRef.current = false
    clearedRef.current = true
    removeDraft(key)
    setRestoredAt(null)
  }, [key])

  const discard = useCallback(() => {
    clear()
    clearedRef.current = false
    if (baselineRef.current) applyRef.current(baselineRef.current.raw)
  }, [clear])

  return { restoredAt, discard, clear, changed }
}

/** Biến thể cho react-hook-form. */
export function useFormDraft<T extends FieldValues>(
  form: UseFormReturn<T>,
  { key, enabled }: { key: string; enabled: boolean },
): FormDraftHandle {
  const core = useDraftCore<T>({
    key,
    enabled,
    read: () => form.getValues(),
    // keepDefaultValues: "đã sửa" vẫn tính theo giá trị mặc định của form, không theo nháp.
    apply: values => form.reset({ ...form.getValues(), ...values }, { keepDefaultValues: true }),
  })
  const { changed } = core

  useEffect(() => {
    if (!enabled) return
    // type === 'change' = người dùng gõ / chọn; setValue từ code (nút chọn thẻ, tính tự động) không có
    // type — vẫn được lưu cùng, nhưng chỉ sau khi người dùng đã chạm vào form ít nhất một lần.
    const sub = form.watch((_values, info) => changed(info.type === 'change'))
    return () => sub.unsubscribe()
  }, [enabled, form, changed])

  return { restoredAt: core.restoredAt, discard: core.discard, clear: core.clear }
}

/**
 * Biến thể cho form tự quản bằng `useState` (một object `formData`). Mọi thay đổi so với mốc lúc mở đều
 * tính là người dùng nhập (form kiểu này không tự điền bất đồng bộ).
 */
export function useStateDraft<T>(
  value: T,
  setValue: (value: T) => void,
  { key, enabled }: { key: string; enabled: boolean },
): FormDraftHandle {
  const valueRef = useRef(value)
  useLayoutEffect(() => { valueRef.current = value })
  const core = useDraftCore<T>({
    key,
    enabled,
    read: () => valueRef.current,
    apply: values => {
      const cur = valueRef.current
      const isObj = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v)
      setValue(isObj(cur) && isObj(values) ? ({ ...(cur as object), ...(values as object) } as T) : values)
    },
  })
  const { changed } = core
  const snap = snapshot(value)
  const firstRef = useRef(true)

  useEffect(() => {
    if (firstRef.current) { firstRef.current = false; return }
    changed(true, false)
  }, [snap, changed])

  return { restoredAt: core.restoredAt, discard: core.discard, clear: core.clear }
}
