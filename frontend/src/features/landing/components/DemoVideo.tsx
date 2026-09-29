import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { fallbackTo, landingMedia } from '../landingMedia'
import { cn } from '@/lib/utils'
import { useInView } from '../hooks/useInView'
import { Eyebrow, GlassFrame, Headline, Lead, Reveal } from './primitives'
import { Trans, useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

/** Video thật ở frontend/public/landing/keygo-demo.mp4 (+ poster); bản tiếng Anh ở public/landing/en/ cùng tên.
 *  Chưa có bản theo ngôn ngữ thì dùng bản gốc; không có cả hai thì khung tự chạy "cuộn cảnh" từ ảnh chụp thật
 *  (Ken Burns) để trang không trống. */
const VIDEO_FILE = 'keygo-demo.mp4'
const POSTER_FILE = 'keygo-demo-poster.webp'

export function DemoVideo() {
  const { t } = useTranslation('landing')
  const [hasVideo, setHasVideo] = useState(true)
  const video = landingMedia(VIDEO_FILE)
  const poster = landingMedia(POSTER_FILE)
  // Bản theo ngôn ngữ lỗi (chưa có tệp) thì thử bản gốc trước khi chuyển sang cuộn cảnh.
  const [videoSrc, setVideoSrc] = useState(video.src)
  const videoRef = useRef<HTMLVideoElement>(null)
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.35, once: false })

  // Tự phát (câm tiếng — trình duyệt chỉ cho autoplay khi muted) lúc khung lọt vào màn hình,
  // dừng khi cuộn đi. Người xem tự bật tiếng / tua bằng bộ điều khiển gốc của trình duyệt.
  useEffect(() => {
    const v = videoRef.current
    if (!v || !hasVideo) return
    if (inView) v.play().catch(() => undefined)
    else v.pause()
  }, [inView, hasVideo])

  return (
    <section id="demo" className="relative scroll-mt-24 overflow-hidden border-t border-slate-200 px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="lp-aurora left-1/2 top-1/2 h-[420px] w-[820px] -translate-x-1/2 -translate-y-1/2 bg-blue-200 opacity-60" />
      </div>
      <div className="mx-auto max-w-[1440px]">
        <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
          <Reveal><Eyebrow className="justify-center">{t('DemoVideo.watchTheDemo68Seconds')}</Eyebrow></Reveal>
          <Reveal delay={100}><Headline className="mt-4"><Trans t={t} i18nKey="DemoVideo.headline" components={{ em: <em /> }} /></Headline></Reveal>
          <Reveal delay={200}>
            <Lead className="mx-auto mt-4 text-center">{t('DemoVideo.fromSignInToGivingRewards')}</Lead>
          </Reveal>
        </div>

        <Reveal from="zoom" delay={150}>
          <div ref={ref} className="relative">
            <div className="pointer-events-none absolute -inset-x-6 -bottom-8 top-1/4 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.18),transparent_65%)] blur-2xl" />
            <GlassFrame className="overflow-hidden">
              <div className="relative aspect-video bg-slate-900">
                {hasVideo ? (
                  // controls: thanh tua, âm lượng, toàn màn hình của trình duyệt — không tự vẽ để khỏi thiếu tính năng
                  <video
                    ref={videoRef}
                    src={videoSrc}
                    poster={videoSrc === video.src ? poster.src : poster.fallback}
                    controls
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    controlsList="nodownload"
                    onError={() => (videoSrc !== video.fallback ? setVideoSrc(video.fallback) : setHasVideo(false))}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <SceneReel active={inView} />
                )}
              </div>
            </GlassFrame>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ── Cuộn cảnh từ ảnh chụp thật (khi chưa có video) ─────────────────────── */

const SCENES = perLanguage(() => ([
  { src: 'kpi-cycles.webp', title: i18n.t('landing:DemoVideo.createEvaluationCyclesPeriods'), sub: i18n.t('landing:DemoVideo.monthQuarterYearCyclesGroupingSeveral'), ms: 5000 },
  { src: 'evaluation-batch.webp', title: i18n.t('landing:DemoVideo.scoreEachPeriod'), sub: i18n.t('landing:DemoVideo.approveSubmissionsScoreRate'), ms: 5000 },
  { src: 'evaluation-period.webp', title: i18n.t('landing:DemoVideo.finalizeCycleResults'), sub: i18n.t('landing:DemoVideo.approvalFlowByLevelBellCurve'), ms: 5000 },
  { src: 'rewards.webp', title: i18n.t('landing:DemoVideo.giveRewards'), sub: i18n.t('landing:DemoVideo.rewardPointsGiftsCertificates'), ms: 5400 },
]))

function SceneReel({ active }: { active: boolean }) {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (!active) return
    const scene = SCENES()[idx]
    const t = window.setTimeout(() => setIdx((i) => (i + 1) % SCENES().length), scene?.ms ?? 5000)
    return () => window.clearTimeout(t)
  }, [active, idx])

  const scene = SCENES()[idx] ?? SCENES()[0]!

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Cảnh — key đổi để Ken Burns chạy lại từ đầu */}
      <div key={idx} className="lp-fade-in absolute inset-0">
        <img
          src={landingMedia(scene.src).src}
          onError={fallbackTo(landingMedia(scene.src).fallback)}
          alt={scene.title}
          className={cn('h-full w-full object-cover object-top', active && 'lp-kenburns')}
          style={{ '--lp-kb': `${scene.ms + 800}ms` } as CSSProperties}
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/10 to-transparent" />

      {/* Phụ đề & thanh tiến độ cảnh */}
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
        <div key={`cap-${idx}`} className="lp-pop mb-3">
          <div className="text-base font-black text-white sm:text-xl">{scene.title}</div>
          <div className="text-xs text-slate-300 sm:text-sm">{scene.sub}</div>
        </div>
        <div className="flex gap-1.5">
          {SCENES().map((s, i) => (
            <button
              key={s.title}
              type="button"
              aria-label={s.title}
              onClick={() => setIdx(i)}
              className="h-1 flex-1 overflow-hidden rounded-full bg-white/25"
            >
              <div
                className={cn('h-full rounded-full bg-white', i < idx && 'w-full', i === idx && active && 'lp-fill')}
                style={i === idx ? ({ width: '100%', animationDuration: `${s.ms}ms`, animationTimingFunction: 'linear' } as CSSProperties) : undefined}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg backdrop-blur sm:top-4">
        <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" /> Demo
      </div>
    </div>
  )
}
