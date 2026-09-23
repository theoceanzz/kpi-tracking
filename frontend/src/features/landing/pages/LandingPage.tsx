import { Navigate } from 'react-router-dom'
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
