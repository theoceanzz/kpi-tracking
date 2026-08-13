import { useNavigate } from 'react-router-dom'

function LarkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M4.2 6.6c0-.9.7-1.6 1.6-1.6h5.4c.6 0 1.1.3 1.4.8l1.5 2.6H6.4c-1.2 0-2.2 1-2.2 2.2V6.6Z"
        fill="#00D6B9"
      />
      <path
        d="M4.2 12.1c0-1.2 1-2.2 2.2-2.2h9.9l2 3.4c.3.5.3 1.1 0 1.6l-1.4 2.4H6.4c-1.2 0-2.2-1-2.2-2.2v-3Z"
        fill="#133C9A"
      />
      <path
        d="M6.4 19.4c-1.2 0-2.2-1-2.2-2.2 3.9 1.3 8.1 1.1 11.8-.6 2.4-1.1 4.5-2.8 6-5l-1.3 5.6c-.2 1.3-1.4 2.2-2.7 2.2H6.4Z"
        fill="#00D6B9"
      />
    </svg>
  )
}

/**
 * Mỗi công ty dùng ứng dụng Lark riêng nên phải biết công ty trước mới dựng được URL đăng nhập.
 * Vì vậy nút này chuyển sang màn chọn công ty thay vì gọi thẳng API.
 */
export default function LarkLoginButton() {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate('/auth/lark/select-company')}
      className="w-full py-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)] font-bold hover:bg-[var(--color-muted)]/50 hover:border-[var(--color-primary)]/40 transition-all flex items-center justify-center gap-2.5 shadow-sm"
    >
      <LarkIcon className="h-5 w-5" />
      Đăng nhập với Lark
    </button>
  )
}
