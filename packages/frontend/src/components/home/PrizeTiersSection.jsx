import { useNavigate } from 'react-router-dom'
import MatchTile from './MatchTile'

const tiers = [
  { count: 2, percentage: '5%' },
  { count: 3, percentage: '10%' },
  { count: 4, percentage: '15%' },
  { count: 5, percentage: '20%' },
  { count: 6, percentage: '20%' },
  { count: 7, percentage: '30%' },
]

export default function PrizeTiersSection() {
  const navigate = useNavigate()
  return (
    <section className="bg-[#141a08] rounded-2xl px-6 py-10 flex flex-col items-center gap-8">
      <h2 className="text-2xl font-bold text-white text-center">How much you can win</h2>
      <div className="flex justify-center gap-3 flex-wrap">
        {tiers.map((tier) => (
          <MatchTile key={tier.count} count={tier.count} percentage={tier.percentage} />
        ))}
      </div>
      <button onClick={() => navigate('/dashboard')} className="bg-[#c8f53a] text-black font-bold rounded-xl px-8 py-3 text-base hover:opacity-90 transition-opacity">
        Get Started
      </button>
    </section>
  )
}
