import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getApiErrorCode, getApiErrorMessage } from '@/lib/apiError'
import { documentApi } from '../api/documentApi'
import type { KbDocument } from '../types'

/** Ngừng gõ chừng này thì lưu. */
const IDLE_MS = 1500
/** Gõ liên tục thì cũng lưu ít nhất chừng này một lần. */
const MAX_WAIT_MS = 10_000

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict'

interface Options {
  docId: string
  /** `contentHash` của bản đã mở. */
  initialHash: string
  /** Đọc nội dung hiện tại của trình soạn. */
  read: () => string
}

/**
 * Tự lưu kiểu Lark: ngừng gõ 1,5 giây (hoặc tối đa 10 giây khi gõ liên tục) thì gửi bản hiện tại kèm `baseHash`.
 * Mỗi lần chỉ một lượt lưu; có thay đổi trong lúc đang lưu thì lưu tiếp ngay sau. Máy chủ báo `DOCUMENT_EDIT_CONFLICT`
 * (người khác lưu chen) thì DỪNG tự lưu — người soạn tự chọn tải lại hay ghi đè, không bao giờ đè im lặng.
 */
export function useAutosave({ docId, initialHash, read }: Options) {
  const qc = useQueryClient()
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const baseHash = useRef(initialHash)
  const dirty = useRef(false)
  const inFlight = useRef<Promise<boolean> | null>(null)
  const blocked = useRef(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstChangeAt = useRef<number | null>(null)
  const readRef = useRef(read)
  useEffect(() => { readRef.current = read })

  const clearTimer = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = null
  }

  /** Lưu ngay nếu còn thay đổi chưa lưu. Trả về true khi không còn gì chưa lưu. */
  const flush = useCallback(async (): Promise<boolean> => {
    clearTimer()
    if (inFlight.current) await inFlight.current
    if (!dirty.current) return true
    if (blocked.current) return false
    dirty.current = false
    firstChangeAt.current = null
    setStatus('saving')
    const run = (async () => {
      try {
        const doc: KbDocument = await documentApi.saveContent(docId, readRef.current(), baseHash.current)
        if (doc.contentHash) baseHash.current = doc.contentHash
        qc.setQueryData(['documents', 'one', docId], doc)
        qc.invalidateQueries({ queryKey: ['documents'], refetchType: 'none' })
        setSavedAt(new Date())
        setError(null)
        setStatus(dirty.current ? 'dirty' : 'saved')
        return true
      } catch (e) {
        dirty.current = true
        if (getApiErrorCode(e) === 'DOCUMENT_EDIT_CONFLICT') {
          blocked.current = true
          setStatus('conflict')
        } else {
          setStatus('error')
        }
        setError(getApiErrorMessage(e, ''))
        return false
      }
    })()
    inFlight.current = run
    const ok = await run
    inFlight.current = null
    // Có thay đổi trong lúc đang lưu → lưu tiếp.
    if (ok && dirty.current && !blocked.current) return flush()
    return ok && !dirty.current
  }, [docId, qc])

  /** Gọi mỗi khi nội dung đổi. */
  const markChanged = useCallback(() => {
    dirty.current = true
    if (blocked.current) return
    setStatus(s => (s === 'saving' ? s : 'dirty'))
    const now = Date.now()
    firstChangeAt.current ??= now
    clearTimer()
    const wait = Math.max(0, Math.min(IDLE_MS, firstChangeAt.current + MAX_WAIT_MS - now))
    idleTimer.current = setTimeout(() => { void flush() }, wait)
  }, [flush])

  /**
   * Gỡ trạng thái xung đột sau khi người soạn đã chọn. `hash` = băm bản mới nhất trên máy chủ; `keepMine` = ghi đè bằng
   * nội dung đang có trong trình soạn (lưu ngay), ngược lại bên gọi đã nạp lại bản mới vào trình soạn.
   */
  const resolveConflict = useCallback((hash: string, keepMine: boolean) => {
    baseHash.current = hash
    blocked.current = false
    dirty.current = keepMine
    setError(null)
    if (keepMine) void flush()
    else setStatus('idle')
  }, [flush])

  // Đóng tab / tải lại trang khi còn chữ chưa lưu → trình duyệt hỏi lại.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty.current && !inFlight.current) return
      void flush()
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [flush])

  // Rời trang trong ứng dụng: gửi nốt bản cuối (không chờ được nữa — request vẫn đi).
  useEffect(() => () => {
    clearTimer()
    if (dirty.current && !blocked.current) {
      void documentApi.saveContent(docId, readRef.current(), baseHash.current).catch(() => undefined)
    }
  }, [docId])

  return {
    status,
    savedAt,
    error,
    flush,
    markChanged,
    resolveConflict,
    hasUnsaved: () => dirty.current || !!inFlight.current,
  }
}
