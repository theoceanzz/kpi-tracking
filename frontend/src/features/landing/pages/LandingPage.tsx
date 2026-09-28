import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import '../landing.css'
import { FloatingContact, LandingNav } from '../components/LandingNav'
import { HeroScene } from '../components/HeroScene'
import { Marquee, StatsBand } from '../components/StatsBand'
import { StoryChapters } from '../components/StoryChapters'
import { DemoVideo } from '../components/DemoVideo'
import { ModulesBento } from '../components/ModulesBento'
import { PricingSection } from '../components/PricingSection'
import { LandingFooter } from '../components/LandingFooter'
import { LeadForm } from '../components/LeadForm'

/**
 * Trang giới thiệu dạng "cuốn phim": mở màn → dải credit → số liệu → bốn chương
 * kể chuyện → video demo → module → bảng giá → form đăng ký tư vấn (cảnh kết). Tông tối cố định, không
 * theo theme của app (xem landing.css).
 */
export default function LandingPage() {
  const { isAuthenticated } = useAuthStore()
  const { hash } = useLocation()

  // Vào từ trang khác với /#contact: trình duyệt tìm anchor trước khi React render xong nên không cuộn,
  // React Router cũng không tự cuộn theo hash → tự cuộn sau khi render. Cuộn lại lần nữa khi layout
  // đã ổn định (ảnh/font/chương kể chuyện làm đổi chiều cao các section phía trên).
  useEffect(() => {
    if (!hash || isAuthenticated) return
    const scroll = () => document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' })
    const raf = requestAnimationFrame(scroll)
    const timer = window.setTimeout(scroll, 400)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
    }
  }, [hash, isAuthenticated])

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="lp lp-grain relative min-h-screen overflow-x-hidden font-sans antialiased selection:bg-blue-200">
      <LandingNav />
      <FloatingContact />

      <main className="relative z-0">
        <HeroScene />
        <Marquee />
        <StatsBand />
        <StoryChapters />
        <DemoVideo />
        <ModulesBento />
        <PricingSection />
        <LeadForm />
      </main>

      <LandingFooter />
    </div>
  )
}
