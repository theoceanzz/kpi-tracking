import { Fragment } from 'react'

/**
 * Tô màu "@Tên" của những người thực sự được nhắc. Dùng cho nội dung bình luận và lớp nền của ô soạn
 * (ở ô soạn chỉ được đổi màu, không đổi độ đậm — chữ phải trùng khít từng ký tự với textarea phía trên).
 */
export default function MentionText({ text, names, className = 'font-medium text-[var(--color-primary)]' }: {
  text: string
  names: (string | null | undefined)[]
  className?: string
}) {
  const list = names.filter((n): n is string => !!n).sort((a, b) => b.length - a.length)
  if (!list.length) return <>{text}</>
  const escaped = list.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const parts = text.split(new RegExp(`(@(?:${escaped.join('|')}))`, 'g'))
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('@') && list.includes(p.slice(1))
          ? <span key={i} className={className}>{p}</span>
          : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  )
}
