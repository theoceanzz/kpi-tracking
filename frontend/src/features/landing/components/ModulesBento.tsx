import { useState } from 'react'
import {
  Bot, ClipboardCheck, FileSpreadsheet, Gauge, Gift, GitBranch, HeartHandshake, LayoutDashboard, Link2, Sparkles,
  Target, ToggleRight, Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Eyebrow, GlassFrame, Headline, Lead, Reveal, WindowBar } from './primitives'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

type Module = { key: string; icon: LucideIcon; name: string; desc: string; menu: string; tone: string }

const MODULES = perLanguage((): Module[] => ([
  { key: 'okr', icon: Target, name: 'OKR', desc: i18n.t('landing:ModulesBento.objectivesKeyResults'), menu: i18n.t('landing:ModulesBento.myOkrs'), tone: 'from-blue-600 to-sky-500' },
  { key: 'bsc', icon: Gauge, name: 'BSC', desc: i18n.t('landing:ModulesBento.balancedScorecardWith4Areas'), menu: i18n.t('landing:ModulesBento.bscScorecard'), tone: 'from-cyan-500 to-sky-500' },
  { key: 'conduct', icon: HeartHandshake, name: i18n.t('landing:ModulesBento.conduct'), desc: i18n.t('landing:ModulesBento.scoreConductAgainstACriteriaSet'), menu: i18n.t('landing:ModulesBento.conductScoring'), tone: 'from-rose-500 to-pink-500' },
  { key: 'cascade', icon: GitBranch, name: i18n.t('landing:ModulesBento.waterfall'), desc: i18n.t('landing:ModulesBento.cascadeKpisFromTheTopDown'), menu: i18n.t('landing:ModulesBento.cascadeKpi'), tone: 'from-emerald-500 to-teal-500' },
  { key: 'qual', icon: Sparkles, name: i18n.t('landing:ModulesBento.qualitative'), desc: i18n.t('landing:ModulesBento.rateByLevelNotJustBy'), menu: i18n.t('landing:ModulesBento.qualitativeEvaluation'), tone: 'from-amber-500 to-orange-500' },
  { key: 'reward', icon: Gift, name: i18n.t('landing:ModulesBento.rewardsGifts'), desc: i18n.t('landing:ModulesBento.rewardPointsCheckInsCertificates'), menu: i18n.t('landing:ModulesBento.rewardsGifts'), tone: 'from-fuchsia-500 to-purple-500' },
  { key: 'wallet', icon: Wallet, name: i18n.t('landing:ModulesBento.wallet'), desc: i18n.t('landing:ModulesBento.topUpViaSepayConvertTo'), menu: i18n.t('landing:ModulesBento.myWallet'), tone: 'from-lime-500 to-green-500' },
  { key: 'ai', icon: Bot, name: i18n.t('landing:ModulesBento.kAiAssistant'), desc: i18n.t('landing:ModulesBento.askForFiguresFillInForms'), menu: 'K.AI', tone: 'from-violet-500 to-sky-400' },
]))

// Mục menu luôn có, không phụ thuộc module
const BASE_MENU = perLanguage((): Array<{ icon: LucideIcon; label: string }> => ([
  { icon: LayoutDashboard, label: i18n.t('landing:ModulesBento.overview') },
  { icon: Target, label: i18n.t('landing:ModulesBento.myKpis') },
  { icon: ClipboardCheck, label: i18n.t('landing:ModulesBento.evaluation') },
]))

const EXTRAS = perLanguage(() => ([
  { icon: Link2, name: i18n.t('landing:ModulesBento.larkSignIn') },
  { icon: FileSpreadsheet, name: i18n.t('landing:ModulesBento.importFromExcel') },
  { icon: LayoutDashboard, name: i18n.t('landing:ModulesBento.dragAndDropDashboard') },
]))

/**
 * Bảng công tắc module (trái) + menu giả lập của nhân viên (phải).
 * Gạt công tắc nào thì mục menu tương ứng hiện/ẩn ngay — minh hoạ trực tiếp
 * "module chưa bật thì không xuất hiện trên menu".
 */
export function ModulesBento() {
  const { t } = useTranslation('landing')
  const [on, setOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MODULES().map((m) => [m.key, m.key !== 'wallet' && m.key !== 'qual'])),
  )
  const enabled = MODULES().filter((m) => on[m.key])

  return (
    <section id="modules" className="lp-section-alt scroll-mt-24 border-t border-slate-200 px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36">
      <div className="mx-auto max-w-[1440px]">
        <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
          <Reveal><Eyebrow className="justify-center"><ToggleRight className="h-3.5 w-3.5" /> {t('ModulesBento.turnOnOffAsNeeded')}</Eyebrow></Reveal>
          <Reveal delay={100}><Headline className="mt-4">{t('ModulesBento.useOnlyWhatYouNeed')} <em>{t('ModulesBento.turnOnOnlyThat')}</em>.</Headline></Reveal>
          <Reveal delay={200}>
            <Lead className="mx-auto mt-4 text-center">{t('ModulesBento.eachModuleIsASwitchTry')}</Lead>
          </Reveal>
        </div>

        <div className="mx-auto grid max-w-6xl items-start gap-6 lg:grid-cols-[3fr_2fr] lg:gap-8">
          {/* Bảng công tắc */}
          <Reveal from="left">
            <GlassFrame className="overflow-hidden">
              <WindowBar title={t('ModulesBento.setupModulesFeatures')} />
              <ul className="divide-y divide-slate-100">
                {MODULES().map((m) => {
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
              <WindowBar title={t('ModulesBento.menuEmployeesSee')} />
              <div className="p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between px-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('ModulesBento.leftMenu')}</span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
                    {enabled.length}/{MODULES().length} {t('ModulesBento.modulesOn')}
                  </span>
                </div>
                <ul className="space-y-1">
                  {BASE_MENU().map((item, i) => (
                    <li key={item.label} className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold', i === 0 ? 'bg-blue-50 text-blue-700' : 'text-slate-700')}>
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </li>
                  ))}
                  {MODULES().map((m) => {
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
                  {t('ModulesBento.whenAModuleIsOffIts')}
                </p>
              </div>
            </GlassFrame>
          </Reveal>
        </div>

        <Reveal delay={200} className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {EXTRAS().map((e) => (
            <span key={e.name} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm">
              <e.icon className="h-3.5 w-3.5 text-blue-600" /> {e.name}
            </span>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
