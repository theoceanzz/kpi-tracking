import { X, Target, TrendingUp } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title: React.ReactNode
  /** Indicates whether the drawer is showing an Objective, a Key Result or a KPI. */
  type?: 'OBJECTIVE' | 'KR' | 'KPI'
  children: React.ReactNode
}

/**
 * Side drawer that slides in from the right, occupying 60 % of the viewport
 * width on medium-and-above screens (full width on mobile).
 *
 * Implements:
 *  - CSS transition-based slide-in / slide-out animation driven by `isOpen`.
 *  - Backdrop click to close.
 *  - Body scroll lock while open.
 *  - Keyboard Escape to close.
 */
export default function ObjectiveDrawer({
  isOpen,
  onClose,
  title,
  type,
  children,
}: DrawerProps) {
  // Mounted controls whether the DOM node is present at all (avoids layout
  // shifts when the drawer is closed and we animate it out).
  const [mounted, setMounted] = useState(false)
  // Visible drives the CSS translate (slide animation).
  const [visible, setVisible] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync open → mount + visible, close → animate out then unmount.
  useEffect(() => {
    if (isOpen) {
      setMounted(true)
      // Push into next tick so the initial position is rendered before
      // we apply the "visible" class that transitions to translate-x-0.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
    } else {
      setVisible(false)
      // Wait for the CSS transition (300 ms) to finish before unmounting.
      closeTimerRef.current = setTimeout(() => setMounted(false), 320)
    }

    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [isOpen])

  // Lock body scroll while drawer is open.
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Close on Escape key.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!mounted) return null

  const typeBadge =
    type === 'OBJECTIVE' ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 flex-shrink-0">
        <Target size={10} />
        Mục tiêu
      </span>
    ) : type === 'KR' ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/30 flex-shrink-0">
        <TrendingUp size={10} />
        Key Result
      </span>
    ) : type === 'KPI' ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-500/30 flex-shrink-0">
        <TrendingUp size={10} />
        KPI
      </span>
    ) : null

  /*
    Portal ra <body>: drawer dùng `position: fixed`, mà ô của react-grid-layout ở trang chủ
    có `transform` — đủ để tạo containing block mới, khiến drawer mở từ widget bị căn theo
    ô và bị `overflow-hidden` của ô cắt mất thay vì phủ toàn màn hình.
  */
  return createPortal((
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-slate-900/40 dark:bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`relative w-full md:w-[60vw] max-w-none h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/10 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 flex-shrink-0">
          <div className="flex flex-col gap-1 min-w-0">
            {typeBadge && <div>{typeBadge}</div>}
            <h2 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2 pr-2 leading-snug">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 ml-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors flex-shrink-0"
            aria-label="Đóng drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 text-slate-700 dark:text-slate-300">
          {children}
        </div>
      </div>
    </div>
  ), document.body)
}
