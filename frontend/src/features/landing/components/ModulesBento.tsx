import { useState } from 'react'
import {
  Bot, ClipboardCheck, FileSpreadsheet, Gauge, Gift, GitBranch, HeartHandshake, LayoutDashboard, Link2, Sparkles,
  Target, ToggleRight, Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Eyebrow, GlassFrame, Headline, Lead, Reveal, WindowBar } from './primitives'

type Module = { key: string; icon: LucideIcon; name: string; desc: string; menu: string; tone: string }

const MODULES: Module[] = [
  { key: 'okr', icon: Target, name: 'OKR', desc: 'Mục tiêu & kết quả then chốt', menu: 'OKR của tôi', tone: 'from-blue-600 to-sky-500' },
  { key: 'bsc', icon: Gauge, name: 'BSC', desc: 'Thẻ điểm cân bằng 4 lĩnh vực', menu: 'Thẻ điểm BSC', tone: 'from-cyan-500 to-sky-500' },
  { key: 'conduct', icon: HeartHandshake, name: 'Hạnh kiểm', desc: 'Chấm hành vi theo bộ tiêu chí', menu: 'Chấm hạnh kiểm', tone: 'from-rose-500 to-pink-500' },
  { key: 'cascade', icon: GitBranch, name: 'Thác nước', desc: 'Phân rã chỉ tiêu từ trên xuống', menu: 'Phân rã chỉ tiêu', tone: 'from-emerald-500 to-teal-500' },
  { key: 'qual', icon: Sparkles, name: 'Định tính', desc: 'Xếp loại theo mức, không chỉ điểm', menu: 'Đánh giá định tính', tone: 'from-amber-500 to-orange-500' },
  { key: 'reward', icon: Gift, name: 'Thưởng & quà', desc: 'Điểm thưởng, điểm danh, chứng nhận', menu: 'Thưởng & quà', tone: 'from-fuchsia-500 to-purple-500' },
  { key: 'wallet', icon: Wallet, name: 'Ví tiền', desc: 'Nạp qua SePay, đổi điểm thưởng', menu: 'Ví của tôi', tone: 'from-lime-500 to-green-500' },
  { key: 'ai', icon: Bot, name: 'Trợ lý K.AI', desc: 'Hỏi số liệu, điền hộ biểu mẫu', menu: 'K.AI', tone: 'from-violet-500 to-sky-400' },
]

// Mục menu luôn có, không phụ thuộc module
const BASE_MENU: Array<{ icon: LucideIcon; label: string }> = [
  { icon: LayoutDashboard, label: 'Tổng quan' },
  { icon: Target, label: 'KPI của tôi' },
  { icon: ClipboardCheck, label: 'Đánh giá' },
]

const EXTRAS = [
  { icon: Link2, name: 'Đăng nhập Lark' },
  { icon: FileSpreadsheet, name: 'Nhập từ Excel' },
  { icon: LayoutDashboard, name: 'Dashboard kéo thả' },
]

/**
 * Bảng công tắc module (trái) + menu giả lập của nhân viên (phải).
 * Gạt công tắc nào thì mục menu tương ứng hiện/ẩn ngay — minh hoạ trực tiếp
 * "module chưa bật thì không xuất hiện trên menu".
 */
export function ModulesBento() {
  const [on, setOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MODULES.map((m) => [m.key, m.key !== 'wallet' && m.key !== 'qual'])),
  )
  const enabled = MODULES.filter((m) => on[m.key])

  return (
    <section id="modules" className="lp-section-alt scroll-mt-24 border-t border-slate-200 px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36">
      <div className="mx-auto max-w-[1440px]">
        <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
          <Reveal><Eyebrow className="justify-center"><ToggleRight className="h-3.5 w-3.5" /> Bật/tắt theo nhu cầu</Eyebrow></Reveal>
          <Reveal delay={100}><Headline className="mt-4">Dùng đến đâu, <em>bật đến đó</em>.</Headline></Reveal>
          <Reveal delay={200}>
            <Lead className="mx-auto mt-4 text-center">Mỗi module là một công tắc. Gạt thử bên trái — menu của nhân viên bên phải đổi theo.</Lead>
          </Reveal>
        </div>

        <div className="mx-auto grid max-w-6xl items-start gap-6 lg:grid-cols-[3fr_2fr] lg:gap-8">
          {/* Bảng công tắc */}
          <Reveal from="left">
            <GlassFrame className="overflow-hidden">
              <WindowBar title="Thiết lập · Module & tính năng" />
              <ul className="divide-y divide-slate-100">
                {MODULES.map((m) => {
                  const active = on[m.key] ?? false
                  return (
                    <li key={m.key}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={active}
                        onClick={() => setOn((s) => ({ ...s, [m.key]: !active }))}
                        className={cn(
                          'flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-slate-50 sm:px-5',
                          !active && 'opacity-60',
                        )}
                      >
                        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm transition-all', m.tone, !active && 'grayscale')}>
                          <m.icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-slate-900">{m.name}</span>
                          <span className="block truncate text-xs text-slate-500">{m.desc}</span>
                        </span>
                        <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300', active ? 'bg-emerald-500' : 'bg-slate-300')}>
                          <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300', active ? 'translate-x-[22px]' : 'translate-x-0.5')} />
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </GlassFrame>
          </Reveal>

          {/* Menu giả lập */}
          <Reveal from="right" delay={120} className="lg:sticky lg:top-28">
            <GlassFrame className="overflow-hidden">
              <WindowBar title="Menu nhân viên nhìn thấy" />
              <div className="p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between px-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Menu bên trái</span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
                    {enabled.length}/{MODULES.length} module đang bật
                  </span>
                </div>
                <ul className="space-y-1">
                  {BASE_MENU.map((item, i) => (
                    <li key={item.label} className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold', i === 0 ? 'bg-blue-50 text-blue-700' : 'text-slate-700')}>
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </li>
                  ))}
                  {MODULES.map((m) => {
                    const active = on[m.key] ?? false
                    return (
                      <li key={m.key} className="lp-expand" data-open={active} aria-hidden={!active}>
                        <div>
                          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700">
                            <m.icon className="h-4 w-4 shrink-0" />
                            {m.menu}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <p className="mt-3 px-2 text-xs text-slate-500">
                  Module tắt thì mục menu biến mất — nhân viên không bao giờ thấy màn hình mình không dùng.
                </p>
              </div>
            </GlassFrame>
          </Reveal>
        </div>

        <Reveal delay={200} className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {EXTRAS.map((e) => (
            <span key={e.name} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm">
              <e.icon className="h-3.5 w-3.5 text-blue-600" /> {e.name}
            </span>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
