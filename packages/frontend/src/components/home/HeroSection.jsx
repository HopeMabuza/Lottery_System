import { useNavigate } from 'react-router-dom'
import LotteryBall from './LotteryBall'

export default function HeroSection() {
  const navigate = useNavigate()
  return (
    <section className="relative flex flex-col items-center justify-center text-center px-6 py-24 overflow-hidden">
      <LotteryBall number={7}  color="bg-[#a855f7]" className="absolute top-16 left-16 float-ball" />
      <LotteryBall number={23} color="bg-[#22c55e]" className="absolute top-12 right-16 float-ball-slow" />
      <LotteryBall number={41} color="bg-[#d97706]" className="absolute bottom-16 left-32 float-ball-delay" />
      <LotteryBall number={15} color="bg-[#7c3aed]" className="absolute bottom-16 right-24 float-ball-slower" />

      <div className="mb-6 px-4 py-1.5 rounded-full bg-[#1a2208] border border-[#2d3d10] text-[#c8f53a] text-xs font-semibold tracking-widest uppercase">
        Fair &amp; Verifiable Draws
      </div>

      <h1 className="text-5xl sm:text-6xl font-extrabold text-white leading-tight max-w-3xl">
        Pick 7 numbers.<br />See if you&apos;re the winner.
      </h1>

      <p className="mt-6 text-gray-400 text-lg max-w-xl leading-relaxed">
        A simple, transparent lottery. Grab a ticket for a few dollars, watch the draw, and get paid instantly if your numbers hit.
      </p>

      <div className="mt-10 flex items-center gap-4">
        <button onClick={() => navigate('/dashboard')} className="bg-[#c8f53a] text-black font-bold px-8 py-3 rounded-xl hover:brightness-110 transition text-base">
          Get Started
        </button>
        <button onClick={() => navigate('/dashboard')} className="border border-white text-white font-semibold px-8 py-3 rounded-xl hover:bg-white/10 transition text-base">
          See Current Round
        </button>
      </div>
    </section>
  )
}
