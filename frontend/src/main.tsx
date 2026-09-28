import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { i18nReady } from './i18n'
import LanguageRoot from './i18n/LanguageRoot'
import { initLanguageSync } from './i18n/languageSync'
import './index.css'

// Chờ mọi namespace nạp xong rồi mới render, để lần vẽ đầu không hiện key dịch.
// Nạp lỗi (mất mạng giữa chừng) vẫn render: i18next rơi về key, còn hơn trang trắng.
void i18nReady.finally(() => {
  initLanguageSync()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <LanguageRoot render={() => <App />} />
    </StrictMode>
  )
})
