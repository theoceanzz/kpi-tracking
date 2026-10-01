import { useSyncExternalStore } from 'react'

/** Modal của app (Dialog/Drawer portal ra body) — trừ chính khung K.AI. */
const SELECTOR = '[role="dialog"][aria-modal="true"]:not([data-ai-widget])'

function subscribe(onChange: () => void) {
  // Dialog/Drawer portal thẳng vào body, nên chỉ cần nghe con trực tiếp của body.
  const obs = new MutationObserver(onChange)
  obs.observe(document.body, { childList: true })
  return () => obs.disconnect()
}

const snapshot = () => document.querySelector(SELECTOR) !== null

/** Có modal nào đang mở không — để nút nổi tránh đè lên hàng nút ở footer của modal. */
export function useModalOpen() {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
