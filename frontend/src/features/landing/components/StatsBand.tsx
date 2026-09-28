import { useCountUp } from '../hooks/useCountUp'
import { useInView } from '../hooks/useInView'
import { Reveal } from './primitives'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

const TAGS = perLanguage(() => (['OKR', 'KPI', 'BSC', i18n.t('landing:StatsBand.conduct'), i18n.t('landing:StatsBand.kpiWaterfall'), i18n.t('landing:StatsBand.periodEvaluations'), i18n.t('landing:StatsBand.rewardsGifts'), i18n.t('landing:StatsBand.wallet'), 'K.AI', i18n.t('landing:StatsBand.customizableDashboard'), i18n.t('landing:StatsBand.excelImport'), i18n.t('landing:StatsBand.larkSignIn'), 'White label']))

/** Dải chữ chạy ngang liệt kê module (như dòng credit cuối phim). */
export function Marquee() {
  const list = [...TAGS(), ...TAGS()]
  return (
    <div className="relative overflow-hidden border-y border-slate-200 bg-slate-50 py-4 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
      <div className="lp-marquee flex w-max gap-10 whitespace-nowrap">
        {list.map((t, i) => (
          <span key={`${t}-${i}`} className="flex items-center gap-10 text-sm font-bold uppercase tracking-[0.25em] text-slate-500">
            {t}
            <span className="h-1 w-1 rounded-full bg-blue-500/70" />
          </span>
        ))}
      </div>
    </div>
  )
}

const STATS = perLanguage(() => ([
  { to: 40, suffix: '%', label: i18n.t('landing:StatsBand.higherTeamProductivity') },
  { to: 2, suffix: 'x', label: i18n.t('landing:StatsBand.goalCompletionSpeed') },
  { to: 95, suffix: '%', label: i18n.t('landing:StatsBand.userSatisfactionRate') },
  { to: 100, suffix: '%', label: i18n.t('landing:StatsBand.transparentEvaluationData') },
]))

/** Bốn con số đếm lên khi cuộn tới. */
export function StatsBand() {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.4 })
  return (
    <section ref={ref} className="lp-section-alt px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
      <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-6 lg:grid-cols-4">
        {STATS().map((s, i) => (
          <Reveal key={s.label} delay={i * 100}>
            <Stat {...s} active={inView} />
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function Stat({ to, suffix, label, active }: { to: number; suffix: string; label: string; active: boolean }) {
  const v = useCountUp(to, active, 1800)
  return (
    <div className="relative rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />
      <div className="lp-gradient-text text-4xl font-black tabular-nums sm:text-5xl lg:text-6xl">
        {Math.round(v)}
        {suffix}
      </div>
      <div className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-500 sm:text-sm">{label}</div>
    </div>
  )
}
