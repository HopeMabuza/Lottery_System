import HeroSection from '../components/home/HeroSection'
import HowToPlaySection from '../components/home/HowToPlaySection'
import PrizeTiersSection from '../components/home/PrizeTiersSection'

export default function HomePage() {
  return (
    <main className="text-white">
      <HeroSection />
      <div className="px-6 space-y-12 pb-20">
        <HowToPlaySection />
        <PrizeTiersSection />
      </div>
    </main>
  )
}
