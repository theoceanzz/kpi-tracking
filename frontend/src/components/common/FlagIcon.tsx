import { cn } from '@/lib/utils'
import type { Language } from '@/i18n/languages'

/**
 * Cờ của từng ngôn ngữ, vẽ bằng SVG. Không dùng emoji cờ: Windows không vẽ emoji cờ (hiện ra "VN", "US"),
 * nên trên đa số máy người dùng sẽ không thấy cờ. Thêm ngôn ngữ mới: thêm một nhánh ở đây.
 */
export default function FlagIcon({ language, className }: { language: Language; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex h-3.5 w-5 shrink-0 overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgba(15,23,42,0.12)]',
        className,
      )}
    >
      {language === 'vi' ? <VietnamFlag /> : <UsFlag />}
    </span>
  )
}

function VietnamFlag() {
  return (
    <svg viewBox="0 0 30 20" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <rect width="30" height="20" fill="#DA251D" />
      <polygon
        fill="#FFFF00"
        points="15,4 16.18,7.63 20,7.63 16.91,9.87 18.09,13.5 15,11.26 11.91,13.5 13.09,9.87 10,7.63 13.82,7.63"
      />
    </svg>
  )
}

function UsFlag() {
  const stripes = Array.from({ length: 13 }, (_, i) => i)
  const stars: Array<[number, number]> = []
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 6; col++) stars.push([1.3 + col * 2.1, 1.2 + row * 2.1])
  }
  return (
    <svg viewBox="0 0 30 20" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      {stripes.map((i) => (
        <rect key={i} y={(i * 20) / 13} width="30" height={20 / 13 + 0.05} fill={i % 2 === 0 ? '#B22234' : '#FFFFFF'} />
      ))}
      <rect width="12.6" height={(20 / 13) * 7} fill="#3C3B6E" />
      {stars.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="0.45" fill="#FFFFFF" />
      ))}
    </svg>
  )
}
